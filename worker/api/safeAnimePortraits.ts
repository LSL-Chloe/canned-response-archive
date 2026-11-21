/**
 * Supplemental SFW character artwork search.
 *
 * Safebooru's character-tag index helps find good images for anime characters
 * missing from our curated avatar packs. Only public "general" rated, solo,
 * single-character, sufficiently detailed still images are returned.
 *
 * The two-tag limit is respected: posts use <character-tag> + solo; we verify
 * rating and all other quality constraints on every returned post.
 */
export interface SafeAnimeAvatar {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  avatarUrl: string;
  kind: 'avatar';
  provider: 'safebooru';
  booruTag: string;
}

type CharacterTag = { name: string; post_count: number; category: number };
type Post = {
  id: number;
  rating?: string;
  score?: number;
  fav_count?: number;
  is_deleted?: boolean;
  file_ext?: string;
  image_width?: number;
  image_height?: number;
  tag_string_general?: string;
  tag_string_character?: string;
  media_asset?: { variants?: { type?: string; url?: string }[] };
};

const BASE = 'https://safebooru.donmai.us';
const EXCLUDED = new Set([
  'sketch', 'lineart', 'line_art', 'rough_sketch', 'white_background',
  'monochrome', 'greyscale', 'grayscale', 'manga', 'comic', '4koma',
  'multiple_views', 'reference_sheet', 'character_sheet',
  'text_only', 'lowres', 'cropped_head', 'guro',
]);
const TTL_MS = 12 * 60_000;
const cache = new Map<string, { savedAt: number; images: SafeAnimeAvatar[] }>();

function normalize(text: string): string {
  return text.normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function parts(value: string): string[] {
  return normalize(value).split(/\s+/).filter(token => token.length > 0);
}
function tagWords(tag: string): Set<string> {
  return new Set(parts(tag));
}
function matchesName(tag: string, person: string): boolean {
  const actual = tagWords(tag);
  const expected = parts(person);
  return expected.length > 0 && expected.every(word => actual.has(word));
}
export function sortedTags(tags: CharacterTag[], name: string, series?: string): CharacterTag[] {
  const desired = normalize(name);
  const seriesTokens = parts(series || '').filter(x => x.length >= 3);
  const score = (tag: CharacterTag) => {
    const target = normalize(tag.name);
    const words = tagWords(tag.name);
    const exact = target === desired ? 10_000 : 0;
    const prefix = target.startsWith(desired + ' ') ? 950 : 0;
    const seriesHit = seriesTokens.length && seriesTokens.every(t => words.has(t)) ? 3000 : 0;
    const popularity = Math.min(tag.post_count || 0, 12000) / 10;
    return exact + prefix + seriesHit + popularity;
  };
  return tags.filter(tag => tag.category === 4 && tag.post_count > 8 && matchesName(tag.name, name))
    .sort((a,b) => score(b) - score(a));
}
async function json<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) throw new Error('Anime artwork provider unavailable');
  return res.json() as Promise<T>;
}
async function resolveTag(name: string, series?: string): Promise<string | null> {
  const tokens = parts(name);
  if (!tokens.length || tokens.join('').length < 2 || tokens.join('').length > 60) return null;
  // "Satoru Gojo" -> *gojo*, "Monkey D. Luffy" -> *luffy*.
  // The results are checked against ALL name tokens, never just this suffix.
  const suffix = tokens[tokens.length - 1]!;
  const params = new URLSearchParams({
    'search[name_matches]': '*' + suffix + '*',
    'search[category]': '4',
    'search[order]': 'count',
    limit: '65',
  });
  const tags = await json<CharacterTag[]>('/tags.json?' + params);
  return sortedTags(tags, name, series)[0]?.name ?? null;
}
export function selectSafePortraits(
  posts: Post[], exactTag: string, displayName: string, limit = 8,
): SafeAnimeAvatar[] {
  if (!/^[a-z0-9_:.!()'&-]{2,110}$/i.test(exactTag)) return [];
  const results: { post: Post; image: string; rank: number }[] = [];
  for (const post of posts) {
    if (post.rating !== 'g' || post.is_deleted || !Number.isSafeInteger(post.id)) continue;
    if (!['jpg','jpeg','png','webp'].includes(post.file_ext || '')) continue;
    if ((post.image_width || 0) < 500 || (post.image_height || 0) < 450) continue;
    const characters = (post.tag_string_character || '').trim().split(/\s+/).filter(Boolean);
    // Enforce one real character; reject cosplay and multi-person montages.
    if (characters.length !== 1 || characters[0] !== exactTag) continue;
    const general = new Set((post.tag_string_general || '').split(/\s+/));
    if (!general.has('solo') || [...EXCLUDED].some(tag => general.has(tag))) continue;
    const ratio = (post.image_width || 1) / (post.image_height || 1);
    if (ratio < .51 || ratio > 1.75) continue;
    const variants = post.media_asset?.variants || [];
    const url = variants.find(v => v.type === '360x360')?.url;
    if (!url || !/^https:\/\/cdn\.donmai\.us\/360x360\/[a-z0-9/.-]+\.jpg$/i.test(url)) continue;
    const tags = ['portrait','close-up','headshot','upper_body','face','looking_at_viewer'];
    const detail = tags.filter(tag => general.has(tag)).length;
    const rank = Math.min(post.score || 0, 200) * 1.3 + (post.fav_count || 0) * .14 +
      detail * 10 - (general.has('full_body') ? 9 : 0) -
      (ratio < .62 || ratio > 1.48 ? 7 : 0);
    results.push({ post, image: url, rank });
  }
  return results.sort((a,b) => b.rank - a.rank).slice(0, Math.max(0,Math.min(limit,18)))
    .map(({post,image}) => ({
      id: 'safebooru:' + post.id,
      title: displayName,
      subtitle: 'Single-character artwork',
      kind: 'avatar',
      imageUrl: image,
      avatarUrl: image,
      provider: 'safebooru',
      booruTag: exactTag,
    }));
}
async function postsForTag(tag: string, name: string, limit: number): Promise<SafeAnimeAvatar[]> {
  const params = new URLSearchParams({ tags: tag + ' solo', limit: '100' });
  const posts = await json<Post[]>('/posts.json?' + params);
  return selectSafePortraits(posts, tag, name, limit);
}
export async function findSafeAnimePortraits(
  name: string, series?: string, count = 5,
): Promise<SafeAnimeAvatar[]> {
  const cacheKey = normalize(name) + '|' + normalize(series || '') + '|' + count;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < TTL_MS) return cached.images;
  try {
    const tag = await resolveTag(name, series);
    if (!tag) return [];
    const images = await postsForTag(tag, name, count);
    if (cache.size > 120) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { savedAt: Date.now(), images });
    return images;
  } catch {
    // Source is optional; curated icons and existing providers still work.
    return [];
  }
}
export async function moreSafeAnimePortraits(tag: string): Promise<SafeAnimeAvatar[]> {
  if (!/^[a-z0-9_:.!()'&-]{2,110}$/i.test(tag)) return [];
  // Only post tags that exist in the provider's public character category.
  // Never interpolate arbitrary domains, HTTP URLs or other API parameters.
  const name = tag.replace(/\([^)]*\)/g,'').replace(/_/g,' ').trim();
  try { return await postsForTag(tag, name, 16); }
  catch { return []; }
}
