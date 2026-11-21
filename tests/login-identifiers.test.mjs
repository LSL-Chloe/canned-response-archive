import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginIdentifierInput, handleAuth } from '../worker/api/auth.ts';
import { hashPin, hmac } from '../worker/auth/crypto.ts';
import { ApiError } from '../worker/api/shared.ts';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  PIN_PEPPER: '1234567890abcdef1234567890abcdef',
};
const agent = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  agent_name: 'Agent One',
  role: 'agent',
  disabled_at: null,
  email_verified_at: '2026-11-21T19:00:00.000Z',
};
const credentials = { pin_hash: await hashPin('0042', env.PIN_PEPPER) };

function loginRequest(body) {
  return new Request('https://archive.example/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.111' },
    body: JSON.stringify(body),
  });
}

async function withFakeDatabase(verified, callback) {
  const oldFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    const route = parsed.pathname;
    seen.push({ route, query: parsed.searchParams, body: init.body ? JSON.parse(init.body) : null });
    if (route === '/rest/v1/rpc/use_rate_limit') return Response.json(true);
    if (route === '/rest/v1/agents') {
      const byEmail = parsed.searchParams.has('email');
      if (byEmail) {
        assert.equal(parsed.searchParams.get('email_verified_at'), 'not.is.null');
        return Response.json(verified && parsed.searchParams.get('email') === 'eq.agent@example.com'
          ? [agent] : []);
      }
      return Response.json(parsed.searchParams.get('agent_name_key') === 'eq.agent one'
        ? [agent] : []);
    }
    if (route === '/rest/v1/agent_credentials') return Response.json([credentials]);
    if (route === '/rest/v1/agent_sessions') return Response.json([{}]);
    throw new Error('Unexpected database call: ' + route);
  };
  try { await callback(seen); }
  finally { globalThis.fetch = oldFetch; }
}

test('login identifiers preserve existing agent names and normalize verified emails', () => {
  assert.deepEqual(loginIdentifierInput('Agent One'), { kind: 'name', key: 'agent one' });
  assert.deepEqual(loginIdentifierInput('AGENT@EXAMPLE.COM'), { kind: 'email', key: 'agent@example.com' });
  assert.throws(() => loginIdentifierInput(' agent@example.com'), ApiError);
  assert.throws(() => loginIdentifierInput('not-really@'), ApiError);
  assert.throws(() => loginIdentifierInput('x'.repeat(255)), ApiError);
});

test('a verified email signs into the original account using the same PIN', async () => {
  await withFakeDatabase(true, async seen => {
    const result = await handleAuth(loginRequest({ identifier: 'AGENT@EXAMPLE.COM', pin: '0042' }), env, '/api/auth/login');
    assert.equal(result.status, 200);
    assert.equal((await result.json()).user.id, agent.id);
    assert.match(result.headers.get('Set-Cookie') ?? '', /HttpOnly; SameSite=Strict/);
    const lookup = seen.find(x => x.route === '/rest/v1/agents');
    assert.equal(lookup.query.get('email'), 'eq.agent@example.com');
    assert.equal(lookup.query.get('email_verified_at'), 'not.is.null');
    const rate = seen.filter(x => x.route.endsWith('/use_rate_limit')).map(x => x.body.p_key_hash);
    assert.ok(rate.includes(await hmac('login:account:id:' + agent.id, env.PIN_PEPPER)));
    assert.ok(rate.includes(await hmac('login:ip:192.0.2.111', env.PIN_PEPPER)));
  });
});

test('agent-name and email sign-ins share one per-account PIN-attempt bucket', async () => {
  await withFakeDatabase(true, async seen => {
    const nameLogin = await handleAuth(loginRequest({ agentName: 'Agent One', pin: '9999' }), env, '/api/auth/login');
    const emailLogin = await handleAuth(loginRequest({ identifier: 'agent@example.com', pin: '9999' }), env, '/api/auth/login');
    assert.equal(nameLogin.status, 401);
    assert.equal(emailLogin.status, 401);
    assert.equal((await nameLogin.json()).message, (await emailLogin.json()).message);
    const key = await hmac('login:account:id:' + agent.id, env.PIN_PEPPER);
    const count = seen.filter(x => x.route.endsWith('/use_rate_limit') && x.body.p_key_hash === key).length;
    assert.equal(count, 2);
  });
});

test('unverified or unrecognized email cannot log in and never reveals account details', async () => {
  await withFakeDatabase(false, async seen => {
    const response = await handleAuth(loginRequest({ identifier: 'agent@example.com', pin: '0042' }), env, '/api/auth/login');
    assert.equal(response.status, 401);
    assert.equal((await response.json()).message, 'Invalid agent name, email or PIN');
    assert.equal(seen.some(x => x.route === '/rest/v1/agent_credentials'), false);
    const nameResponse = await handleAuth(loginRequest({ agentName: 'Agent One', pin: '0042' }), env, '/api/auth/login');
    assert.equal(nameResponse.status, 200, 'old agent-name login must still work without a verified email');
  });
});
