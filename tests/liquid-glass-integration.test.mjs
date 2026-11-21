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
  assert.match(layer, /const initialDark=readDark\(\)/, 'Initialize WebGL with the visible React theme');
  assert.match(layer, /const nextDark=readDark\(\)/, 'Read each rendered frame for immediate theme response');
  assert.doesNotMatch(layer, /n\+\+%30/, 'Do not poll theme only once every 30 frames');
  assert.match(layer, /\(now-changeAt\)\/580/, 'Match background interpolation to the theme thumb duration');
  assert.match(layer, /ud=fromDark\+\(dk-fromDark\)\*eased/, 'Retarget smoothly on rapid repeated toggles');
  assert.match(layer, /\.archive-app \.archive-topbar\{transition:background-color \.58s/, 'Crossfade topbar color with background');
  assert.match(layer, /prefers-reduced-motion:reduce/);
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
