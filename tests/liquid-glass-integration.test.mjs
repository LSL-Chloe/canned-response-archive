import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('uploaded liquid-glass layer is loaded without replacing the original theme switch', () => {
  const html = read('index.html');
  const layer = read('public/liquid-glass.js');
  const themeToggle = read('src/ui/ThemeToggle.tsx');
  const app = read('src/features/archive/ArchiveApp.tsx');
  assert.match(html, /<script defer src="\/liquid-glass\.js"><\/script>/);
  assert.match(layer, /REACTIVE 3D BACKGROUND/);
  assert.match(layer, /prefers-reduced-motion:reduce/);
  assert.match(layer, /webglcontextlost/);
  assert.match(layer, /ud\+=\(dk-ud\)/, 'Preserve original gradual background theme blending');
  assert.doesNotMatch(layer, /startViewTransition|sw\.click\(\)/, 'Do not intercept React theme-toggle clicks');
  assert.match(themeToggle, /role="switch"/);
  assert.match(app, /<ThemeToggle/);
  assert.doesNotThrow(() => new Function(layer), 'Uploaded visual script must parse');
});

test('copy shortcut copies an unselected full draft without overriding selection copying', () => {
  const search = read('src/features/archive/SearchWorkspace.tsx');
  assert.match(search, /onCopy=\{onCopyDraft\}/);
  assert.match(search, /selectionStart !== event\.currentTarget\.selectionEnd/);
  assert.match(search, /event\.clipboardData\.setData\('text\/plain', draft\)/);
  assert.match(search, /event\.preventDefault\(\)/);
  assert.match(search, /async function copyDraft\(\)/, 'Keep existing copy button');
  assert.match(search, /<kbd>C<\/kbd> copy/);
});
