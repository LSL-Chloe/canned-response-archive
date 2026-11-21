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


test('background ripples do not start accidental text selection', () => {
  const layer = read('public/liquid-glass.js');
  assert.match(layer, /D\.addEventListener\('selectstart'/, 'Only prevent a selection started from the background');
  assert.match(layer, /backgroundPointer!==null/, 'Normal direct text selection must not be blocked');
  assert.match(layer, /e\.pointerType==='mouse'/, 'Preserve normal touch selection and mobile gestures');
  assert.match(layer, /!target\.closest\(selectableOrControl\)/, 'Exclude text and controls from background gestures');
  assert.match(layer, /h1,h2,h3,h4,h5,h6,p,span,kbd/, 'Text must remain selectable when directly targeted');
  assert.match(layer, /addEventListener\('pointerup',releaseBackground/, 'Release selection suppression at gesture end');
  assert.match(layer, /addEventListener\('pointercancel',releaseBackground/, 'Release selection suppression on cancellation');
  assert.match(layer, /if\(blank\)\{ks\.set/, 'Ripples only come from a background click');
  assert.doesNotMatch(layer, /user-select:none!important/, 'Do not disable text selection globally');
});

test('lighter preview lenses track hover and keyboard focus without navigating', () => {
  const css = read('src/styles/premium.css');
  const nav = read('src/features/archive/ArchiveApp.tsx');
  const lib = read('src/features/archive/LibraryWorkspace.tsx');
  const auth = read('src/features/auth/AuthPage.tsx');
  const transfer = read('src/features/archive/TransferWorkspace.tsx');
  for (const [group, last] of [
    ['archive-nav', 3], ['archive-tabs', 4],
    ['archive-visibility-options', 2], ['archive-transfer-scope', 2],
    ['auth-mode-tabs', 2],
  ]) {
    assert.ok(css.includes(group + ':has(>button:nth-of-type(' + last + ')'),
      'Hover preview needs a slot for ' + group);
  }
  assert.match(css, /:is\(:hover,:focus-visible\):not\(\.active\):not\(:disabled\)/);
  assert.match(css, /--hover-visible,0/, 'No ghost preview without pointer or keyboard hover');
  assert.match(css, /--hover-slot,0/, 'Preview should slide between options');
  assert.match(css, /\.archive-app \.archive-sidebar\{border-radius:0 19px 19px 0\}/);
  assert.match(css, /\.archive-app \.archive-topbar\{border-radius:0 0 17px 17px\}/);
  assert.match(css, /is-sidebar-collapsed \.archive-nav button\{[\s\S]*?justify-content:center/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  // Preview is CSS-only; the existing click-selected glass lens stays in place.
  assert.match(nav, /<Glass className="archive-nav-selection"/);
  assert.match(lib, /<Glass className="archive-tabs-lens"/);
  assert.match(lib, /<Glass className="archive-visibility-lens"/);
  assert.match(transfer, /<Glass className="archive-visibility-lens"/);
  assert.match(auth, /<Glass className="auth-tabs-lens"/);
});
