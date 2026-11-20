import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('QA route is separate from the planned homepage', () => {
  const app = read('src/App.tsx');
  assert.match(app, /\/dev\/auth-test/);
  assert.match(app, /ArchiveApp/);
});

test('QA form uses same-origin requests and existing auth endpoints', () => {
  const page = read('src/features/auth/DevAuthTest.tsx');
  for (const endpoint of ['/api/auth/signup', '/api/otp/signup/verify',
    '/api/auth/login', '/api/auth/logout', '/api/auth/me',
    '/api/otp/recovery/start', '/api/otp/recovery/verify']) {
    assert.ok(page.includes(endpoint), `Missing route ${endpoint}`);
  }
  assert.match(page, /credentials: 'same-origin'/);
  assert.match(page, /inputMode="numeric"/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|console\.log/);
});

test('Deployment targets the existing Cloudflare Worker', () => {
  assert.equal(JSON.parse(read('wrangler.jsonc')).name, 'canned-response-archive');
});
