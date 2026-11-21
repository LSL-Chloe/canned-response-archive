import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { sameResponseList } from '../src/features/archive/model.ts';
import { avatarImageSrc, alternateAvatarImageSrc } from '../src/features/archive/avatarImages.ts';

const row = {
  id: 'c1', shortcut: 'followup', body: 'Following up with you.',
  visibility: 'shared', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  createdBy: 'Team', ownedByMe: false,
};
test('unchanged polling results preserve the previous response list', () => {
  assert.equal(sameResponseList([row], [{ ...row }]), true);
  assert.equal(sameResponseList([row], [{ ...row, body: 'Revised text' }]), false);
  assert.equal(sameResponseList([row], [{ ...row, createdBy: 'Other' }]), false);
  assert.equal(sameResponseList([row], [{ ...row, ownedByMe: true }]), false);
  assert.equal(sameResponseList([row], []), false);
  assert.equal(sameResponseList([], []), true);
});
test('curated character icons load directly and retain authenticated proxy fallback', () => {
  const netflix = 'https://occ-0-8782-2219.1.nflxso.net/dnm/api/v6/vN7bi_My87NPKvsBoib006Llxzg/image.png?r=955';
  const github = 'https://raw.githubusercontent.com/kalibrado/jf-avatars-images/b483c1a06325509237891f87920453b6ced31d00/images/Crunchyroll/1056-black-clover-asta.png';
  const thirdParty = 'https://static.tvmaze.com/uploads/images/medium_portrait/1/test.jpg';
  assert.equal(avatarImageSrc(netflix, true), netflix);
  assert.equal(avatarImageSrc(github, true), github);
  assert.match(avatarImageSrc(netflix), /^\/api\/avatars\/image\?/);
  assert.match(alternateAvatarImageSrc(netflix), /^\/api\/avatars\/image\?/);
  assert.match(alternateAvatarImageSrc(github), /^https:\/\/cdn\.jsdelivr\.net\/gh\//);
  assert.match(avatarImageSrc(thirdParty, true), /^\/api\/avatars\/image\?/);
  assert.equal(avatarImageSrc('https://untrusted.invalid/picture.png', true), 'https://untrusted.invalid/picture.png');
});
test('development QA is gated and no longer eagerly included in the main application', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /import\.meta\.env\.DEV/);
  assert.match(app, /lazy\(\(\) => import/);
  assert.doesNotMatch(app, /import DevAuthTest from/);
});
test('large archive lists avoid needless repaints without disabling the glass UI', () => {
  const app = readFileSync(new URL('../src/features/archive/ArchiveApp.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/premium.css', import.meta.url), 'utf8');
  assert.match(app, /sameResponseList\(previous, data\[0\]\)/);
  assert.match(app, /responses = useMemo\(/);
  assert.match(app, /featuredAvatars\.anime\.slice\(0,8\)/);
  assert.match(css, /content-visibility: auto/);
  assert.match(css, /archive-avatar-choice/);
  assert.match(css, /archive-response-row/);
  assert.match(css, /optical-environment \{ contain: layout paint; \}/);
});


test('tall libraries never render one massive SVG displacement filter', () => {
  const library = readFileSync(new URL('../src/features/archive/LibraryWorkspace.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/premium.css', import.meta.url), 'utf8');
  assert.doesNotMatch(library, /className="archive-response-list">\s*<LiquidUnderlay/);
  assert.match(css, /\.archive-app \.archive-response-list \{\s*background:var\(--liquid-panel-tint\)/);
  assert.match(library, /<LiquidUnderlay radius=\{18\}\/>/, 'keep bounded form refraction');
});

test('pinned avatar display URLs use an edge CDN with original-source fallback', () => {
  const raw = 'https://raw.githubusercontent.com/kalibrado/jf-avatars-images/b483c1a06325509237891f87920453b6ced31d00/images/Crunchyroll/1044-jujutsu-kaisen-satoru-gojo.png';
  const cdn = alternateAvatarImageSrc(raw);
  assert.match(cdn, /^https:\/\/cdn\.jsdelivr\.net\/gh\/kalibrado\/jf-avatars-images@b483c1a06325509237891f87920453b6ced31d00\//);
  assert.equal(alternateAvatarImageSrc(cdn), raw, 'CDN failure must fall back to pinned GitHub source');
  assert.equal(alternateAvatarImageSrc('https://cdn.jsdelivr.net/gh/other/project@aabbcc/image.png'),
    'https://cdn.jsdelivr.net/gh/other/project@aabbcc/image.png');
  const catalog = readFileSync(new URL('../src/features/archive/curatedAvatarCatalog.ts', import.meta.url), 'utf8');
  assert.match(catalog, /imageUrl,avatarUrl:url/);
  assert.match(catalog, /const cdnBases/);
  const picker = readFileSync(new URL('../src/features/archive/AvatarPicker.tsx', import.meta.url), 'utf8');
  assert.match(picker, /loading=\{priority \? 'eager' : 'lazy'\}/);
  assert.match(picker, /fetchPriority=\{priority \? 'high' : 'auto'\}/);
  assert.match(picker, /link\.rel = 'preconnect'/);
});

test('silent response polling skips slow overlapping requests', () => {
 const app=readFileSync(new URL('../src/features/archive/ArchiveApp.tsx', import.meta.url), 'utf8');
 assert.match(app,/if \(silent && refreshInFlight\.current\) return/);
 assert.match(app,/refreshInFlight\.current = false/);
});
