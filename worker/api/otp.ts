import { callRpc, database, queryTable, type Env } from '../services/db.ts';
import { hashPin, newOtp, otpDigest } from '../auth/crypto.ts';
import { mailConfigured, sendVerificationEmail, type OtpPurpose } from '../services/mailer.ts';
import { createSession, getSession, ipOf, requireRateLimit } from '../auth/session.ts';
import { fail, json, pinInput, readJson } from './shared.ts';

const OTP_TTL_MS = 10 * 60 * 1000;

interface OtpCompletion {
  ok: boolean;
  action?: 'signup' | 'email' | 'recover_pin';
  agent_id?: string;
  role?: 'admin' | 'agent';
}
interface AgentRow {
  id: string; agent_name: string; role: 'admin' | 'agent';
  email: string | null; email_verified_at: string | null;
  disabled_at?: string | null;
}
export function emailInput(value: unknown): string {
  if (typeof value !== 'string' || value !== value.trim() || value.length > 254 ||
      !/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return fail(400, 'invalid_email', 'Enter a valid email address');
  }
  return value.toLowerCase();
}
export function otpInput(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{6}$/.test(value)) {
    return fail(400, 'invalid_code', 'Enter your six-digit verification code');
  }
  return value;
}
export function challengeInput(value: unknown): string {
  if (typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return fail(400, 'invalid_challenge', 'Invalid or expired verification request');
  }
  return value.toLowerCase();
}
function requireMailer(env: Env): void {
  if (!mailConfigured(env)) fail(503, 'email_unavailable', 'Email verification has not been configured');
}
/** Maximum three OTP send attempts per email/account in a 15-minute fixed window. */
export const OTP_SEND_LIMIT = 3;
export const OTP_SEND_WINDOW_SECONDS = 15 * 60;
/** Keep a separate, broader IP abuse limit independent of the shorter per-target window. */
const OTP_IP_LIMIT = 20;
const OTP_IP_WINDOW_SECONDS = 60 * 60;

/**
 * v2 rate-limit key: old counters were created with one-hour expiry times.
 * The existing Postgres RPC preserves an unexpired counter's original reset_at;
 * using a new namespace starts new 15-minute windows without clearing or
 * weakening the separate IP-wide guard.
 */
export async function throttle(env: Env, request: Request, key: string): Promise<void> {
  const ip = ipOf(request);
  if (!await requireRateLimit(env, `otp:ip:${ip}`, OTP_IP_LIMIT, OTP_IP_WINDOW_SECONDS) ||
      !await requireRateLimit(env, `otp:target:v2:${key}`, OTP_SEND_LIMIT, OTP_SEND_WINDOW_SECONDS)) {
    fail(429, 'rate_limited', 'Too many verification requests. Try again later.');
  }
}
async function removePending(env: Env, challengeId: string, pendingSignupId?: string): Promise<void> {
  try {
    await database(env, 'otp_challenges', { method: 'DELETE', query: { id: `eq.${challengeId}` } });
    if (pendingSignupId) {
      await database(env, 'pending_signups', { method: 'DELETE', query: { id: `eq.${pendingSignupId}` } });
    }
  } catch {
    // An expired unsent challenge is harmless and can be pruned on a later maintenance pass.
  }
}
async function issueChallenge(
  env: Env, email: string, purpose: OtpPurpose, owner: { agentId?: string; pendingSignupId?: string },
): Promise<string> {
  const id = crypto.randomUUID();
  const code = newOtp();
  await database(env, 'otp_challenges', {
    method: 'POST',
    body: {
      id, purpose,
      target_email: email,
      agent_id: owner.agentId ?? null,
      pending_signup_id: owner.pendingSignupId ?? null,
      code_hash: await otpDigest(id, code, env.PIN_PEPPER!),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    },
  });
  try {
    await sendVerificationEmail(env, email, code, purpose);
  } catch (error) {
    await removePending(env, id, owner.pendingSignupId);
    throw error;
  }
  return id;
}
async function complete(
  env: Env, challengeId: unknown, code: unknown,
  actorId: string | null = null, newPinHash: string | null = null,
): Promise<OtpCompletion> {
  const id = challengeInput(challengeId);
  const cleanCode = otpInput(code);
  const hash = await otpDigest(id, cleanCode, env.PIN_PEPPER!);
  return callRpc<OtpCompletion>(env, 'complete_archive_otp', {
    p_challenge_id: id, p_code_hash: hash, p_actor_id: actorId, p_new_pin_hash: newPinHash,
  });
}

/** Email signup never creates a full user until the code is verified. */
export async function beginEmailSignup(
  request: Request, env: Env, agentName: string, pin: string, emailRaw: unknown,
): Promise<Response> {
  requireMailer(env);
  const email = emailInput(emailRaw);
  await throttle(env, request, `signup:${email}`);
  const nameKey = agentName.toLowerCase();
  const [existingName, existingEmail] = await Promise.all([
    queryTable<AgentRow>(env, 'agents', { select: 'id', agent_name_key: `eq.${nameKey}`, limit: '1' }),
    queryTable<AgentRow>(env, 'agents', { select: 'id', email: `eq.${email}`, limit: '1' }),
  ]);
  if (existingName.length || existingEmail.length) {
    return fail(409, 'already_exists', 'Agent name or email is already registered');
  }
  const pendingId = crypto.randomUUID();
  await database(env, 'pending_signups', {
    method: 'POST',
    body: {
      id: pendingId, agent_name: agentName, email,
      pin_hash: await hashPin(pin, env.PIN_PEPPER!),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    },
  });
  let challengeId: string;
  try {
    challengeId = await issueChallenge(env, email, 'signup', { pendingSignupId: pendingId });
  } catch (error) {
    await removePending(env, crypto.randomUUID(), pendingId);
    throw error;
  }
  return json({ verificationRequired: true, challengeId, expiresInSeconds: 600 }, 202);
}

