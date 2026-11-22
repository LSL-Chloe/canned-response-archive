import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('the approved violet/blue ambient background survives loss of WebGL', () => {
  const css = read('src/styles/premium.css');
  const backdrop = read('src/ui/OpticalBackdrop.tsx');
  const field = css.slice(css.indexOf('/* Restored atmospheric field:'), css.indexOf('@keyframes optical-weave-drift'));
  assert.match(field, /--ambient-blue:rgba\(76,101,193,\.30\)/);
  assert.match(field, /--ambient-violet:rgba\(105,74,156,\.20\)/);
  assert.match(field, /--ambient-rose:rgba\(145,79,131,\.24\)/);
  assert.match(field, /--ambient-blue:rgba\(133,153,227,\.24\)/);
  assert.match(field, /--ambient-rose:rgba\(214,166,200,\.20\)/);
  assert.match(field, /background:\s*radial-gradient\(ellipse 75% 93%/);
  assert.match(field, /\.optical-weave\{[\s\S]*background:\s*radial-gradient/);
  assert.doesNotMatch(field, /repeating-linear-gradient/, 'Do not restore the monochrome grid');
  assert.match(backdrop, /className="optical-environment"/);
  assert.match(backdrop, /className="optical-weave"/);
});

test('light/dark fallback tracks the original 580ms thumb without introducing a second theme switch', () => {
  const css = read('src/styles/premium.css');
  const layer = read('public/liquid-glass.js');
  const toggle = read('src/ui/ThemeToggle.tsx');
  assert.match(css, /@property --a-bg\{syntax:"<color>";inherits:true/);
  assert.match(css, /@property --caustic\{syntax:"<color>";inherits:true/);
  assert.match(css, /@property --caustic-edge\{syntax:"<color>";inherits:true/);
  assert.match(css, /@property --ambient-blue\{syntax:"<color>";inherits:true/);
  assert.match(css, /@property --ambient-violet\{syntax:"<color>";inherits:true/);
  assert.match(css, /@property --ambient-rose\{syntax:"<color>";inherits:true/);
  assert.match(layer, /transition:color \.58s ease,--a-bg \.58s ease,--caustic \.58s ease,--caustic-edge \.58s ease,--ambient-blue \.58s ease,--ambient-violet \.58s ease,--ambient-rose \.58s ease/);
  assert.match(layer, /const initialDark=readDark\(\)/);
  assert.match(layer, /const nextDark=readDark\(\)/);
  assert.match(layer, /\(now-changeAt\)\/580/);
  assert.match(layer, /ud=fromDark\+\(dk-fromDark\)\*eased/);
  assert.match(layer, /prefers-reduced-motion:reduce/);
  assert.match(css, /prefers-reduced-transparency:reduce/);
  assert.match(toggle, /role="switch"/);
  assert.doesNotMatch(layer, /startViewTransition|\.click\(\)/);
});

test('WebGL2 loss stays graceful and never triggers endless GPU retries on React updates', () => {
  const layer = read('public/liquid-glass.js');
  assert.doesNotThrow(() => new Function(layer));
  assert.match(layer, /REACTIVE 3D BACKGROUND/);
  assert.match(layer, /for\(const candidate of \['webgl2','webgl'\]\)/);
  assert.match(layer, /ctx\.getShaderParameter\(sh,ctx\.COMPILE_STATUS\)/);
  assert.match(layer, /ctx\.getProgramParameter\(program,ctx\.LINK_STATUS\)/);
  assert.match(layer, /webglUnavailable=false,canvasUnavailable=false,contextLossCount=0/);
  assert.match(layer, /if\(!webglUnavailable&&performance\.now\(\)>=gpuRetryAt\)G=bg\(env\)/);
  assert.match(layer, /if\(!G&&!canvasUnavailable\)G=bg2d\(env\)/);
  assert.match(layer, /if\(!G\)env\.dataset\.ambientMode='gradient'/);
  assert.match(layer, /env\.dataset\.ambientMode='webgl'/);
  assert.match(layer, /webglcontextlost/);
  assert.match(layer, /env\.classList\.remove\('lg-gl'\)/);
  assert.match(layer, /if\(\+\+contextLossCount>1\)webglUnavailable=true/);
  assert.match(layer, /if\(!c\._ready\)/);
  assert.match(layer, /env\.dataset\.ambientMode=kind/);
  assert.match(layer, /env\.dataset\.ambientMode='canvas2d'/);
  assert.match(layer, /\.lg-gl>\.optical-weave,\.lg-gl>\.optical-caustic\{display:none\}/);
  assert.doesNotMatch(layer, /user-select:none!important/, 'Keep direct text selection working');
});

test('restoration does not sacrifice saved response access or navigation', () => {
  const app = read('src/features/archive/ArchiveApp.tsx');
  const library = read('src/features/archive/LibraryWorkspace.tsx');
  const search = read('src/features/archive/SearchWorkspace.tsx');
  const otp = read('src/features/auth/OtpVisual.tsx');
  const auth = read('src/features/auth/AuthPage.tsx');
  const api = read('worker/api/responses.ts');
  const picker = read('src/features/archive/AvatarPicker.tsx');
  const transfer = read('src/features/archive/TransferWorkspace.tsx');
  for (const feature of ['SearchWorkspace','LibraryWorkspace','TeamWorkspace','ManageAgentsWorkspace','SettingsWorkspace','TransferWorkspace']) {
    assert.ok(app.includes(feature) || library.includes(feature), 'Missing feature ' + feature);
  }
  assert.match(app, /aria-label="Admin dashboard"/);
  assert.match(app, /aria-label="Main navigation"/);
  assert.match(library, /responseCreatorName\(item, agent\)/);
  assert.match(library, /<AgentAvatar name=\{creatorName\}/);
  assert.match(search, /event\.key === 'Escape'/);
  assert.match(search, /onCopy=\{onCopyDraft\}/);
  assert.match(search, /event\.clipboardData\.setData\('text\/plain', draft\)/);
  assert.match(otp, /otp-orbit otp5/);
  assert.match(auth, /\/api\/otp\/signup\/verify/);
  assert.match(api, /path === '\/api\/team'/);
  assert.match(api, /signed\.agent\.role !== 'admin'/);
  assert.match(picker, /archive-avatar-upload-circle/);
  assert.match(transfer, /archive-import-file/);
});

test('security, data and cloud configuration do not drift during a visual recovery', () => {
  const wrangler = read('wrangler.jsonc');
  const app = read('src/features/archive/ArchiveApp.tsx');
  const css = read('src/styles/premium.css');
  const html = read('index.html');
  assert.match(html, /<script defer src="\/liquid-glass\.js"><\/script>/);
  assert.match(wrangler, /previews/);
  assert.match(app, /data-theme=\{theme\}/);
  assert.match(css, /content-visibility: auto/);
  assert.match(css, /archive-admin-subnav-lens/);
  assert.doesNotMatch(css, /--hover-slot|--hover-visible/, 'Do not resurrect rejected ghost hover pills');
});
