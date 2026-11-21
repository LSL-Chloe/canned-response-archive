import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { streamingAvatars, streamingPreview, streamingCategory, searchStreamingAvatars,
  streamingAvatarsForTitle, otherStreamingLooks } from '../src/features/archive/streamingAvatarCatalog.ts';
import { curatedAvatars, featuredAvatars, searchCuratedAvatars, curatedAvatarsForTitle } from '../src/features/archive/curatedAvatarCatalog.ts';

test('expanded character icon index preserves category labels and exact links',()=>{
 const anime=streamingCategory('anime'), tv=streamingCategory('tv'), movies=streamingCategory('movie');
 assert.ok(streamingAvatars.length >= 850);
 assert.equal(anime.length,0, 'Anime must not receive the new Netflix icons');
 assert.ok(tv.length >= 700);
 assert.ok(movies.length >= 110);
 assert.equal(streamingPreview.anime.length,0);
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

test('TV character search keeps multiple named seasons',()=>{
 assert.ok(searchStreamingAvatars('tv','Stranger Things').length >= 80);
 assert.ok(searchStreamingAvatars('tv','Wednesday').length >= 20);
 assert.ok(streamingAvatarsForTitle('tv','Stranger Things Season 5').length >= 80);
 assert.ok(streamingAvatarsForTitle('tv','One Piece').length >= 10);
 assert.equal(searchStreamingAvatars('anime','Aggretsuko').length,0);
 assert.equal(searchStreamingAvatars('anime','Castlevania').length,0);
 assert.equal(streamingAvatarsForTitle('anime','Naruto').length,0);
 const same=streamingAvatarsForTitle('tv','Stranger Things').filter(x=>x.title==='Eleven');
 if(same.length) assert.ok(otherStreamingLooks(same[0]).length >= 1);
});

test('Anime preserves original curated PFPs and supports Show more without Netflix artwork',()=>{
 const anime=curatedAvatars.filter(icon=>icon.category==='anime');
 assert.ok(anime.length >= 300,'Original anime collection must remain intact');
 assert.equal(featuredAvatars.anime.length,15);
 assert.ok(searchCuratedAvatars('anime','Black Clover').length >= 3);
 assert.ok(curatedAvatarsForTitle('anime','One Piece').length >= 30);
 assert.equal(streamingCategory('anime').length,0);
 const featured=new Set(featuredAvatars.anime.map(icon=>icon.imageUrl));
 const extras=anime.filter(icon=>!featured.has(icon.imageUrl));
 assert.ok(extras.length >= 280,'Anime Browse more must reveal the original additional icons');
 assert.ok(extras.slice(0,64).every(icon=>!icon.imageUrl.includes('nflxso.net')));
});

test('All three tabs keep progressive Show more and custom upload first',()=>{
 const picker=readFileSync(new URL('../src/features/archive/AvatarPicker.tsx',import.meta.url),'utf8');
 assert.match(picker,/source==='anime' \? \[\] : streamingCategory\(source\)/);
 assert.match(picker,/source==='anime' \? \[\]\s*:\s*queryText\.length>=2/);
 assert.match(picker,/animeExtras\.slice\(0,catalogLimit\)/);
 assert.match(picker,/browseTotal=source==='anime' \? animeExtras\.length : streamed\.length/);
 assert.match(picker,/catalogLimit < browseTotal/);
 assert.match(picker,/setCatalogLimit\(value=>value\+64\)/);
 assert.match(picker,/Browse ' \+ browseTotal \+ ' additional character icons/);
 assert.match(picker,/source==='anime' \? \[\] : streamingAvatarsForTitle/);
 assert.match(picker,/archive-avatar-upload-circle/);
 assert.ok(streamingCategory('tv').length >= 700);
 assert.ok(streamingCategory('movie').length >= 110);
});

test('desktop rail stays sticky when the Settings page is taller than the viewport',()=>{
 const css=readFileSync(new URL('../src/styles/premium.css',import.meta.url),'utf8');
 assert.match(css,/@media \(min-width:781px\) \{\s*\.archive-app\[data-theme\] > \.archive-sidebar \{\s*position:sticky;/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/align-self:flex-start/);
});


test('the entire pinned Crunchyroll folder is in Anime exactly once, grouped by anime and character', () => {
 const anime=curatedAvatars.filter(x=>x.category==='anime');
 const originals=anime.filter(x=>x.avatarUrl.includes('/kalibrado/jf-avatars-images/') &&
   x.avatarUrl.includes('/images/Crunchyroll/'));
 assert.equal(originals.length,470,'470 distinct Crunchyroll folder assets must be available');
 assert.equal(new Set(originals.map(x=>x.avatarUrl)).size,470,'no duplicate Crunchyroll image sources');
 assert.ok(originals.every(x=>x.imageUrl.startsWith('https://cdn.jsdelivr.net/gh/kalibrado/jf-avatars-images@')),
   'thumbnails should use the pinned edge CDN, not an unversioned image');
 assert.ok(anime.length>=673,'retain the original 305 anime icons and add 368 new icons');
 assert.equal(featuredAvatars.anime.length,15,'preserve the original featured row');
 const lock=originals.filter(x=>x.franchise==='Blue Lock');
 assert.ok(lock.length>=20,'group Blue Lock icons by series rather than under generic Anime');
 assert.ok(lock.some(x=>/Isagi/i.test(x.title)),'characters must be named');
 assert.ok(searchCuratedAvatars('anime','apothecary maomao').some(x=>x.franchise==='The Apothecary Diaries'));
 assert.ok(searchCuratedAvatars('anime','mushoku rudeus').some(x=>x.title.toLowerCase().includes('rudeus')));
 assert.ok(searchCuratedAvatars('anime','crunchyroll classic').some(x=>x.title.includes('Hime')));
 assert.ok(curatedAvatarsForTitle('anime','One Piece').length>=40);
 assert.ok(originals.every(x=>x.imageUrl.endsWith('.png')||/\.(?:jpg|jpeg|webp)$/i.test(x.imageUrl)));
 assert.ok(!originals.some(x=>x.imageUrl.includes('nflxso.net')),'do not mix in Netflix anime');
});
