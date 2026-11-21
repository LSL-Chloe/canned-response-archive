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
  const otp = read('src/features/auth/OtpVisual.tsx');
  assert.ok(otp.includes('pattern="[0-9]{6}"'), 'OTP must use a six-digit pattern');
  assert.match(otp, /autoComplete="one-time-code"/);
  assert.match(read('src/features/archive/SettingsWorkspace.tsx'), /<OtpCells/);
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
  assert.match(app, /href="\/auth\?mode=login"/);
  assert.match(app, /data-theme=\{theme\}/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['@samasante/liquid-glass'], '0.1.1');
});

test('real glass controls are interactive and sidebar state remains mounted for animation', () => {
  const theme = read('src/ui/ThemeToggle.tsx');
  const app = read('src/features/archive/ArchiveApp.tsx');
  const library = read('src/features/archive/LibraryWorkspace.tsx');
  const ui = read('src/styles/premium.css');
  assert.match(theme, /role="switch"/);
  assert.match(theme, /aria-checked/);
  assert.match(theme, /<Glass/);
  assert.match(app, /archive-nav-selection/);
  assert.match(app, /--active-tab/);
  assert.match(app, /archive-sidebar-scrim/);
  assert.match(library, /archive-tabs-lens/);
  assert.match(ui, /transition:width \.42s/);
  assert.match(ui, /\.liquid-theme-switch\[data-appearance="dark"\] \.liquid-switch-thumb/);
  assert.match(ui, /prefers-reduced-motion:reduce/);
  assert.match(read('src/features/archive/SearchWorkspace.tsx'), /<LiquidButton/);
  assert.match(read('src/features/auth/AuthPage.tsx'), /<LiquidButton/);
});


test('compact auto-growing composer preserves hashtag insertion and undo', () => {
  const src = read('src/features/archive/SearchWorkspace.tsx');
  assert.match(src, /rows=\{2\}/);
  assert.match(src, /useLayoutEffect/);
  assert.match(src, /fullHeight > 216/);
  assert.match(src, /lastInsert\.current/);
  assert.match(src, /setDismissed\(false\)/);
  assert.match(src, /archive-composer-hint/);
});

test('form labels and glass selectors stay aligned', () => {
  const library = read('src/features/archive/LibraryWorkspace.tsx');
  const transfer = read('src/features/archive/TransferWorkspace.tsx');
  assert.match(library, /archive-visibility-lens/);
  assert.match(transfer, /archive-visibility-lens/);
  assert.match(library, /htmlFor="archive-response-body"[\s\S]*\{body.length\}\/10000 characters[\s\S]*<textarea id="archive-response-body"/);
});

test('two-level shortcut search groups by name and retains response insertion', () => {
  const model = read('src/features/archive/model.ts');
  const search = read('src/features/archive/SearchWorkspace.tsx');
  assert.match(model, /export function findShortcutGroups/);
  assert.match(model, /new Map<string, ShortcutGroup>/);
  assert.match(search, /event.key === 'ArrowRight'/);
  assert.match(search, /event.key === 'ArrowLeft'/);
  assert.match(search, /openShortcut/);
  assert.match(search, /goBack/);
  assert.match(search, /selectedShortcut/);
  assert.match(search, /useResponse/);
  assert.match(read('src/styles/premium.css'), /archive-shortcut-scroll/);
});

test('profile picture picker includes custom upload first and catalog choices', () => {
  const ui = read('src/features/archive/AvatarPicker.tsx');
  const settings = read('src/features/archive/SettingsWorkspace.tsx');
  const app = read('src/features/archive/ArchiveApp.tsx');
  const server = read('worker/api/avatars.ts');
  const catalog = read('worker/api/avatarCatalog.ts');
  assert.match(ui, /archive-avatar-upload-circle/);
  assert.ok(ui.indexOf('archive-avatar-upload"') < ui.indexOf('portraits.map('), 'Custom upload should precede catalog portraits');
  assert.match(ui, /image\/jpeg/);
  assert.match(ui, /compressAvatar/);
  assert.match(settings, /<AvatarPicker/);
  assert.match(app, /avatarUrl \? <img/);
  assert.match(server, /getSession/);
  assert.match(server, /sourceUrl/);
  assert.match(catalog, /TMDB_READ_ACCESS_TOKEN/);
  assert.match(server, /imageData/);
});

