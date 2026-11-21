import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { classifyAnimePortraitPixels } from '../src/features/archive/avatarQuality.ts';

function imageData(rows) {
  const bytes = new Uint8ClampedArray(rows.reduce((total, [, count]) => total + count, 0) * 4);
  let index = 0;
  for (const [rgba, count] of rows) {
    for (let n = 0; n < count; n++) {
      bytes.set(rgba, index);
      index += 4;
    }
  }
  return bytes;
}
const white = [251, 251, 251, 255];
const sketchLine = [244, 109, 83, 255];
const darkOutline = [39, 49, 56, 255];
const vivid = [33, 107, 192, 255];
const skin = [175, 109, 79, 255];
const mist = [201, 203, 204, 255];
const softLine = [240, 175, 170, 255];

test('remove almost-white and thin-line anime drawings on a per-image basis', () => {
  assert.equal(classifyAnimePortraitPixels(imageData([[white, 850], [sketchLine, 100], [darkOutline, 50]])), 'reject');
  assert.equal(classifyAnimePortraitPixels(imageData([[white, 1000]])), 'reject');
});

test('keep colorful and detailed character artwork from the very same source', () => {
  assert.equal(classifyAnimePortraitPixels(imageData([[vivid, 630], [skin, 180], [white, 190]])), 'good');
  assert.equal(classifyAnimePortraitPixels(imageData([[white, 320], [darkOutline, 450], [skin, 230]])), 'good');
});

test('gently enhance moderately pale portraits without excluding them', () => {
  assert.equal(classifyAnimePortraitPixels(imageData([[white, 615], [softLine, 90], [darkOutline, 85], [mist, 210]])), 'enhance');
});

test('do not judge fully transparent or unreadable samples as pale', () => {
  assert.equal(classifyAnimePortraitPixels(new Uint8ClampedArray(40)), 'good');
  assert.equal(classifyAnimePortraitPixels(imageData([[[255, 255, 255, 0], 1000]])), 'good');
});

test('only supplemental anime portraits are inspected; current and curated icons are untouched', () => {
  const picker = readFileSync(new URL('../src/features/archive/AvatarPicker.tsx', import.meta.url), 'utf8');
  assert.match(picker, /inspectAnime=\{source==='anime' && !item\.pack\}/);
  assert.match(picker, /rejectedImages\.has\(item\.avatarUrl\)/);
  assert.match(picker, /assessAnimePortraitImage/);
  assert.match(picker, /<PortraitImage url=\{avatarUrl\} label="Current profile"\/>/);
});
