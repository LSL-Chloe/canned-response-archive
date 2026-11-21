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
  // Workers Builds invokes `wrangler preview` on PR branches. Missing this
  // block makes every Cloudflare branch build fail even when main deploys fine.
  assert.deepEqual(config.previews, {});
  assert.equal(JSON.stringify(config.previews).includes('SECRET'), false);
});

test('health endpoint exists and archive reads responses only through same-origin API', () => {
  assert.match(read('worker/index.ts'), /\/api\/health/);
  assert.match(read('src/features/archive/api.ts'), /\/api\/responses/);
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

test('dependency updates avoid major-version noise and both stable branches run CI', () => {
  const dependabot = read('.github/dependabot.yml');
  const ci = read('.github/workflows/ci.yml');
  const security = read('.github/workflows/security-audit.yml');
  const pruner = read('.github/workflows/prune-merged-branches.yml');
  assert.equal((dependabot.match(/version-update:semver-major/g) ?? []).length, 2);
  assert.match(ci, /branches: \[main, develop\]/);
  assert.match(security, /branches: \[main, develop\]/);
  assert.match(ci, /pull_request:/);
  assert.match(pruner, /\$branch" != "main" && "\$branch" != "develop"/);
  assert.ok(exists('docs/staging-and-releases.md'));
});
