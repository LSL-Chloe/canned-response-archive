import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Vite stays on a patched compatible major version', () => {
  const pkg = JSON.parse(source('package.json'));
  assert.equal(pkg.devDependencies.vite, '^7.3.8');
  assert.match(pkg.engines.node, /22/);
});

test('security checks scan history and report production and build-tool advisories separately', () => {
  const workflow = source('.github/workflows/security-audit.yml');
  const scan = source('scripts/scan-history.mjs');
  const report = source('scripts/report-dependency-audit.mjs');
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /refs\/pull\/\*\/head/);
  assert.match(workflow, /node scripts\/scan-history\.mjs/);
  assert.match(workflow, /npm audit --json --omit=dev/);
  assert.match(workflow, /npm audit --json > all-audit\.json/);
  assert.match(scan, /Private key header/);
  assert.match(scan, /Potential credential findings/);
  assert.match(report, /High\/critical production dependency advisory/);
  assert.doesNotMatch(workflow, /contents: write/);
});

test('reproducible installs are used in both CI workflows', () => {
  const lock = JSON.parse(source('package-lock.json'));
  const pkg = JSON.parse(source('package.json'));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.name, pkg.name);
  assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
  assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
  assert.match(source('.github/workflows/ci.yml'), /npm ci --no-audit --no-fund/);
  assert.match(source('.github/workflows/security-audit.yml'), /npm ci --ignore-scripts --no-fund --no-audit/);
  assert.doesNotMatch(source('.github/workflows/ci.yml'), /npm install/);
});

test('avatar account request reuses the already loaded API module', () => {
  const app = source('src/features/archive/ArchiveApp.tsx');
  assert.match(app, /import \{ api, ApiProblem,/);
  assert.doesNotMatch(app, /import\('\.\/api'\)/);
});
