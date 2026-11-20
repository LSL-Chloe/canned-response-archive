import assert from 'node:assert/strict';
import { test } from 'node:test';
import api from '../worker/index.ts';
import { hashPin, verifyPin, sha256 } from '../worker/auth/crypto.ts';
import { cookieHeader } from '../worker/auth/session.ts';
import {
  canDeleteResponse, canEditResponse, shortcutInput, bodyInput,
  nameInput, pinInput, ApiError,
} from '../worker/api/shared.ts';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test', PIN_PEPPER: '0123456789abcdef0123456789abcdef' };

test('PIN hashes are salted, peppered, unique, and verify only with correct PIN and pepper', async () => {
  const hashed = await hashPin('1234', env.PIN_PEPPER);
  const other = await hashPin('1234', env.PIN_PEPPER);
  const parts = hashed.split('$');
  assert.equal(parts.length, 3);
  assert.equal(parts[0], 'hmac-sha256');
  assert.match(parts[1], /^[a-f0-9]{32}$/);
  assert.match(parts[2], /^[a-f0-9]{64}$/);
  assert.notEqual(hashed, other, 'Per-account salts must differ');
  assert.equal(hashed.includes('1234'), false);
  assert.equal(await verifyPin('1234', hashed, env.PIN_PEPPER), true);
  assert.equal(await verifyPin('1235', hashed, env.PIN_PEPPER), false);
  assert.equal(await verifyPin('1234', hashed, 'wrong-pepper-but-at-least-32-characters'), false);
  assert.equal(await verifyPin('1234', 'bad-hash', env.PIN_PEPPER), false);
  assert.equal(await verifyPin('1234', 'hmac-sha256$bad$bad', env.PIN_PEPPER), false);
  assert.equal(await verifyPin('0042', await hashPin('0042', env.PIN_PEPPER), env.PIN_PEPPER), true);
  assert.equal((await sha256('x')).length, 64);
});

test('PIN hashing never uses unsupported workerd PBKDF2 rounds', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../worker/auth/crypto.ts', import.meta.url), 'utf8');
  assert.equal(src.includes('deriveBits('), false);
  assert.doesNotMatch(src, /310_000/);
});

test('permission matrix: own shared deletion, admin shared edit, private ownership', () => {
  const ownShared = { visibility: 'shared', owner_id: 'a' };
  const otherShared = { visibility: 'shared', owner_id: 'b' };
  const privateOther = { visibility: 'private', owner_id: 'b' };
  assert.equal(canDeleteResponse('agent','a',ownShared), true);
  assert.equal(canDeleteResponse('agent','a',otherShared), false);
  assert.equal(canDeleteResponse('admin','a',otherShared), true);
  assert.equal(canEditResponse('agent','a',ownShared), false);
  assert.equal(canEditResponse('admin','a',otherShared), true);
  assert.equal(canEditResponse('admin','a',privateOther), false);
  assert.equal(canDeleteResponse('admin','a',privateOther), false);
  assert.equal(canEditResponse('agent','b',privateOther), true);
});

test('input validation preserves shortcut semantics', () => {
  assert.equal(shortcutInput('#follow_up'), 'follow_up');
  assert.equal(bodyInput('Valid response'), 'Valid response');
  assert.equal(nameInput('Agent Alice'), 'Agent Alice');
  assert.equal(pinInput('0042'), '0042');
  assert.throws(() => shortcutInput('#bad short cut'), ApiError);
  assert.throws(() => pinInput('01234'), ApiError);
  assert.throws(() => bodyInput(''), ApiError);
  assert.throws(() => nameInput(' A '), ApiError);
});

test('session cookies are HttpOnly, strict, secure on HTTPS', () => {
  const cookie = cookieHeader(new Request('https://app.example.test/api/auth/login'), 'abc');
  assert.match(cookie, /^__Host-archive_session=abc/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  const dev = cookieHeader(new Request('http://localhost:8787/api/auth/login'), 'abc');
  assert.match(dev, /^archive_session_dev=abc/);
  assert.doesNotMatch(dev, /; Secure/);
});

test('health check is accessible while credentials are not configured', async () => {
  const response = await api.fetch(new Request('https://example.test/api/health'), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).databaseConfigured, false);
  const blocked = await api.fetch(new Request('https://example.test/api/auth/me'), {});
  assert.equal(blocked.status, 503);
});

test('backend requires a matching Origin header on all writes', async () => {
  const request = new Request('https://example.test/api/auth/signup', {
    method: 'POST', headers: { Origin: 'https://attacker.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentName: 'Alice', pin: '1234' }),
  });
  const response = await api.fetch(request, env);
  assert.equal(response.status, 403);
});
