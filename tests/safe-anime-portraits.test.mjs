import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { selectSafePortraits, sortedTags } from '../worker/api/safeAnimePortraits.ts';

const imageUrl='https://cdn.donmai.us/360x360/1a/2b/1a2b3c4d5e6f78112233445566778899.jpg';
const post=(changes={})=>({
  id: 12345, rating:'g', score:18, fav_count:22, file_ext:'jpg',
  image_width:800,image_height:900,
  tag_string_character:'asta_(black_clover)',
  tag_string_general:'solo 1boy portrait close-up upper_body looking_at_viewer colored_background',
  media_asset:{variants:[{type:'360x360',url:imageUrl}]},
  ...changes,
});

test('keep colorful, general-rated single-character portraits',()=>{
  const results=selectSafePortraits([post()], 'asta_(black_clover)', 'Asta');
  assert.equal(results.length,1);
  assert.equal(results[0].title,'Asta');
  assert.equal(results[0].provider,'safebooru');
  assert.equal(results[0].booruTag,'asta_(black_clover)');
  assert.equal(results[0].avatarUrl,imageUrl);
});

test('reject suggestive, multi-character, cosplay and low-quality material',()=>{
  const bad=[
    post({id:1,rating:'s'}),
    post({id:2,rating:'q'}),
    post({id:3,rating:'e'}),
    post({id:4,tag_string_character:'asta_(black_clover) noelle_silva'}),
    post({id:5,tag_string_character:'asta_(black_clover) yami_ichika'}),
    post({id:6,tag_string_general:'solo 1boy white_background'}),
    post({id:7,tag_string_general:'solo sketch'}),
    post({id:8,tag_string_general:'1boy portrait'}),
    post({id:9,file_ext:'mp4'}),
    post({id:10,image_width:200}),
    post({id:11,media_asset:{variants:[{type:'360x360',url:'https://bad.example.com/p.jpg'}]}}),
    post({id:12,image_height:350}),
  ];
  assert.equal(selectSafePortraits(bad,'asta_(black_clover)','Asta').length,0);
});

test('select the right Asta when Black Clover context is available',()=>{
  const tags=[
    {name:'asta_(honkai:_star_rail)',post_count:527,category:4},
    {name:'asta_(black_clover)',post_count:389,category:4},
    {name:'astarion',post_count:800,category:4},
    {name:'asta_(outdated)',post_count:0,category:4},
  ];
  assert.equal(sortedTags(tags,'Asta','Black Clover')[0].name,'asta_(black_clover)');
  assert.equal(sortedTags(tags,'Asta','Honkai Star Rail')[0].name,'asta_(honkai:_star_rail)');
  assert.ok(sortedTags(tags,'Monkey D. Luffy').length===0);
});

test('prefer portrait/close-up artwork over full-body images',()=>{
  const full=post({id:20,score:15,tag_string_general:'solo full_body 1boy'});
  const close=post({id:21,score:12,tag_string_general:'solo portrait close-up upper_body 1boy'});
  const results=selectSafePortraits([full,close],'asta_(black_clover)','Asta',2);
  assert.equal(results[0].id,'safebooru:21');
});

test('search never makes source thumbnails mandatory or replaces existing curated PFPs',()=>{
  const worker=readFileSync(new URL('../worker/api/avatarCatalog.ts',import.meta.url),'utf8');
  const picker=readFileSync(new URL('../src/features/archive/AvatarPicker.tsx',import.meta.url),'utf8');
  const routes=readFileSync(new URL('../worker/api/avatars.ts',import.meta.url),'utf8');
  assert.match(worker,/findSafeAnimePortraits/);
  assert.match(picker,/safeAdditions/);
  assert.match(picker,/showAdditional/);
  assert.match(picker,/provider==='safebooru'/);
  assert.match(routes,/cdn\\.donmai\\.us/);
  assert.match(routes,/api\/avatars\/booru-looks/);
  assert.match(picker,/archive-avatar-upload-circle/);
});
