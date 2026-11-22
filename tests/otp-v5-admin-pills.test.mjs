import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('admin subpages share a single sliding selected-state glass pill', () => {
  const app = source('src/features/archive/ArchiveApp.tsx');
  const css = source('src/styles/premium.css');
  assert.match(app, /className="archive-admin-subnav-lens"/);
  assert.match(app, /'--admin-subtab': page === 'agents' \? 1 : 0/);
  assert.match(app, /className=\{page === 'team' \? 'active' : ''\}/);
  assert.match(app, /className=\{page === 'agents' \? 'active' : ''\}/);
  assert.match(css, /\.archive-admin-subnav \.archive-admin-subnav-lens\{/);
  assert.match(css, /var\(--admin-subtab,0\) \* 35px/);
  assert.match(css, /\.archive-admin-subnav\.no-selection \.archive-admin-subnav-lens\{opacity:0\}/);
  assert.match(css, /\.archive-admin-subnav \.archive-admin-subnav-lens-fill/);
  assert.doesNotMatch(css, /--hover-slot|--hover-visible/, 'No additional hover-only pill');
  assert.match(css, /\.archive-nav \.archive-admin-subnav button:hover/);
});

test('Claude OTP v5 component retains controlled six-digit input and server-only success', () => {
  const otp = source('src/features/auth/OtpVisual.tsx');
  const auth = source('src/features/auth/AuthPage.tsx');
  const settings = source('src/features/archive/SettingsWorkspace.tsx');
  assert.match(otp, /'\.\.\/\.\.\/styles\/otp-v5\.css'/);
  assert.match(otp, /className=\{'otp-orbit otp5'/);
  assert.match(otp, /verified \? 1 : Math\.max/);
  assert.match(otp, /otp5-frame/);
  assert.match(otp, /otp5-tick/);
  assert.match(otp, /otp5-pip/);
  assert.match(otp, /key=\{digits\} className="otp5-ping"/);
  assert.match(otp, /verified && <span className="otp5-wave"/);
  assert.match(otp, /pathLength=\{1\}/);
  assert.match(otp, /value=\{value\} onChange=\{event => onChange/);
  assert.match(otp, /autoComplete="one-time-code"/);
  assert.match(otp, /maxLength=\{6\}/);
  assert.match(otp, /replace\(\/\\D\/g, ''\)\.slice\(0, 6\)/);
  assert.match(auth, /if \(!data\.user\) throw new Error\('Verification did not return an account\.'\)/);
  assert.match(auth, /if \(!data\.pinReset\) throw new Error\('PIN recovery was not confirmed\.'\)/);
  assert.match(auth, /<OtpRing progress=\{1\} verified\/>/);
  assert.match(settings, /<OtpRing progress=\{code\.length \/ 6\}/);
});

test('OTP v5 progress, completion and motion fallback remain available in both modes', () => {
  const css = source('src/styles/otp-v5.css');
  assert.match(css, /\.otp-orbit\.otp5 \.otp-progress-value/);
  assert.match(css, /stroke-dashoffset: calc\(377px \* \(1 - var\(--otp-progress, 0\)\)\)/);
  assert.match(css, /\.otp-orbit\.otp5\.otp-orbit-success \.otp5-check path/);
  assert.match(css, /@keyframes otp5-draw/);
  assert.match(css, /@keyframes otp5-wave/);
  assert.match(css, /--otp5-green: var\(--ui-success/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.otp5-ping, \.otp5-wave \{ display: none; \}/);
  assert.doesNotMatch(css, /url\(https?:\/\//);
});
