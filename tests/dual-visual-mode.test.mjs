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
  assert.match(js, /visualMode\(env,'fallback','canvas2d'\)/);
  assert.match(js, /visualMode\(env,'fallback','gradient'\)/);
  assert.doesNotMatch(js, /visualMode\(env,'(?:low|medium|high|simple|legacy)'/);
  assert.match(js, /for\(const candidate of \['webgl2','webgl'\]\)/);
  assert.match(js, /if\(!G&&!canvasUnavailable\)G=bg2d\(env\)/);
});

test('full original glass controls, rim lighting and spring animations apply to both backgrounds', () => {
  const js = read('public/liquid-glass.js');
  assert.match(js, / \.liquid-theme-switch \.liquid-switch-thumb\{transition:transform \.58s/);
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

test('the currently committed fallback cannot draw the old monochrome line grid', () => {
  for (const p of ['src/styles/premium.css','src/styles/base.css','src/features/archive/archive.css','public/liquid-glass.js']) {
    const s = read(p);
    assert.doesNotMatch(s, /repeating-linear-gradient\(/, p + ' may not restore the abandoned grid');
  }
  const css = read('src/styles/premium.css');
  assert.match(css, /--ambient-blue:rgba\(76,101,193,\.30\)/);
  assert.match(css, /--ambient-violet:rgba\(105,74,156,\.20\)/);
  assert.match(css, /\.optical-weave\{[\s\S]*background:\s*radial-gradient/);
});

test('Cloudflare revalidates the document and unbundled visual script', () => {
  const headers = read('public/_headers');
  const html = read('index.html');
  assert.match(html, /src="\/liquid-glass\.js\?v=original-glass-20261122-2"/);
  assert.match(headers, /\/liquid-glass\.js\s+Cache-Control: no-store/);
  assert.match(headers, /\/index\.html\s+Cache-Control: no-store/);
  assert.match(headers, /\/\s+Cache-Control: no-store/);
  assert.doesNotMatch(headers, /\/api\//, 'Never overwrite API caching with static asset rules');
});
