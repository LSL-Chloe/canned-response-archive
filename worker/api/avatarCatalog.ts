import type { Env } from '../services/db.ts';
import { findSafeAnimePortraits, type SafeAnimeAvatar } from './safeAnimePortraits.ts';

/** Only actual character artwork or in-character photos enter this catalog.
 * Movie/TV cast publicity headshots and posters are deliberately excluded.
 */
export type AvatarSource = 'anime' | 'tv' | 'movie';
export interface Portrait {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  avatarUrl?: string;
  kind: 'avatar' | 'title';
  wiki?: string;
  wikiPage?: string;
  malId?: number;
  provider?: 'safebooru';
  booruTag?: string;
}
type WikiGroup = { wiki: string; names: string[] };

const POPULAR_TV: WikiGroup[] = [
  { wiki:'breakingbad', names:['Walter White','Jesse Pinkman','Skyler White','Hank Schrader','Gustavo Fring','Mike Ehrmantraut','Saul Goodman'] },
  { wiki:'strangerthings', names:['Eleven','Dustin Henderson','Jim Hopper','Max Mayfield','Mike Wheeler','Will Byers','Steve Harrington'] },
  { wiki:'gameofthrones', names:['Jon Snow','Daenerys Targaryen','Arya Stark','Tyrion Lannister','Sansa Stark','Jaime Lannister'] },
];
const POPULAR_MOVIES: WikiGroup[] = [
  { wiki:'marvelcinematicuniverse', names:['Iron Man','Captain America','Thor','Spider-Man','Loki','Black Panther','Doctor Strange','Scarlet Witch','Hulk','Nick Fury'] },
  { wiki:'harrypotter', names:['Harry Potter','Hermione Granger','Ron Weasley','Severus Snape','Draco Malfoy'] },
  { wiki:'starwars', names:['Luke Skywalker','Darth Vader','Yoda','Obi-Wan Kenobi','Leia Organa'] },
  { wiki:'batman', names:['Harley Quinn','Bruce Wayne','The Joker'] },
];

export const WIKIS = new Set([...POPULAR_TV, ...POPULAR_MOVIES, { wiki:'thewalkingdead',names:[] },
  {wiki:'thewitcher',names:[]}, {wiki:'lotr',names:[]}, {wiki:'naruto',names:[]},
  {wiki:'blackclover',names:[]}, {wiki:'onepiece',names:[]}].map(group => group.wiki));

export function matchingWiki(source: AvatarSource, title: string): string | null {
  const lower = title.toLowerCase();
  const rules: [RegExp, string][] = source === 'movie' ? [
    [/avengers|iron man|captain america|thor|black panther|spider.man|doctor strange|deadpool|guardians of the galaxy|ant.man|marvel/i,'marvelcinematicuniverse'],
    [/harry potter|fantastic beasts/i,'harrypotter'],[/star wars|rogue one|mandalorian/i,'starwars'],
    [/batman|dark knight|joker|suicide squad|justice league/i,'batman'],
    [/lord of the rings|hobbit/i,'lotr'],
  ] : [
    [/breaking bad|better call saul/i,'breakingbad'],[/stranger things/i,'strangerthings'],
    [/game of thrones|house of the dragon/i,'gameofthrones'],
    [/walking dead/i,'thewalkingdead'],[/witcher/i,'thewitcher'],
  ];
  return rules.find(([pattern]) => pattern.test(lower))?.[1] ?? null;
}
function cleanKey(text: string): string { return text.trim().toLowerCase().replace(/[_\s]+/g,' '); }
function alias(name: string, wiki: string): string {
  const label = name.replace(/\s*\/.*$/, '').trim();
  if (wiki === 'marvelcinematicuniverse') {
    const known: Record<string,string> = {
      'tony stark':'Iron Man','steve rogers':'Captain America','natasha romanoff':'Black Widow',
      'bruce banner':'Hulk','peter parker':'Spider-Man','stephen strange':'Doctor Strange',
      't\'challa':'Black Panther','wanda maximoff':'Scarlet Witch',
      'scott lang':'Ant-Man','clint barton':'Hawkeye','carol danvers':'Captain Marvel',
    };
    return known[cleanKey(label)] || label;
  }
  return label;
}

async function requestJson(url: string, init?: RequestInit): Promise<any> {
  const reply = await fetch(url, { ...init, signal:AbortSignal.timeout(8500) });
  if (!reply.ok) throw new Error('Avatar catalog request failed (' + reply.status + ')');
  return reply.json();
}
async function optional<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  try { return await task(); } catch { return fallback; }
}
function toPortrait(name: string, url: string, id: string, subtitle: string,
                    wiki?: string, wikiPage?: string, malId?: number): Portrait {
  return { id, title:name, subtitle, imageUrl:url, avatarUrl:url, kind:'avatar',
    ...(wiki ? {wiki, wikiPage:wikiPage || name} : {}), ...(malId ? {malId} : {}) };
}
function unique(items: Portrait[], count = 90): Portrait[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = cleanKey(item.title) + ':' + item.imageUrl;
    if (!item.imageUrl || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0,count);
}

