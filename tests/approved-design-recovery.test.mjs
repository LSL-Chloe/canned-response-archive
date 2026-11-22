import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('the original shader stays primary, with the earlier lined background for failures', () => {
  const css = read('src/styles/premium.css');
  const backdrop = read('src/ui/OpticalBackdrop.tsx');
  const layer = read('public/liquid-glass.js');
  assert.match(css, /--fallback-base:#0c0d11/);
  assert.match(css, /--fallback-base:#e6e8eb/);
  assert.match(css, /repeating-linear-gradient\(0deg,transparent 0 7px,var\(--fallback-line\)/);
  assert.match(css, /repeating-linear-gradient\(90deg,transparent 0 7px,var\(--fallback-line-2\)/);
  assert.match(css, /data-ambient-mode="pending"/);
  assert.match(backdrop, /className="optical-environment"/);
  assert.match(backdrop, /className="optical-weave"/);
  assert.match(layer, /for\(const candidate of \['webgl2','webgl'\]\)/);
  assert.match(layer, /visualMode\(env,'original',kind\)/);
  assert.match(layer, /visualMode\(env,'fallback','lines'\)/);
});

test('original theme thumb, glass control transitions and animated background remain independent', () => {
  const css = read('src/styles/premium.css');
  const layer = read('public/liquid-glass.js');
  const toggle = read('src/ui/ThemeToggle.tsx');
  assert.match(css, /@property --a-bg\{syntax:"<color>";inherits:true/);
  assert.match(layer, /\.liquid-theme-switch \.liquid-switch-thumb\{transition:transform \.58s/);
  assert.match(layer, /\.archive-nav-selection,\.archive-tabs-lens,\.auth-tabs-lens,\.archive-visibility-lens\{transition:transform/);
  assert.match(layer, /\.liquid-action:hover,\.archive-button:hover,\.archive-sign-in-link:hover/);
  assert.match(layer, /const initialDark=readDark\(\)/);
  assert.match(layer, /const nextDark=readDark\(\)/);
  assert.match(layer, /\(now-changeAt\)\/580/);
  assert.match(layer, /ud=fromDark\+\(dk-fromDark\)\*eased/);
  assert.match(layer, /prefers-reduced-motion:reduce/);
  assert.match(css, /prefers-reduced-transparency:reduce/);
  assert.match(toggle, /role="switch"/);
  assert.doesNotMatch(layer, /startViewTransition|\.click\(\)/);
});

test('WebGL recovery is bounded, never replacing controls with low-quality variants', () => {
  const layer = read('public/liquid-glass.js');
  assert.doesNotThrow(() => new Function(layer));
  assert.match(layer, /REACTIVE 3D BACKGROUND/);
  assert.match(layer, /ctx\.getShaderParameter\(sh,ctx\.COMPILE_STATUS\)/);
  assert.match(layer, /ctx\.getProgramParameter\(program,ctx\.LINK_STATUS\)/);
  assert.match(layer, /webglUnavailable=false,contextLossCount=0/);
  assert.match(layer, /failedGpuKinds=new Set\(\)/);
  assert.match(layer, /if\(!webglUnavailable&&performance\.now\(\)>=gpuRetryAt\)G=bg\(env\)/);
  assert.match(layer, /if\(!G\)visualMode\(env,'fallback','lines'\)/);
  assert.match(layer, /webglcontextlost/);
  assert.match(layer, /env\.classList\.remove\('lg-gl'\)/);
  assert.match(layer, /if\(failedGpuKinds\.size===2\)webglUnavailable=true/);
  assert.match(layer, /if\(!c\._ready\)/);
  assert.match(layer, /visualMode\(env,'original',kind\)/);
  assert.match(layer, /\.lg-gl>\.optical-weave,\.lg-gl>\.optical-caustic\{display:none\}/);
  assert.doesNotMatch(layer, /bg2d\(|user-select:none!important/);
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
  assert.match(html, /<script defer src="\/liquid-glass\.js\?v=original-glass-20261123-1"><\/script>/);
  assert.match(wrangler, /previews/);
  assert.match(app, /data-theme=\{theme\}/);
  assert.match(css, /content-visibility: auto/);
  assert.match(css, /archive-admin-subnav-lens/);
  assert.doesNotMatch(css, /--hover-slot|--hover-visible/, 'Do not resurrect rejected ghost hover pills');
});
