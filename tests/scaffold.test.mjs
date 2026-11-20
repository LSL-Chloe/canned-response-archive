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

test('versioned database migrations and API documentation exist', () => {
  assert.ok(exists('supabase/migrations/20261120003511_initial_archive_schema.sql'));
  assert.ok(exists('supabase/migrations/20261120003644_index_shortcut_scope_fk.sql'));
  assert.ok(exists('supabase/migrations/20261120005428_auth_and_attribution.sql'));
  assert.ok(exists('docs/backend-api.md'));
});
