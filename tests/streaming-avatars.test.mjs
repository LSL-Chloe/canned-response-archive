import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { streamingAvatars, streamingPreview, streamingCategory, searchStreamingAvatars,
  streamingAvatarsForTitle, otherStreamingLooks } from '../src/features/archive/streamingAvatarCatalog.ts';

test('expanded character icon index preserves category labels and exact links',()=>{
 const anime=streamingCategory('anime'), tv=streamingCategory('tv'), movies=streamingCategory('movie');
 assert.ok(streamingAvatars.length >= 900);
 assert.ok(anime.length >= 65);
 assert.ok(tv.length >= 700);
 assert.ok(movies.length >= 110);
 assert.equal(streamingPreview.anime.length,16);
 assert.equal(streamingPreview.tv.length,16);
 assert.equal(streamingPreview.movie.length,16);
 assert.ok(streamingAvatars.every(x=>x.kind==='avatar'&&x.imageUrl===x.avatarUrl&&
   /^https:\/\/occ-0-[0-9]+-[0-9]+\.1\.nflxso\.net\/dnm\/api\/v6\//.test(x.imageUrl)));
 assert.ok(streamingAvatars.every(x=>!['Ariana Grande','BLACKPINK','Taylor Swift','Netflix Classic Icons'].includes(x.franchise)));
});

test('film searches reveal actual Netflix character icons, never film posters or actor headshots',()=>{
 const demon=searchStreamingAvatars('movie','KPop Demon Hunters');
 assert.ok(demon.length >= 10);
 assert.ok(demon.some(x=>x.title==='Rumi'));
 assert.equal(streamingAvatarsForTitle('movie','KPop Demon Hunters').length,demon.length);
 assert.ok(searchStreamingAvatars('movie','Rebel Moon').length >= 10);
 assert.ok(searchStreamingAvatars('movie','The Sea Beast').length >= 5);
 assert.ok(searchStreamingAvatars('movie','Vivo').length >= 8);
 assert.equal(searchStreamingAvatars('movie','Stranger Things').length,0);
});

test('TV and anime keep proper character search and multiple named seasons',()=>{
 assert.ok(searchStreamingAvatars('tv','Stranger Things').length >= 80);
 assert.ok(searchStreamingAvatars('tv','Wednesday').length >= 20);
 assert.ok(streamingAvatarsForTitle('tv','Stranger Things Season 5').length >= 80);
 assert.ok(streamingAvatarsForTitle('tv','One Piece').length >= 10);
 assert.ok(searchStreamingAvatars('anime','Aggretsuko').length >= 14);
 assert.ok(searchStreamingAvatars('anime','Castlevania').some(x=>x.title==='Dracula'));
 assert.equal(searchStreamingAvatars('anime','Rebel Moon').length,0);
 const same=streamingAvatarsForTitle('tv','Stranger Things').filter(x=>x.title==='Eleven');
 if(same.length) assert.ok(otherStreamingLooks(same[0]).length >= 1);
});

test('Settings keeps the 15 curated icons before extra streaming choices, then reveals more',()=>{
 const picker=readFileSync(new URL('../src/features/archive/AvatarPicker.tsx',import.meta.url),'utf8');
 assert.match(picker,/featuredAvatars\[source\]/);
 assert.match(picker,/streamingPreview\[source\]/);
 assert.match(picker,/streamingCategory\(source\)/);
 assert.match(picker,/Browse ' \+ streamed\.length/);
 assert.match(picker,/streamingAvatarsForTitle/);
 assert.match(picker,/streamingAvatars/);
 assert.match(picker,/archive-avatar-upload-circle/);
});

test('desktop rail stays sticky when the Settings page is taller than the viewport',()=>{
 const css=readFileSync(new URL('../src/styles/premium.css',import.meta.url),'utf8');
 assert.match(css,/@media \(min-width:781px\) \{\s*\.archive-app\[data-theme\] > \.archive-sidebar \{\s*position:sticky;/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/align-self:flex-start/);
});
