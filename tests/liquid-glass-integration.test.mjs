import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('uploaded liquid-glass layer is loaded without replacing the original theme switch', () => {
  const html = read('index.html');
  const layer = read('public/liquid-glass.js');
  const themeToggle = read('src/ui/ThemeToggle.tsx');
  const app = read('src/features/archive/ArchiveApp.tsx');
  assert.match(html, /<script defer src="\/liquid-glass\.js\?v=original-glass-20261122-3"><\/script>/);
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

test('only active selection lenses remain across navigation and option groups', () => {
  const css = read('src/styles/premium.css');
  const nav = read('src/features/archive/ArchiveApp.tsx');
  const lib = read('src/features/archive/LibraryWorkspace.tsx');
  const auth = read('src/features/auth/AuthPage.tsx');
  const transfer = read('src/features/archive/TransferWorkspace.tsx');

  // Do not accidentally reintroduce the mouse-following second glass pill.
  assert.doesNotMatch(css, /--hover-slot|--hover-visible/);
  for (const group of [
    'archive-nav', 'archive-tabs', 'archive-visibility-options',
    'archive-transfer-scope', 'auth-mode-tabs',
  ]) {
    assert.ok(!css.includes(group + ':has(>button:nth-of-type(1):is(:hover,:focus-visible)'),
      'No duplicate pointer preview on ' + group);
    assert.ok(!css.includes(group + ':has(>button:nth-of-type(2):is(:hover,:focus-visible)'),
      'No duplicate keyboard/pointer preview on ' + group);
    assert.ok(!css.includes(group + '::before'),
      'No ghost overlay pseudo-element on ' + group);
  }

  // Preserve the selected-state lenses and the continuous header/sidebar seam.
  assert.match(css, /\.archive-app \.archive-sidebar,\.archive-app \.archive-topbar\{border-radius:0\}/);
  assert.match(css, /--shell-header-height:62px/);
  assert.match(css, /--shell-header-height:59px/);
  assert.match(css, /\.archive-app \.archive-sidebar::before\{/);
  assert.match(css, /is-sidebar-collapsed \.archive-nav button\{[\s\S]*?justify-content:center/);
  assert.match(css, /\.archive-app \.archive-nav button:hover\{color:var\(--a-text\)\}/);
  assert.match(nav, /<Glass className="archive-nav-selection"/);
  assert.match(lib, /<Glass className="archive-tabs-lens"/);
  assert.match(lib, /<Glass className="archive-visibility-lens"/);
  assert.match(transfer, /<Glass className="archive-visibility-lens"/);
  assert.match(auth, /<Glass className="auth-tabs-lens"/);
});