test('character avatar search separates navigation titles from actual portraits', () => {
  const picker = read('src/features/archive/AvatarPicker.tsx');
  const server = read('worker/api/avatars.ts');
  const images = read('src/features/archive/avatarImages.ts');
  assert.match(read('worker/api/avatarCatalog.ts'), /kitsuSearch/);
  assert.match(read('worker/api/avatarCatalog.ts'), /kitsuCharacters/);
  assert.match(server, /api\/avatars\/image/);
  assert.doesNotMatch(server, /poster_path/);
  assert.match(picker, /archive-avatar-title-choice/);
  assert.match(picker, /portraits\.map/);
  assert.match(picker, /setAttempt/);
  assert.match(images, /encodeURIComponent/);
});

test('avatar chooser loads popular characters immediately and searches without title clicks', () => {
  const picker = read('src/features/archive/AvatarPicker.tsx');
  const catalog = read('worker/api/avatarCatalog.ts');
  const api = read('worker/api/avatars.ts');
  assert.match(picker, /featuredAvatars/);
  assert.doesNotMatch(picker, /api\/avatars\/popular/);
  assert.match(picker, /api\/avatars\/search/);
  assert.match(picker, /Featured characters/);
  assert.match(picker, /More looks/);
  assert.match(catalog, /POPULAR_TV/);
  assert.match(catalog, /POPULAR_MOVIES/);
  assert.match(catalog, /FEATURED_IMAGES/);
  assert.match(catalog, /cachedWiki/);
  assert.match(catalog, /wikiPortraits/);
  assert.match(catalog, /kitsuSearch/);
  assert.match(catalog, /variations/);
  assert.match(api, /api\/avatars\/variations/);
  assert.doesNotMatch(catalog, /profile_path|poster_path/);
});

test('curated profile-picture shelves render immediately without a public API request', () => {
  const picker = read('src/features/archive/AvatarPicker.tsx');
  const catalog = read('src/features/archive/curatedAvatarCatalog.ts');
  const app = read('src/features/archive/ArchiveApp.tsx');
  const server = read('worker/api/avatars.ts');
  const images = read('src/features/archive/avatarImages.ts');
  assert.match(catalog, /const featuredPaths/);
  assert.match(catalog, /const records/);
  assert.match(catalog, /searchCuratedAvatars/);
  assert.match(catalog, /alternateCuratedAvatars/);
  assert.match(picker, /const localMatches/);
  assert.match(picker, /showAdditional/);
  assert.match(app, /import\('\.\/curatedAvatarCatalog'\)/);
  assert.match(app, /featuredAvatars\.anime\.slice\(0,8\)/);
  assert.match(server, /raw\.githubusercontent\.com/);
  assert.match(images, /alternateAvatarImageSrc/);
});


test('import control stays accessible without a duplicate native file button', () => {
  const transfer = read('src/features/archive/TransferWorkspace.tsx');
  const css = read('src/styles/premium.css');
  assert.match(transfer, /htmlFor="archive-import-file"/);
  assert.match(transfer, /className="sr-only archive-transfer-input" type="file"/);
  assert.match(transfer, /archive-transfer-file-name/);
  assert.match(transfer, /aria-describedby="archive-import-filename"/);
  assert.doesNotMatch(transfer, /Selected: \{selectedName\}/);
  assert.match(css, /archive-transfer-file-row:has\(\.archive-transfer-input:focus-visible\)/);
  assert.match(css, /archive-transfer-scope:has\(>button:nth-of-type\(2\)\) button/);
});
