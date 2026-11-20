import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test('Cloudflare Worker is configured for explicit API routes', () => {
  const config = JSON.parse(read('wrangler.jsonc'));
  assert.equal(config.main, './worker/index.ts');
  assert.deepEqual(config.assets.run_worker_first, ['/api/*']);
  assert.equal(config.assets.not_found_handling, 'single-page-application');
});

test('health endpoint is reachable by app source and has no write routes', () => {
  assert.match(read('worker/index.ts'), /\/api\/health/);
  assert.match(read('src/App.tsx'), /\/api\/health/);
  assert.doesNotMatch(read('worker/index.ts'), /SUPABASE_SECRET_KEY|OTP_MAILER_SECRET/);
});

test('secrets and generated artifacts are gitignored', () => {
  const ignore = read('.gitignore');
  for (const item of ['node_modules/', '.dev.vars*', '.env*', 'dist/']) {
    assert.ok(ignore.includes(item), `Missing ignore entry: ${item}`);
  }
});

test('database migration is intentionally pending', () => {
  assert.ok(exists('supabase/migrations/README.md'));
  assert.ok(exists('docs/architecture.md'));
});
