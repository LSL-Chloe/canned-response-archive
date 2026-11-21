import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const path = new URL('../src/features/archive/curatedAvatarCatalog.ts', import.meta.url);
const source = readFileSync(path, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(compiled, { module: mod, exports: mod.exports }, { timeout: 3500 });
const { curatedAvatarsForTitle, curatedAvatars } = mod.exports;

test('known anime franchises use the curated square-avatar collection, not Kitsu drawings', () => {
  const base = curatedAvatarsForTitle('anime', 'One Piece');
  const spinOff = curatedAvatarsForTitle('anime', 'One Piece: Episode of Nami');
  assert.ok(base.length >= 30, 'One Piece must have dozens of curated icon options');
  assert.equal(spinOff.length, base.length, 'Spin-off titles should use the same curated franchise icons');
  assert.ok(base.every(icon => icon.pack && icon.avatarUrl.includes('raw.githubusercontent.com')));
  assert.ok(curatedAvatarsForTitle('anime', 'Black Clover').length >= 5);
  assert.ok(curatedAvatarsForTitle('anime', 'Naruto Shippuden').length >= 8);
  assert.ok(curatedAvatarsForTitle('anime', 'Unknown Unrelated Series').length === 0);
});

test('movie and show franchise choices remain mapped to in-character portraits', () => {
  assert.ok(curatedAvatarsForTitle('tv', 'Stranger Things').length >= 10);
  assert.ok(curatedAvatarsForTitle('movie', 'Avengers Endgame').length >= 10);
  assert.ok(curatedAvatarsForTitle('movie', 'Harry Potter and the Philosopher Stone').length >= 5);
  assert.ok(curatedAvatars.length >= 750);
});

test('picker suppresses pale Kitsu supplements when curated anime icons exist and hides footer', () => {
  const picker = readFileSync(new URL('../src/features/archive/AvatarPicker.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/premium.css', import.meta.url), 'utf8');
  assert.match(picker, /curatedAvatarsForTitle\(source,title\.title\)/);
  assert.match(picker, /curatedSeries\.length \? curatedSeries/);
  assert.match(picker, /source==='anime' && localMatches\.length>0/);
  assert.doesNotMatch(picker, /archive-avatar-attribution|Art belongs to its respective rights holders/);
  assert.doesNotMatch(css, /archive-avatar-attribution/);
});