export async function wikiPortraits(wiki: string, names: string[]): Promise<Portrait[]> {
  if (!WIKIS.has(wiki) || !names.length) return [];
  const requested = [...new Set(names.map(x => alias(x,wiki)))].slice(0,25);
  const params = new URLSearchParams({
    action:'query', titles:requested.join('|'), redirects:'1', prop:'pageimages',
    piprop:'thumbnail', pithumbsize:'380', format:'json',
  });
  const data = await requestJson('https://' + wiki + '.fandom.com/api.php?' + params.toString(),
    { headers:{Accept:'application/json'} });
  const rows: any[] = Object.values(data?.query?.pages ?? {});
  return rows.filter(page => page?.thumbnail?.source && page?.title).map(page =>
    toPortrait(page.title, page.thumbnail.source, 'wiki:' + wiki + ':' + page.pageid,
      'Character portrait',wiki,page.title));
}
function cachedWiki(wiki: string, names: string[] = []): Portrait[] {
  const all = [...FEATURED_IMAGES.tv,...FEATURED_IMAGES.movie].filter(item=>item.wiki===wiki);
  if (!names.length) return all;
  const keys=new Set(names.map(name=>cleanKey(alias(name,wiki))));
  return all.filter(item=>keys.has(cleanKey(item.wikiPage || item.title)));
}
async function wikiGroups(groups: WikiGroup[]): Promise<Portrait[]> {
  const lists = await Promise.all(groups.map(group =>
    optional(() => wikiPortraits(group.wiki,group.names),[] as Portrait[])));
  return unique(lists.flat());
}

