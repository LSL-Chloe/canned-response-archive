import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('proper login, signup and recovery UI uses the existing backend and keeps QA fallback', () => {
  const app = read('src/App.tsx');
  const auth = read('src/features/auth/AuthPage.tsx');
  assert.match(app, /path === '\/auth'/);
  assert.match(app, /\/dev\/auth-test/);
  for (const path of ['/api/auth/me','/api/auth/login','/api/auth/signup',
    '/api/auth/logout','/api/otp/signup/verify',
    '/api/otp/recovery/start','/api/otp/recovery/verify']) {
    assert.ok(auth.includes(path), `Missing endpoint ${path}`);
  }
  assert.match(auth, /[0-9]\{6\}/);
  assert.match(auth, /autoComplete="one-time-code"/);
  assert.match(auth, /OTP_SECONDS = 10 \* 60/);
  assert.doesNotMatch(auth, /console\.log|SUPABASE_SECRET_KEY|PIN_PEPPER|OTP_MAILER_SECRET/);
});

test('theme is explicit, persistent and accessible in both surfaces', () => {
  const theme = read('src/ui/theme.ts');
  const toggle = read('src/ui/ThemeToggle.tsx');
  const css = read('src/styles/premium.css');
  assert.match(theme, /archive:appearance/);
  assert.match(theme, /prefers-color-scheme/);
  assert.match(toggle, /aria-label/);
  assert.match(toggle, /@samasante\/liquid-glass/);
  assert.match(css, /data-theme="dark"/);
  assert.match(css, /data-theme="light"/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /prefers-reduced-transparency:reduce/);
  assert.match(css, /prefers-contrast:more/);
  assert.match(css, /\.otp-progress-value/);
  assert.match(css, /\.otp-orbit-success/);
});

test('premium UI preserves the search, library and admin functionality', () => {
  const app = read('src/features/archive/ArchiveApp.tsx');
  for (const feature of ['SearchWorkspace','LibraryWorkspace','SettingsWorkspace','TeamWorkspace',
    'fetchFeed','onRequireLogin','sidebarCollapsed']) {
    assert.ok(app.includes(feature), `Missing ${feature}`);
  }
  assert.match(app, /<ThemeToggle/);
  assert.match(app, /data-theme=\{theme\}/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['@samasante/liquid-glass'], '0.1.1');
});