export async function handleOtp(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/api/otp/signup/verify' && request.method === 'POST') {
    const body = await readJson(request);
    if (!await requireRateLimit(env, `otpverify:ip:${ipOf(request)}`, 100, 3600)) {
      return fail(429, 'rate_limited', 'Too many attempts. Try again later');
    }
    const result = await complete(env, body.challengeId, body.code);
    if (!result.ok || result.action !== 'signup' || !result.agent_id) {
      return fail(400, 'invalid_code', 'Invalid or expired verification code');
    }
    const agents = await queryTable<AgentRow>(env, 'agents', {
      select: 'id,agent_name,role', id: `eq.${result.agent_id}`, limit: '1',
    });
    if (!agents[0]) throw new Error('Verified signup account could not be loaded');
    return json({ user: { id: agents[0].id, agent_name: agents[0].agent_name, role: agents[0].role },
      recoveryEmailConfigured: true }, 201, {
      'Set-Cookie': await createSession(env, result.agent_id, request),
    });
  }

  if (path === '/api/otp/email/start' && request.method === 'POST') {
    requireMailer(env);
    const signed = await getSession(env, request);
    if (!signed) return fail(401, 'login_required', 'Sign in to update your email');
    const data = await readJson(request);
    const email = emailInput(data.email);
    await throttle(env, request, `emailchange:${signed.agent.id}`);
    const existing = await queryTable<AgentRow>(env, 'agents', {
      select: 'id,agent_name,role,email,email_verified_at', id: `eq.${signed.agent.id}`, limit: '1',
    });
    const account = existing[0];
    if (!account) return fail(401, 'login_required', 'Account is unavailable');
    if (account.email === email) return fail(400, 'same_email', 'That email is already verified on your account');
    const owner = await queryTable<AgentRow>(env, 'agents', {
      select: 'id', email: `eq.${email}`, limit: '1',
    });
    if (owner.length) return fail(409, 'email_taken', 'That email is already registered');
    const purpose: OtpPurpose = account.email ? 'change_email' : 'add_email';
    const challengeId = await issueChallenge(env, email, purpose, { agentId: signed.agent.id });
    return json({ verificationRequired: true, challengeId, expiresInSeconds: 600 }, 202);
  }

  if (path === '/api/otp/email/verify' && request.method === 'POST') {
    const signed = await getSession(env, request);
    if (!signed) return fail(401, 'login_required', 'Sign in to update your email');
    const data = await readJson(request);
    if (!await requireRateLimit(env, `otpverify:account:${signed.agent.id}`, 40, 3600)) {
      return fail(429, 'rate_limited', 'Too many verification attempts');
    }
    const result = await complete(env, data.challengeId, data.code, signed.agent.id);
    if (!result.ok || result.action !== 'email') {
      return fail(400, 'invalid_code', 'Invalid or expired verification code');
    }
    const agents = await queryTable<AgentRow>(env, 'agents', {
      select: 'email,email_verified_at,id,agent_name,role', id: `eq.${signed.agent.id}`, limit: '1',
    });
    return json({ updated: true, email: agents[0]?.email ?? null, verified: !!agents[0]?.email_verified_at });
  }

  if (path === '/api/otp/recovery/start' && request.method === 'POST') {
    requireMailer(env);
    const body = await readJson(request);
    const email = emailInput(body.email);
    await throttle(env, request, `recovery:${email}`);
    const agents = await queryTable<AgentRow>(env, 'agents', {
      select: 'id,agent_name,role,email_verified_at,disabled_at', email: `eq.${email}`, limit: '1',
    });
    const agent = agents[0];
    // Do not confirm whether the entered email belongs to an account.
    let challengeId = crypto.randomUUID();
    if (agent && agent.email_verified_at && !agent.disabled_at) {
      challengeId = await issueChallenge(env, email, 'recover_pin', { agentId: agent.id });
    }
    return json({ message: 'If a verified account exists, an email has been sent', challengeId, expiresInSeconds: 600 }, 202);
  }

  if (path === '/api/otp/recovery/verify' && request.method === 'POST') {
    const body = await readJson(request);
    const newPin = pinInput(body.newPin);
    if (!await requireRateLimit(env, `recoveryconfirm:ip:${ipOf(request)}`, 50, 3600)) {
      return fail(429, 'rate_limited', 'Too many attempts. Try again later');
    }
    const result = await complete(env, body.challengeId, body.code, null,
      await hashPin(newPin, env.PIN_PEPPER!));
    if (!result.ok || result.action !== 'recover_pin') {
      return fail(400, 'invalid_code', 'Invalid or expired verification code');
    }
    return json({ pinReset: true, message: 'PIN changed. Sign in with your new PIN.' });
  }

  if (path === '/api/account/email' && request.method === 'GET') {
    const signed = await getSession(env, request);
    if (!signed) return fail(401, 'login_required', 'Sign in to view your account');
    const rows = await queryTable<AgentRow>(env, 'agents', {
      select: 'email,email_verified_at,id,agent_name,role', id: `eq.${signed.agent.id}`, limit: '1',
    });
    return json({ email: rows[0]?.email ?? null, verified: !!rows[0]?.email_verified_at });
  }
  return fail(404, 'not_found', 'Route not found');
}