function kitsuCharacter(item: any): Portrait | null {
  const url = item?.attributes?.image?.large || item?.attributes?.image?.medium ||
    item?.attributes?.image?.original;
  if (!url) return null;
  return toPortrait(item.attributes.canonicalName || item.attributes.name || 'Character',
    url, 'k-' + item.id,'Anime character',undefined,undefined,item?.attributes?.malId);
}
async function kitsuCharacters(id: string, page = 1): Promise<{items:Portrait[],hasMore:boolean}> {
  const offset=(page-1)*20;
  const data=await requestJson('https://kitsu.io/api/edge/anime/' + encodeURIComponent(id) +
    '/characters?include=character&page%5Blimit%5D=20&page%5Boffset%5D='+offset);
  const byId=new Map<string,any>((data?.included??[]).map((it:any)=>[it.id,it]));
  const items:Portrait[]=(data?.data??[])
    .map((relation:any)=>kitsuCharacter(byId.get(relation.relationships?.character?.data?.id)))
    .filter((item:Portrait|null):item is Portrait=>Boolean(item));
  return {items,hasMore:Boolean(data?.links?.next)};
}
async function kitsuSearch(query:string, seriesHint?:string): Promise<{titles:Portrait[],items:Portrait[]}> {
  const name=encodeURIComponent(query);
  const [anime, characters]=await Promise.all([
    optional(()=>requestJson('https://kitsu.io/api/edge/anime?filter%5Btext%5D='+name+'&page%5Blimit%5D=7'),{data:[]}),
    optional(()=>requestJson('https://kitsu.io/api/edge/characters?filter%5Bname%5D='+name+'&page%5Blimit%5D=20'),{data:[]}),
  ]);
  const titles:Portrait[]=(anime.data??[]).map((row:any)=>({
    id:'k-'+row.id,title:row.attributes?.canonicalTitle || row.attributes?.titles?.en || 'Anime',
    subtitle:'Anime series',imageUrl:null,kind:'title' as const,
  }));
  const direct:Portrait[]=(characters.data??[]).map(kitsuCharacter).filter(Boolean);
  // Include the first two pages of the best series automatically. A user does
  // not have to click a title just to see Asta, Yuno, or another main character.
  const top=titles.slice(0,2);
  const related=await Promise.all(top.flatMap(title => [1,2].map(page =>
    optional(()=>kitsuCharacters(title.id.slice(2),page),{items:[] as Portrait[],hasMore:false}))));
  const known = unique([...related.flatMap(value=>value.items),...direct]);
  // Names come from character records, not posters or arbitrary title matches.
  // Query artist-tagged SFW images for up to three distinct characters.
  const q = cleanKey(query);
  const directlyNamed = direct.filter(item =>
    cleanKey(item.title).includes(q) || q.includes(cleanKey(item.title)));
  const names = [...directlyNamed, ...known].filter((item,index,all) =>
    all.findIndex(other => cleanKey(other.title) === cleanKey(item.title)) === index);
  const bestSeries = seriesHint || titles[0]?.title || '';
  const choices = names.slice(0,3).map(person => person.title);
  // If Kitsu is unavailable, try the query as a character name as well.
  if (!choices.length && query.trim().split(/\s+/).length <= 4) choices.push(query);
  const safe = await Promise.all(choices.map(name =>
    findSafeAnimePortraits(name,bestSeries,5)));
  return {titles,items:unique([...safe.flat(),...known])};
}
async function aniListTop(): Promise<Portrait[]> {
  const response=await requestJson('https://graphql.anilist.co',{
    method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({query:'query { Page(page:1,perPage:15) { characters(sort:FAVOURITES_DESC) { id name { full } image { large medium } } } }'}),
  });
  return unique((response?.data?.Page?.characters??[]).filter((c:any)=>c.image?.large || c.image?.medium)
    .map((c:any)=>toPortrait(c.name.full,c.image.large||c.image.medium,'al-'+c.id,'Popular anime character')));
}
async function jikanTop(): Promise<Portrait[]> {
  const response=await requestJson('https://api.jikan.moe/v4/top/characters?limit=15');
  return unique((response.data??[]).filter((c:any)=>c.images?.jpg?.image_url)
    .map((c:any)=>toPortrait(c.name,c.images.jpg.image_url,'j-'+c.mal_id,
      'Popular anime character',undefined,undefined,c.mal_id)));
}
async function kitsuTop(): Promise<Portrait[]> {
  const data=await requestJson('https://kitsu.io/api/edge/anime?sort=-userCount&page%5Blimit%5D=6');
  const results=await Promise.all((data.data??[]).slice(0,5).map((x:any)=>
    optional(()=>kitsuCharacters(x.id),{items:[] as Portrait[],hasMore:false})));
  return unique(results.flatMap(item=>item.items),20);
}
// Verified fallback thumbnails, used when a live wiki API cannot be reached.
const FEATURED_IMAGES: Record<'tv'|'movie',Portrait[]> = {
tv: [
{ id:"featured-breakingbad-Walter White", title:"Walter White",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/breakingbad/images/e/e7/BB-S5B-Walt-590.jpg/revision/latest/scale-to-width-down/300?cb=20250728222301",avatarUrl:"https://static.wikia.nocookie.net/breakingbad/images/e/e7/BB-S5B-Walt-590.jpg/revision/latest/scale-to-width-down/300?cb=20250728222301",wiki:"breakingbad",wikiPage:"Walter White" },
{ id:"featured-breakingbad-Jesse Pinkman", title:"Jesse Pinkman",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/breakingbad/images/c/ca/Jesse_Season_5B.jpg/revision/latest/scale-to-width-down/300?cb=20220611094739",avatarUrl:"https://static.wikia.nocookie.net/breakingbad/images/c/ca/Jesse_Season_5B.jpg/revision/latest/scale-to-width-down/300?cb=20220611094739",wiki:"breakingbad",wikiPage:"Jesse Pinkman" },
{ id:"featured-breakingbad-Skyler White", title:"Skyler White",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/breakingbad/images/3/33/Skyler_S5b.jpg/revision/latest/scale-to-width-down/300?cb=20130717044318",avatarUrl:"https://static.wikia.nocookie.net/breakingbad/images/3/33/Skyler_S5b.jpg/revision/latest/scale-to-width-down/300?cb=20130717044318",wiki:"breakingbad",wikiPage:"Skyler White" },
{ id:"featured-breakingbad-Hank Schrader", title:"Hank Schrader",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/breakingbad/images/7/7b/Hank_S5b.jpg/revision/latest/scale-to-width-down/300?cb=20250728071810",avatarUrl:"https://static.wikia.nocookie.net/breakingbad/images/7/7b/Hank_S5b.jpg/revision/latest/scale-to-width-down/300?cb=20250728071810",wiki:"breakingbad",wikiPage:"Hank Schrader" },
{ id:"featured-breakingbad-Gustavo Fring", title:"Gustavo Fring",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/breakingbad/images/5/5e/Gus_Fring_2002.jpg/revision/latest/scale-to-width-down/266?cb=20210608130942",avatarUrl:"https://static.wikia.nocookie.net/breakingbad/images/5/5e/Gus_Fring_2002.jpg/revision/latest/scale-to-width-down/266?cb=20210608130942",wiki:"breakingbad",wikiPage:"Gustavo Fring" },
{ id:"featured-breakingbad-Mike Ehrmantraut", title:"Mike Ehrmantraut",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/breakingbad/images/4/46/BCS_S6_Portrait_Mike.jpg/revision/latest/scale-to-width-down/320?cb=20220522174959",avatarUrl:"https://static.wikia.nocookie.net/breakingbad/images/4/46/BCS_S6_Portrait_Mike.jpg/revision/latest/scale-to-width-down/320?cb=20220522174959",wiki:"breakingbad",wikiPage:"Mike Ehrmantraut" },
{ id:"featured-strangerthings-Will Byers", title:"Will Byers",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/3/31/Will%27s_graduation_-_The_Rightside_Up.jpeg/revision/latest/scale-to-width-down/400?cb=20261109151539",avatarUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/3/31/Will%27s_graduation_-_The_Rightside_Up.jpeg/revision/latest/scale-to-width-down/400?cb=20261109151539",wiki:"strangerthings",wikiPage:"Will Byers" },
{ id:"featured-strangerthings-Eleven", title:"Eleven",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/e/e2/Eleven_-_Sorcerer.png/revision/latest/scale-to-width-down/296?cb=20260313155200",avatarUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/e/e2/Eleven_-_Sorcerer.png/revision/latest/scale-to-width-down/296?cb=20260313155200",wiki:"strangerthings",wikiPage:"Eleven" },
{ id:"featured-strangerthings-Mike Wheeler", title:"Mike Wheeler",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/9/97/Mike_Wheeler_Finale.png/revision/latest/scale-to-width-down/385?cb=20260313155900",avatarUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/9/97/Mike_Wheeler_Finale.png/revision/latest/scale-to-width-down/385?cb=20260313155900",wiki:"strangerthings",wikiPage:"Mike Wheeler" },
{ id:"featured-strangerthings-Dustin Henderson", title:"Dustin Henderson",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/4/4f/Dustin_Henderson_1989.png/revision/latest/scale-to-width-down/393?cb=20260313155936",avatarUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/4/4f/Dustin_Henderson_1989.png/revision/latest/scale-to-width-down/393?cb=20260313155936",wiki:"strangerthings",wikiPage:"Dustin Henderson" },
{ id:"featured-strangerthings-Jim Hopper", title:"Jim Hopper",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/e/ed/Jim_Hopper_Finale.png/revision/latest/scale-to-width-down/342?cb=20260313155702",avatarUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/e/ed/Jim_Hopper_Finale.png/revision/latest/scale-to-width-down/342?cb=20260313155702",wiki:"strangerthings",wikiPage:"Jim Hopper" },
{ id:"featured-strangerthings-Steve Harrington", title:"Steve Harrington",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/8/81/Steve_Harrington_1989.png/revision/latest/scale-to-width-down/357?cb=20260112123852",avatarUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/8/81/Steve_Harrington_1989.png/revision/latest/scale-to-width-down/357?cb=20260112123852",wiki:"strangerthings",wikiPage:"Steve Harrington" },
{ id:"featured-strangerthings-Max Mayfield", title:"Max Mayfield",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/2/2a/1989.png/revision/latest/scale-to-width-down/326?cb=20260313154711",avatarUrl:"https://static.wikia.nocookie.net/strangerthings8338/images/2/2a/1989.png/revision/latest/scale-to-width-down/326?cb=20260313154711",wiki:"strangerthings",wikiPage:"Max Mayfield" },
{ id:"featured-gameofthrones-Tyrion Lannister", title:"Tyrion Lannister",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/gameofthrones/images/9/95/HandoftheKingTyrionLannister.PNG/revision/latest/scale-to-width-down/264?cb=20190520175204",avatarUrl:"https://static.wikia.nocookie.net/gameofthrones/images/9/95/HandoftheKingTyrionLannister.PNG/revision/latest/scale-to-width-down/264?cb=20190520175204",wiki:"gameofthrones",wikiPage:"Tyrion Lannister" },
{ id:"featured-gameofthrones-Jaime Lannister", title:"Jaime Lannister",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/gameofthrones/images/5/51/JaimeLannisterSeason8.PNG/revision/latest/scale-to-width-down/254?cb=20190207112813",avatarUrl:"https://static.wikia.nocookie.net/gameofthrones/images/5/51/JaimeLannisterSeason8.PNG/revision/latest/scale-to-width-down/254?cb=20190207112813",wiki:"gameofthrones",wikiPage:"Jaime Lannister" },
{ id:"featured-gameofthrones-Jon Snow", title:"Jon Snow",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/gameofthrones/images/d/d0/JonSnow8x06.PNG/revision/latest/scale-to-width-down/278?cb=20190714094440",avatarUrl:"https://static.wikia.nocookie.net/gameofthrones/images/d/d0/JonSnow8x06.PNG/revision/latest/scale-to-width-down/278?cb=20190714094440",wiki:"gameofthrones",wikiPage:"Jon Snow" },
{ id:"featured-gameofthrones-Sansa Stark", title:"Sansa Stark",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/gameofthrones/images/6/63/QueenSansa.PNG/revision/latest/scale-to-width-down/282?cb=20210215100224",avatarUrl:"https://static.wikia.nocookie.net/gameofthrones/images/6/63/QueenSansa.PNG/revision/latest/scale-to-width-down/282?cb=20210215100224",wiki:"gameofthrones",wikiPage:"Sansa Stark" },
{ id:"featured-gameofthrones-Arya Stark", title:"Arya Stark",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/gameofthrones/images/b/be/AryaShipIronThrone.PNG/revision/latest/scale-to-width-down/268?cb=20190520174300",avatarUrl:"https://static.wikia.nocookie.net/gameofthrones/images/b/be/AryaShipIronThrone.PNG/revision/latest/scale-to-width-down/268?cb=20190520174300",wiki:"gameofthrones",wikiPage:"Arya Stark" },
{ id:"featured-gameofthrones-Daenerys Targaryen", title:"Daenerys Targaryen",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/gameofthrones/images/4/4f/Daenerys_Season_8.jpg/revision/latest/scale-to-width-down/240?cb=20190415212013",avatarUrl:"https://static.wikia.nocookie.net/gameofthrones/images/4/4f/Daenerys_Season_8.jpg/revision/latest/scale-to-width-down/240?cb=20190415212013",wiki:"gameofthrones",wikiPage:"Daenerys Targaryen" },
],
movie: [
{ id:"featured-marvelcinematicuniverse-Nick Fury", title:"Nick Fury",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/a/a3/Nick_Fury_Infobox.png/revision/latest/scale-to-width-down/314?cb=20240802141551",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/a/a3/Nick_Fury_Infobox.png/revision/latest/scale-to-width-down/314?cb=20240802141551",wiki:"marvelcinematicuniverse",wikiPage:"Nick Fury" },
{ id:"featured-marvelcinematicuniverse-Iron Man", title:"Iron Man",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/9/9d/Iron_Man_Infobox.jpg/revision/latest/scale-to-width-down/258?cb=20240802142023",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/9/9d/Iron_Man_Infobox.jpg/revision/latest/scale-to-width-down/258?cb=20240802142023",wiki:"marvelcinematicuniverse",wikiPage:"Iron Man" },
{ id:"featured-marvelcinematicuniverse-Thor", title:"Thor",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/2/2b/Thor_Infobox.jpg/revision/latest/scale-to-width-down/287?cb=20261120043107",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/2/2b/Thor_Infobox.jpg/revision/latest/scale-to-width-down/287?cb=20261120043107",wiki:"marvelcinematicuniverse",wikiPage:"Thor" },
{ id:"featured-marvelcinematicuniverse-Hulk", title:"Hulk",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/2/29/Hulk_Infobox.jpg/revision/latest/scale-to-width-down/288?cb=20260925124237",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/2/29/Hulk_Infobox.jpg/revision/latest/scale-to-width-down/288?cb=20260925124237",wiki:"marvelcinematicuniverse",wikiPage:"Hulk" },
{ id:"featured-marvelcinematicuniverse-Loki", title:"Loki",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/b/b5/Loki_Infobox.png/revision/latest/scale-to-width-down/299?cb=20250203204518",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/b/b5/Loki_Infobox.png/revision/latest/scale-to-width-down/299?cb=20250203204518",wiki:"marvelcinematicuniverse",wikiPage:"Loki" },
{ id:"featured-marvelcinematicuniverse-Captain America", title:"Captain America",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/9/9d/Captain_America_Infobox.jpg/revision/latest/scale-to-width-down/271?cb=20261118210758",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/9/9d/Captain_America_Infobox.jpg/revision/latest/scale-to-width-down/271?cb=20261118210758",wiki:"marvelcinematicuniverse",wikiPage:"Captain America" },
{ id:"featured-marvelcinematicuniverse-Doctor Strange", title:"Doctor Strange",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/b/b2/Doctor_Strange_MoM_Profile.jpeg/revision/latest/scale-to-width-down/314?cb=20231021153337",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/b/b2/Doctor_Strange_MoM_Profile.jpeg/revision/latest/scale-to-width-down/314?cb=20231021153337",wiki:"marvelcinematicuniverse",wikiPage:"Doctor Strange" },
{ id:"featured-marvelcinematicuniverse-Spider-Man", title:"Spider-Man",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/4/41/Spider-Man_Infobox.jpg/revision/latest/scale-to-width-down/300?cb=20261016004855",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/4/41/Spider-Man_Infobox.jpg/revision/latest/scale-to-width-down/300?cb=20261016004855",wiki:"marvelcinematicuniverse",wikiPage:"Spider-Man" },
{ id:"featured-marvelcinematicuniverse-Scarlet Witch", title:"Scarlet Witch",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/6/60/Scarlet_Witch_Infobox.jpg/revision/latest/scale-to-width-down/313?cb=20250203231704",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/6/60/Scarlet_Witch_Infobox.jpg/revision/latest/scale-to-width-down/313?cb=20250203231704",wiki:"marvelcinematicuniverse",wikiPage:"Scarlet Witch" },
{ id:"featured-marvelcinematicuniverse-Black Panther", title:"Black Panther",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/9/93/Black_Panther_Infobox.jpg/revision/latest/scale-to-width-down/282?cb=20261012121856",avatarUrl:"https://static.wikia.nocookie.net/marvelcinematicuniverse/images/9/93/Black_Panther_Infobox.jpg/revision/latest/scale-to-width-down/282?cb=20261012121856",wiki:"marvelcinematicuniverse",wikiPage:"Black Panther" },
{ id:"featured-harrypotter-Harry Potter", title:"Harry Potter",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/harrypotter/images/c/ce/Harry_Potter_DHF1.jpg/revision/latest/scale-to-width-down/300?cb=20140603201724",avatarUrl:"https://static.wikia.nocookie.net/harrypotter/images/c/ce/Harry_Potter_DHF1.jpg/revision/latest/scale-to-width-down/300?cb=20140603201724",wiki:"harrypotter",wikiPage:"Harry Potter" },
{ id:"featured-harrypotter-Hermione Granger", title:"Hermione Granger",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/harrypotter/images/3/34/Hermione_Granger.jpg/revision/latest/scale-to-width-down/300?cb=20251206062840",avatarUrl:"https://static.wikia.nocookie.net/harrypotter/images/3/34/Hermione_Granger.jpg/revision/latest/scale-to-width-down/300?cb=20251206062840",wiki:"harrypotter",wikiPage:"Hermione Granger" },
{ id:"featured-harrypotter-Draco Malfoy", title:"Draco Malfoy",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/harrypotter/images/7/7e/Draco_Malfoy_TDH.png/revision/latest/scale-to-width-down/300?cb=20180116013508",avatarUrl:"https://static.wikia.nocookie.net/harrypotter/images/7/7e/Draco_Malfoy_TDH.png/revision/latest/scale-to-width-down/300?cb=20180116013508",wiki:"harrypotter",wikiPage:"Draco Malfoy" },
{ id:"featured-harrypotter-Severus Snape", title:"Severus Snape",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/harrypotter/images/a/a3/Severus_Snape.jpg/revision/latest/scale-to-width-down/268?cb=20150307193047",avatarUrl:"https://static.wikia.nocookie.net/harrypotter/images/a/a3/Severus_Snape.jpg/revision/latest/scale-to-width-down/268?cb=20150307193047",wiki:"harrypotter",wikiPage:"Severus Snape" },
{ id:"featured-starwars-Luke Skywalker", title:"Luke Skywalker",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/starwars/images/3/3d/LukeSkywalker.png/revision/latest/scale-to-width-down/300?cb=20241221010122",avatarUrl:"https://static.wikia.nocookie.net/starwars/images/3/3d/LukeSkywalker.png/revision/latest/scale-to-width-down/300?cb=20241221010122",wiki:"starwars",wikiPage:"Luke Skywalker" },
{ id:"featured-starwars-Obi-Wan Kenobi", title:"Obi-Wan Kenobi",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/starwars/images/4/4e/ObiWanHS-SWE.jpg/revision/latest/scale-to-width-down/300?cb=20111115052816",avatarUrl:"https://static.wikia.nocookie.net/starwars/images/4/4e/ObiWanHS-SWE.jpg/revision/latest/scale-to-width-down/300?cb=20111115052816",wiki:"starwars",wikiPage:"Obi-Wan Kenobi" },
{ id:"featured-starwars-Yoda", title:"Yoda",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/starwars/images/d/d6/Yoda_SWSB.png/revision/latest/scale-to-width-down/333?cb=20150206140125",avatarUrl:"https://static.wikia.nocookie.net/starwars/images/d/d6/Yoda_SWSB.png/revision/latest/scale-to-width-down/333?cb=20150206140125",wiki:"starwars",wikiPage:"Yoda" },
{ id:"featured-batman-Bruce Wayne", title:"Bruce Wayne",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/marvel_dc/images/a/a2/Batman_Vol_3_124_Textless.jpg/revision/latest/scale-to-width-down/263?cb=20220608034122",avatarUrl:"https://static.wikia.nocookie.net/marvel_dc/images/a/a2/Batman_Vol_3_124_Textless.jpg/revision/latest/scale-to-width-down/263?cb=20220608034122",wiki:"batman",wikiPage:"Bruce Wayne" },
{ id:"featured-batman-Harley Quinn", title:"Harley Quinn",subtitle:'Character portrait',kind:'avatar',imageUrl:"https://static.wikia.nocookie.net/batman/images/0/09/Harley_Quinn_by_Bruce_Timm.jpg/revision/latest/scale-to-width-down/283?cb=20170730020330",avatarUrl:"https://static.wikia.nocookie.net/batman/images/0/09/Harley_Quinn_by_Bruce_Timm.jpg/revision/latest/scale-to-width-down/283?cb=20170730020330",wiki:"batman",wikiPage:"Harley Quinn" },
],
};

export async function popular(source:AvatarSource): Promise<Portrait[]> {
  if (source === 'anime') {
    const a=await optional(aniListTop,[] as Portrait[]);
    if(a.length>=15)return a.slice(0,15);
    const b=await optional(jikanTop,[] as Portrait[]);
    if(b.length>=15)return unique([...a,...b]).slice(0,15);
    const c=await optional(kitsuTop,[] as Portrait[]);
    return unique([...a,...b,...c]).slice(0,15);
  }
  const cached=FEATURED_IMAGES[source];
  if(cached.length>=15) return cached.slice(0,15);
  const fetched=await wikiGroups(source === 'tv' ? POPULAR_TV : POPULAR_MOVIES);
  return unique([...cached,...fetched],15);
}

async function tvCast(id:string, wiki:string|null):Promise<Portrait[]> {
  const cast=await requestJson('https://api.tvmaze.com/shows/'+encodeURIComponent(id)+'/cast');
  const members=(cast as any[]).slice(0,32).filter(c=>!c.self && c.character?.name);
  const photos=members.filter(c=>c.character?.image?.medium)
    .map(c=>toPortrait(c.character.name,c.character.image.medium,
      'tv-'+c.character.id,'Character photo'));
  const fallback=wiki ? await optional(()=>wikiPortraits(wiki,members.slice(0,22).map(x=>x.character.name)),
    [] as Portrait[]) : [];
  return unique([...photos,...fallback,...cachedWiki(wiki || '',members.slice(0,32).map(x=>x.character.name))],65);
}
async function tvSearch(query:string):Promise<{items:Portrait[],titles:Portrait[]}> {
  const response=await requestJson('https://api.tvmaze.com/search/shows?q='+encodeURIComponent(query));
  const results=(response as any[]).slice(0,5);
  const titles:Portrait[]=results.map(x=>({
    id:String(x.show.id),title:x.show.name,subtitle:'TV series',imageUrl:null,kind:'title',
  }));
  const picked=results.slice(0,2).map(x=>x.show);
  const casts=await Promise.all(picked.map(show=>optional(()=>tvCast(String(show.id),
    matchingWiki('tv',show.name)),[] as Portrait[])));
  const matched=POPULAR_TV.flatMap(g=>g.names.filter(name=>cleanKey(name).includes(cleanKey(query))).map(name=>({wiki:g.wiki,name})));
  const direct=await Promise.all(matched.slice(0,8).map(m=>
    optional(()=>wikiPortraits(m.wiki,[m.name]),[] as Portrait[])));
  return {items:unique([...casts.flat(),...direct.flat(),...POPULAR_TV.flatMap(g=>cachedWiki(g.wiki,[query]))]),titles};
}
async function tmdb(path:string,env:Env):Promise<any> {
  if(!env.TMDB_READ_ACCESS_TOKEN)throw new Error('TMDB_READ_ACCESS_TOKEN is not configured');
  return requestJson('https://api.themoviedb.org/3'+path,{
    headers:{Authorization:'Bearer '+env.TMDB_READ_ACCESS_TOKEN,Accept:'application/json'},
  });
}
async function movieCast(id:string,wiki:string|null,env:Env):Promise<Portrait[]> {
  // TMDB supplies character NAMES but only actor headshots. Use the names to
  // look up genuine character artwork on the franchise wiki instead.
  if(!wiki)return [];
  const credits=await tmdb('/movie/'+encodeURIComponent(id)+'/credits',env);
  const names:string[]=(credits.cast??[]).slice(0,30).map((c:any)=>c.character)
    .filter((s:unknown):s is string=>typeof s==='string' && s.length<70 && !!s.trim());
  const gallery=await optional(()=>wikiPortraits(wiki,names),[] as Portrait[]);
  const preferred=POPULAR_MOVIES.find(group=>group.wiki===wiki);
  const featured=preferred ? await optional(()=>wikiPortraits(wiki,preferred.names),[] as Portrait[]) : [];
  return unique([...gallery,...featured,...cachedWiki(wiki,names),...cachedWiki(wiki)],45);
}
async function movieSearch(query:string,env:Env):Promise<{items:Portrait[],titles:Portrait[]}> {
  const movies=await tmdb('/search/movie?query='+encodeURIComponent(query)+'&include_adult=false',env);
  const results=(movies.results??[]).slice(0,9);
  const titles:Portrait[]=results.map((movie:any)=>({
    id:String(movie.id),title:movie.title,subtitle:movie.release_date?.slice(0,4)||'Movie',
    imageUrl:null,kind:'title',
  }));
  const preferred=results
    .filter((movie:any)=>matchingWiki('movie',movie.title))
    .sort((a:any,b:any)=>{
      const age=(x:any)=>{const year=Number((x.release_date||'').slice(0,4));return year>2026?-100:year>0?100:0;};
      return (age(b)+(b.popularity||0))-(age(a)+(a.popularity||0));
    }).slice(0,2);
  const lists=await Promise.all(preferred.map((m:any)=>optional(()=>movieCast(String(m.id),
    matchingWiki('movie',m.title),env),[] as Portrait[])));
  const direct=POPULAR_MOVIES.flatMap(group=>group.names.filter(name=>
    cleanKey(name).includes(cleanKey(query))).map(name=>({wiki:group.wiki,name})));
  const matched=await Promise.all(direct.slice(0,8).map(item=>
    optional(()=>wikiPortraits(item.wiki,[item.name]),[] as Portrait[])));
  return {items:unique([...lists.flat(),...matched.flat(),...POPULAR_MOVIES.flatMap(g=>cachedWiki(g.wiki,[query]))]),titles};
}

export async function search(source:AvatarSource,query:string,env:Env,seriesHint?:string):
  Promise<{items:Portrait[],titles:Portrait[]}> {
  if(source==='anime')return kitsuSearch(query,seriesHint);
  if(source==='tv')return tvSearch(query);
  return movieSearch(query,env);
}
export async function characterList(source:AvatarSource,id:string,page:number,env:Env,seriesHint?:string):Promise<Portrait[]> {
  if(source==='anime') {
    if(id.startsWith('k-')){
      const chars=(await kitsuCharacters(id.slice(2),page)).items;
      if(page>1)return chars;
      const safe=await Promise.all(chars.slice(0,3)
        .map(char=>findSafeAnimePortraits(char.title,seriesHint,5)));
      return unique([...safe.flat(),...chars]);
    }
    const response=await requestJson('https://graphql.anilist.co',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({query:'query($id:Int,$page:Int){Media(id:$id,type:ANIME){characters(page:$page,perPage:25,sort:FAVOURITES_DESC){nodes{id name{full} image{large medium}}}}}',variables:{id:Number(id),page}}),
    });
    return unique((response?.data?.Media?.characters?.nodes??[]).filter((c:any)=>c.image?.large||c.image?.medium)
      .map((c:any)=>toPortrait(c.name.full,c.image.large||c.image.medium,'al-'+c.id,'Anime character')));
  }
  if(source==='tv')return tvCast(id,null);
  const movie=await tmdb('/movie/'+encodeURIComponent(id),env);
  return movieCast(id,matchingWiki('movie',movie.title||''),env);
}
export async function variations(wiki:string,page:string,malId:number|null):Promise<Portrait[]> {
  if(malId && !wiki) {
    const data=await requestJson('https://api.jikan.moe/v4/characters/'+malId+'/pictures');
    return unique((data.data??[]).filter((image:any)=>image.jpg?.image_url).map((image:any,i:number)=>
      toPortrait('Alternate portrait '+(i+1),image.jpg.image_url,'j-'+malId+'-alt-'+i,'Anime artwork')),9);
  }
  if(!WIKIS.has(wiki) || page.length>80 || !/^[\p{L}\p{N} '&.():_-]+$/u.test(page))return [];
  const root='https://'+wiki+'.fandom.com/api.php?';
  const parsed=await requestJson(root+new URLSearchParams({
    action:'parse',page,prop:'images',format:'json',
  }).toString());
  const stems=page.toLowerCase().split(/[\s_-]+/).filter(x=>x.length>=3);
  const files:string[]=(parsed?.parse?.images??[])
    .filter((name:string)=>/\.(?:png|jpg|jpeg|webp)$/i.test(name))
    .filter((name:string)=>stems.some(stem=>name.toLowerCase().includes(stem)))
    .slice(0,12);
  if(!files.length)return [];
  const pages=await requestJson(root+new URLSearchParams({
    action:'query',titles:files.map(name=>'File:'+name).join('|'),
    prop:'imageinfo',iiprop:'url',iiurlwidth:'340',format:'json',
  }).toString());
  const images:any[]=Object.values(pages?.query?.pages??{});
  return unique(images.filter(image=>image.imageinfo?.[0]?.thumburl || image.imageinfo?.[0]?.url)
    .map((image,i)=>toPortrait(page+' · '+(i+1),
      image.imageinfo[0].thumburl||image.imageinfo[0].url,
      'wiki-'+wiki+'-variation-'+image.pageid,'Alternate character look',wiki,page)),10);
}
