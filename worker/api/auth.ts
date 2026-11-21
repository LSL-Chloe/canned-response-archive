import { database, queryTable, callRpc, type Env } from '../services/db.ts';
import { hashPin, verifyPin } from '../auth/crypto.ts';
import { cookieHeader, createSession, getSession, ipOf, requireRateLimit, revokeSession } from '../auth/session.ts';
import { fail, json, nameInput, pinInput, readJson } from './shared.ts';
import { beginEmailSignup, emailInput } from './otp.ts';

type Agent = { id: string; agent_name: string; role: 'admin' | 'agent'; disabled_at?: string | null; email_verified_at?: string | null };
type Credential = { pin_hash: string };
const errorMessage = 'Invalid agent name, email or PIN';

/** Validate both user-facing aliases; legacy clients may still send agentName. */
export function loginIdentifierInput(value: unknown): { kind: 'name' | 'email'; key: string } {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > 254)
    return fail(400, 'invalid_login', 'Enter an agent name or verified email');
  if (value.includes('@')) return { kind: 'email', key: emailInput(value) };
  return { kind: 'name', key: nameInput(value).toLowerCase() };
}

export async function handleAuth(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/api/auth/me' && request.method === 'GET') {
    const signed = await getSession(env, request);
    return json({ user: signed?.agent ?? null });
  }

  if (path === '/api/auth/signup' && request.method === 'POST') {
    const data = await readJson(request);
    const agentName = nameInput(data.agentName);
    const pin = pinInput(data.pin);
    if (data.email !== null && data.email !== undefined && data.email !== '') {
      return beginEmailSignup(request, env, agentName, pin, data.email);
    }
    const ip = ipOf(request);
    if (!await requireRateLimit(env, `signup:ip:${ip}`, 12, 3600) ||
        !await requireRateLimit(env, `signup:name:${agentName.toLocaleLowerCase('en-US')}`, 3, 3600)) {
      return fail(429, 'rate_limited', 'Too many attempts. Try again later.');
    }
    const created = await callRpc<Agent[]>(env, 'register_agent', {
      p_agent_name: agentName,
      p_pin_hash: await hashPin(pin, env.PIN_PEPPER!),
    });
    const agent = created[0];
    if (!agent) throw new Error('Signup returned no account');
    return json({ user: agent, recoveryEmailConfigured: false, warning: 'Without a verified email you cannot recover a forgotten PIN.' }, 201, {
      'Set-Cookie': await createSession(env, agent.id, request),
    });
  }

  if (path === '/api/auth/login' && request.method === 'POST') {
    const data = await readJson(request);
    const identity = loginIdentifierInput(data.identifier ?? data.agentName);
    const pin = pinInput(data.pin);
    const ip = ipOf(request);
    // Always cap IP attempts before looking up any account. Each real account
    // shares ONE rate-limit bucket across both login aliases, preventing
    // doubled PIN guessing via name + email.
    if (!await requireRateLimit(env, `login:ip:${ip}`, 50, 900)) {
      return fail(429, 'rate_limited', 'Too many attempts. Try again later.');
    }
    const found = await queryTable<Agent>(env, 'agents', {
      select: 'id,agent_name,role,disabled_at,email_verified_at',
      ...(identity.kind === 'email'
        ? { email: `eq.${identity.key}`, email_verified_at: 'not.is.null' }
        : { agent_name_key: `eq.${identity.key}` }),
      limit: '1',
    });
    const agent = found[0];
    const accountBucket = agent && !agent.disabled_at
      ? `login:account:id:${agent.id}`
      : `login:unknown:${identity.kind}:${identity.key}`;
    if (!await requireRateLimit(env, accountBucket, 8, 900)) {
      return fail(429, 'rate_limited', 'Too many attempts. Try again later.');
    }
    const credential = agent && !agent.disabled_at
      ? (await queryTable<Credential>(env, 'agent_credentials', {
        select: 'pin_hash', agent_id: `eq.${agent.id}`, limit: '1',
      }))[0]
      : null;
    if (!agent || agent.disabled_at || !credential || !await verifyPin(pin, credential.pin_hash, env.PIN_PEPPER!)) {
      return fail(401, 'invalid_credentials', errorMessage);
    }
    return json({ user: { id: agent.id, agent_name: agent.agent_name, role: agent.role } }, 200, {
      'Set-Cookie': await createSession(env, agent.id, request),
    });
  }

  if (path === '/api/auth/logout' && request.method === 'POST') {
    const signed = await getSession(env, request);
    if (signed) await revokeSession(env, signed.session.id);
    return json({ signedOut: true }, 200, { 'Set-Cookie': cookieHeader(request, '', 0) });
  }

  if (path === '/api/account/name' && request.method === 'PATCH') {
    const signed = await getSession(env, request);
    if (!signed) return fail(401, 'login_required', 'Sign in to change account settings');
    const data = await readJson(request);
    const agentName = nameInput(data.agentName);
    const changed = await database<Agent[]>(env, 'agents', {
      method: 'PATCH', query: { id: `eq.${signed.agent.id}` },
      body: { agent_name: agentName },
    });
    return json({ user: changed[0] && { id: signed.agent.id, agent_name: agentName, role: signed.agent.role } });
  }

  if (path === '/api/account/pin' && request.method === 'POST') {
    const signed = await getSession(env, request);
    if (!signed) return fail(401, 'login_required', 'Sign in to change account settings');
    const data = await readJson(request);
    const oldPin = pinInput(data.currentPin);
    const newPin = pinInput(data.newPin);
    if (oldPin === newPin) return fail(400, 'same_pin', 'Choose a different PIN');
    if (!await requireRateLimit(env, `pinchange:${signed.agent.id}`, 8, 900)) {
      return fail(429, 'rate_limited', 'Too many attempts. Try again later.');
    }
    const stored = await queryTable<Credential>(env, 'agent_credentials', {
      select: 'pin_hash', agent_id: `eq.${signed.agent.id}`, limit: '1',
    });
    if (!stored[0] || !await verifyPin(oldPin, stored[0].pin_hash, env.PIN_PEPPER!)) {
      return fail(401, 'invalid_credentials', 'Current PIN is incorrect');
    }
    await database(env, 'agent_credentials', {
      method: 'PATCH', query: { agent_id: `eq.${signed.agent.id}` },
      body: { pin_hash: await hashPin(newPin, env.PIN_PEPPER!), changed_at: new Date().toISOString() },
    });
    // Keep this browser signed in; revoke other active sessions.
    await database(env, 'agent_sessions', {
      method: 'PATCH',
      query: { agent_id: `eq.${signed.agent.id}`, id: `neq.${signed.session.id}`, revoked_at: 'is.null' },
      body: { revoked_at: new Date().toISOString() },
    });
    return json({ pinChanged: true });
  }

  return fail(404, 'not_found', 'Route not found');
}
