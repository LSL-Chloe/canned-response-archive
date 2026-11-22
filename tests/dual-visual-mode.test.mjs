import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('only original and fallback presentation modes exist, independent of renderer APIs', () => {
  const js = read('public/liquid-glass.js');
  assert.match(js, /const visualMode=\(env,mode,renderer\)=>/);
  assert.match(js, /R\.dataset\.visualMode=mode/);
  assert.match(js, /env\.dataset\.visualMode=mode/);
  assert.match(js, /visualMode\(env,'original',kind\)/);
  assert.match(js, /visualMode\(env,'fallback','lines'\)/);
  assert.doesNotMatch(js, /bg2d\(|canvasUnavailable|visualMode\(env,'fallback','canvas2d'\)/);
  assert.doesNotMatch(js, /visualMode\(env,'(?:low|medium|high|simple|legacy)'/);
  assert.match(js, /for\(const candidate of \['webgl2','webgl'\]\)/);
  assert.match(js, /if\(!G\)visualMode\(env,'fallback','lines'\)/);
});

test('full original glass controls, rim lighting and spring animations apply to both backgrounds', () => {
  const js = read('public/liquid-glass.js');
  assert.match(js, /\.liquid-theme-switch \.liquid-switch-thumb\{transition:transform \.58s/);
  assert.match(js, /\.archive-nav-selection,\.archive-tabs-lens,\.auth-tabs-lens,\.archive-visibility-lens\{transition:transform/);
  assert.match(js, /\.liquid-action:hover,\.archive-button:hover,\.archive-sign-in-link:hover/);
  assert.match(js, /\[data-liquid-glass\]::after,\[data-lgx\]::after\{content:""/);
  assert.doesNotMatch(js, /html\[data-lg="0"\] \[data-liquid-glass\]::after/,
    'Low-memory devices must not get a different glass-rim design');
  assert.doesNotMatch(js, /if\(!lens&&tier<2\)/,
    'Attempt the original optical lens independently of GPU performance estimates');
  assert.match(js, /try\{apply\(t\)\}catch\{t\.style\.removeProperty\('--lg-bf'\)\}/,
    'Failed refraction must never kill the common UI animation layer');
});

test('fallback restores only the approved lined background, never alternate controls', () => {
  const css = read('src/styles/premium.css');
  const js = read('public/liquid-glass.js');
  assert.match(css, /--fallback-base:#0c0d11/);
  assert.match(css, /--fallback-base:#e6e8eb/);
  assert.match(css, /repeating-linear-gradient\(0deg,transparent 0 7px,var\(--fallback-line\)/);
  assert.match(css, /repeating-linear-gradient\(90deg,transparent 0 7px,var\(--fallback-line-2\)/);
  assert.match(css, /data-ambient-mode="pending"/);
  assert.match(js, /visualMode\(env,'original',kind\)/);
  assert.match(js, /visualMode\(env,'fallback','lines'\)/);
  assert.doesNotMatch(js, /data\.visualMode===.*(?:button|toggle|nav)/);
});

test('Cloudflare revalidates the document and unbundled visual script', () => {
  const headers = read('public/_headers');
  const html = read('index.html');
  assert.match(html, /src="\/liquid-glass\.js\?v=original-glass-20261122-3"/);
  assert.match(headers, /\/liquid-glass\.js\s+Cache-Control: no-store/);
  assert.match(headers, /\/index\.html\s+Cache-Control: no-store/);
  assert.match(headers, /\/\s+Cache-Control: no-store/);
  assert.doesNotMatch(headers, /\/api\//, 'Never overwrite API caching with static asset rules');
});
