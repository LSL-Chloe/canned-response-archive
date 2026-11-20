import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emailInput, challengeInput, otpInput, throttle, OTP_SEND_LIMIT, OTP_SEND_WINDOW_SECONDS } from '../worker/api/otp.ts';
import { hmac, newOtp, otpDigest } from '../worker/auth/crypto.ts';
import { mailConfigured, sendVerificationEmail } from '../worker/services/mailer.ts';
import { ApiError } from '../worker/api/shared.ts';

const configured = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  PIN_PEPPER: '0123456789abcdef0123456789abcdef',
  OTP_MAILER_URL: 'https://script.google.com/macros/s/example/exec',
  OTP_MAILER_SECRET: 'abcdefghijklmnopqrstuvwxyz12345678901234567890',
};

test('Email addresses normalize, but invalid addresses are rejected', () => {
  assert.equal(emailInput('Agent@Example.Com'), 'agent@example.com');
  assert.equal(emailInput('agent+test@zimbra.example.org'), 'agent+test@zimbra.example.org');
  assert.throws(() => emailInput('incomplete@'), ApiError);
  assert.throws(() => emailInput('bad mail@example.com'), ApiError);
});

test('OTP generation produces a six-digit numeric code, preserving leading zeros', () => {
  for (let i = 0; i < 200; i += 1) assert.match(newOtp(), /^\d{6}$/);
  assert.equal(otpInput('000042'), '000042');
  assert.throws(() => otpInput('12345'), ApiError);
  assert.throws(() => otpInput('1234567'), ApiError);
  assert.equal(challengeInput('123e4567-e89b-12d3-a456-426614174000'),
    '123e4567-e89b-12d3-a456-426614174000');
});

test('OTP digest is keyed, bound to challenge ID and not plaintext', async () => {
  const one = await otpDigest('123e4567-e89b-12d3-a456-426614174000', '000042', configured.PIN_PEPPER);
  const two = await otpDigest('123e4567-e89b-12d3-a456-426614174000', '000043', configured.PIN_PEPPER);
  const three = await otpDigest('123e4567-e89b-12d3-a456-426614174001', '000042', configured.PIN_PEPPER);
  assert.match(one, /^[0-9a-f]{64}$/);
  assert.notEqual(one, two);
  assert.notEqual(one, three);
  assert.equal(one.includes('000042'), false);
});

test('Mailer can only run when URL and shared secret are set', () => {
  assert.equal(mailConfigured(configured), true);
  assert.equal(mailConfigured({ ...configured, OTP_MAILER_SECRET: '' }), false);
  assert.equal(mailConfigured({ ...configured, OTP_MAILER_URL: 'http://example.org' }), false);
});

test('Mailer signs exactly the JSON payload it sends and does not expose secrets', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    assert.equal(init.headers['Content-Type'], 'text/plain; charset=utf-8');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    await sendVerificationEmail(configured, 'agent@example.com', '000042', 'recover_pin');
    assert.equal(captured.signature, await hmac(captured.payload, configured.OTP_MAILER_SECRET));
    const payload = JSON.parse(captured.payload);
    assert.equal(payload.to, 'agent@example.com');
    assert.equal(payload.code, '000042');
    assert.equal(payload.purpose, 'recover_pin');
    assert.match(payload.nonce, /^[0-9a-f]{64}$/);
    assert.ok(Math.abs(Date.now() - payload.issuedAt) < 30000);
    assert.equal(captured.payload.includes(configured.OTP_MAILER_SECRET), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Mailer fails closed when relay refuses the request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 200 });
  try {
    await assert.rejects(
      sendVerificationEmail(configured, 'agent@example.com', '000042', 'signup'),
      (error) => error instanceof ApiError && error.status === 503,
    );
  } finally { globalThis.fetch = originalFetch; }
});

test('OTP requests permit three per target per 15 minutes, preserving separate IP limit', async () => {
  assert.equal(OTP_SEND_LIMIT, 3);
  assert.equal(OTP_SEND_WINDOW_SECONDS, 900);
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/use_rate_limit');
    calls.push(JSON.parse(init.body));
    return Response.json(true);
  };
  try {
    const request = new Request('https://archive.example/api/auth/signup', {
      headers: { 'CF-Connecting-IP': '192.0.2.12' },
    });
    await throttle(configured, request, 'signup:agent@example.com');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(({ p_limit, p_window_seconds }) => [p_limit, p_window_seconds]),
      [[20, 3600], [3, 900]]);
    assert.equal(calls[1].p_key_hash,
      await hmac('otp:target:v2:signup:agent@example.com', configured.PIN_PEPPER));
    assert.equal(calls[0].p_key_hash,
      await hmac('otp:ip:192.0.2.12', configured.PIN_PEPPER));
  } finally {
    globalThis.fetch = original;
  }
});

test('OTP per-target throttle rejects additional requests without contacting Gmail', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json(calls === 1);
  };
  try {
    const request = new Request('https://archive.example/api/auth/signup');
    await assert.rejects(
      throttle(configured, request, 'signup:agent@example.com'),
      (error) => error instanceof ApiError && error.status === 429 && error.code === 'rate_limited',
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
