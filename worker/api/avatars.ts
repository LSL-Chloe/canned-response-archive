import { database, queryTable, type Env } from '../services/db.ts';
import { getSession, requireRateLimit } from '../auth/session.ts';
import { fail, json, readJson } from './shared.ts';

type Source = 'anime' | 'tv' | 'movie';
interface CatalogEntry {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string | null;
  kind: 'title' | 'avatar';
  avatarUrl?: string;
}
const BUCKET = 'archive-avatars';
const MAX_UPLOAD_BYTES = 150_000;

function sourceFrom(raw: string | null): Source {
  if (raw !== 'anime' && raw !== 'tv' && raw !== 'movie') {
    fail(400, 'invalid_source', 'Choose Anime, TV or Movies');
  }
  return raw;
}
function sourceUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 600) fail(400, 'invalid_avatar', 'Choose a valid avatar');
  let url: URL;
  try { url = new URL(value); } catch { return fail(400, 'invalid_avatar', 'Choose an image from the catalog'); }
  const allowed = /^(?:s[1-9][0-9]*\.anilist\.co|cdn\.anilist\.co|static\.tvmaze\.com|image\.tmdb\.org|media\.kitsu\.(?:io|app))$/i.test(url.hostname);
  if (url.protocol !== 'https:' || !allowed || url.username || url.password || url.port) {
    fail(400, 'invalid_avatar', 'This image source is not supported');
  }
  return url.toString();
}
async function upstream(url: string, init?: RequestInit): Promise<any> {
  const reply = await fetch(url, { ...init, signal: AbortSignal.timeout(9000) });
  if (reply.status === 429) fail(429, 'source_rate_limited', 'Image catalog is busy; try again shortly');
  if (!reply.ok) fail(502, 'catalog_unavailable', 'Avatar catalog is temporarily unavailable');
  return reply.json();
}
async function anilist(query: string, variables: Record<string, unknown>): Promise<any> {
  const value = await upstream('https://graphql.anilist.co', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (value.errors?.length) fail(502, 'catalog_unavailable', 'Anime catalog is temporarily unavailable');
  return value.data;
}
function tmdbImage(path: string | null | undefined): string | null {
  return path ? 'https://image.tmdb.org/t/p/w342' + path : null;
}
async function tmdb(path: string, env: Env): Promise<any> {
  if (!env.TMDB_READ_ACCESS_TOKEN) fail(503, 'tmdb_unconfigured', 'Add TMDB_READ_ACCESS_TOKEN to the Worker to enable movie avatars');
  return upstream('https://api.themoviedb.org/3' + path, {
    headers: { Authorization: 'Bearer ' + env.TMDB_READ_ACCESS_TOKEN, Accept: 'application/json' },
  });
}


function kitsuPicture(record: any): string | null {
  const images = record?.attributes?.image;
  return images?.original || images?.large || images?.medium || null;
}
function kitsuCharacter(record: any): CatalogEntry | null {
  const url = kitsuPicture(record);
  if (!url) return null;
  return {
    id: 'k-' + record.id,
    title: record.attributes?.canonicalName || record.attributes?.name || 'Character',
    subtitle: 'Anime character',
    imageUrl: url, avatarUrl: url, kind: 'avatar',
  };
}
async function kitsuSearch(term: string): Promise<CatalogEntry[]> {
  const searchText = encodeURIComponent(term);
  const [shows, people] = await Promise.all([
    upstream('https://kitsu.io/api/edge/anime?filter%5Btext%5D=' + searchText + '&page%5Blimit%5D=15'),
    upstream('https://kitsu.io/api/edge/characters?filter%5Bname%5D=' + searchText + '&page%5Blimit%5D=20'),
  ]);
  const titles: CatalogEntry[] = (shows.data ?? []).map((item: any) => ({
    id: 'k-' + item.id,
    title: item.attributes?.titles?.en || item.attributes?.canonicalTitle || 'Anime',
    subtitle: 'Anime series', imageUrl: null, kind: 'title',
  }));
  const portraits: CatalogEntry[] = (people.data ?? []).map(kitsuCharacter)
    .filter((item: CatalogEntry | null): item is CatalogEntry => Boolean(item));
  return [...titles, ...portraits];
}
async function kitsuCharacters(id: string, page: number): Promise<{ items: CatalogEntry[]; hasMore: boolean }> {
  const offset = (page - 1) * 20;
  const result = await upstream(
    'https://kitsu.io/api/edge/anime/' + id + '/characters?include=character&page%5Blimit%5D=20&page%5Boffset%5D=' + offset,
  );
  const byId = new Map<string, any>((result.included ?? []).map((record: any) => [record.id, record]));
  const items: CatalogEntry[] = (result.data ?? [])
    .map((entry: any) => kitsuCharacter(byId.get(entry.relationships?.character?.data?.id)))
    .filter((entry: CatalogEntry | null): entry is CatalogEntry => Boolean(entry));
  return { items, hasMore: Boolean(result.links?.next) };
}

async function search(source: Source, term: string, env: Env): Promise<CatalogEntry[]> {
  if (source === 'anime') {
    try {
      const data = await anilist(
        'query($term:String) { Page(page:1, perPage:20) { media(search:$term, type:ANIME, isAdult:false) { id title { english romaji } } characters(search:$term) { id name { full } image { medium large } } } }',
        { term },
      );
      const titles: CatalogEntry[] = (data?.Page?.media ?? []).map((item: any) => ({
        id: String(item.id), title: item.title?.english || item.title?.romaji || 'Anime',
        subtitle: 'Anime series', imageUrl: null, kind: 'title',
      }));
      const portraits: CatalogEntry[] = (data?.Page?.characters ?? [])
        .filter((item: any) => item.image?.large || item.image?.medium)
        .map((item: any) => ({
          id: String(item.id), title: item.name?.full || 'Character',
          subtitle: 'Anime character', imageUrl: item.image.large || item.image.medium,
          avatarUrl: item.image.large || item.image.medium, kind: 'avatar',
        }));
      if (titles.length || portraits.length) return [...titles, ...portraits];
    } catch {
      // AniList sometimes rejects Cloudflare Worker egress. Use Kitsu's public
      // character catalog instead of displaying an unavailable error.
    }
    return kitsuSearch(term);
  }
  if (source === 'tv') {
    const shows = await upstream('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(term));
    return (shows as any[]).slice(0, 25).map((item: any) => ({
      id: String(item.show.id), title: item.show.name,
      subtitle: item.show.premiered?.slice(0, 4) || 'TV series', imageUrl: null, kind: 'title',
    }));
  }
  const params = '?query=' + encodeURIComponent(term) + '&include_adult=false';
  const [movies, people] = await Promise.all([
    tmdb('/search/movie' + params, env),
    tmdb('/search/person' + params, env),
  ]);
  // Movie posters are NOT profile pictures. Titles are navigation rows only.
  const titles: CatalogEntry[] = (movies.results ?? []).slice(0, 20).map((item: any) => ({
    id: String(item.id), title: item.title,
    subtitle: item.release_date?.slice(0, 4) || 'Movie',
    imageUrl: null, kind: 'title',
  }));
  const peoplePortraits: CatalogEntry[] = (people.results ?? []).slice(0, 10)
    .filter((item: any) => item.profile_path && item.name?.toLowerCase().includes(term.toLowerCase()))
    .map((item: any) => ({
      id: String(item.id), title: item.name, subtitle: 'Actor portrait',
      imageUrl: tmdbImage(item.profile_path), kind: 'avatar', avatarUrl: tmdbImage(item.profile_path)!,
    }));
  return [...titles, ...peoplePortraits];
}
async function characters(source: Source, id: string, page: number, env: Env): Promise<{ items: CatalogEntry[]; hasMore: boolean }> {
  if (source === 'anime') {
    if (id.startsWith('k-')) return kitsuCharacters(id.slice(2), page);
    const data = await anilist(
      'query($id:Int,$page:Int) { Media(id:$id, type:ANIME) { characters(page:$page, perPage:40) { pageInfo { hasNextPage } nodes { id name { full } image { large medium } } } } }',
      { id: Number(id), page },
    );
    return {
      items: (data?.Media?.characters?.nodes ?? [])
        .filter((item: any) => item.image?.large || item.image?.medium)
        .map((item: any) => ({
          id: String(item.id), title: item.name?.full || 'Character', subtitle: 'Anime character',
          imageUrl: item.image.large || item.image.medium,
          avatarUrl: item.image.large || item.image.medium, kind: 'avatar',
        })),
      hasMore: data?.Media?.characters?.pageInfo?.hasNextPage === true,
    };
  }
  if (source === 'tv') {
    const cast = await upstream('https://api.tvmaze.com/shows/' + id + '/cast');
    return {
      items: (cast as any[])
        .filter((item: any) => item.character?.image?.medium || item.person?.image?.medium)
        .map((item: any) => {
          const characterPhoto = item.character?.image?.medium;
          const imageUrl = characterPhoto || item.person?.image?.medium;
          return {
            id: String(item.character?.id || item.person?.id),
            title: item.character?.name || item.person?.name || 'Character',
            subtitle: characterPhoto ? 'Character portrait' : 'Cast portrait · ' + (item.person?.name || ''),
            imageUrl, avatarUrl: imageUrl, kind: 'avatar',
          };
        }),
      hasMore: false,
    };
  }
  const credits = await tmdb('/movie/' + id + '/credits', env);
  return {
    items: (credits.cast ?? [])
      .filter((item: any) => item.profile_path)
      .slice(0, 100)
      .map((item: any) => ({
        id: String(item.cast_id ?? item.id), title: item.character || item.name,
        subtitle: 'Cast portrait · ' + item.name,
        imageUrl: tmdbImage(item.profile_path), avatarUrl: tmdbImage(item.profile_path)!,
        kind: 'avatar',
      })),
    hasMore: false,
  };
}

export async function handleAvatars(request: Request, env: Env, path: string, url: URL): Promise<Response> {
  const signed = await getSession(env, request);
  if (!signed) fail(401, 'login_required', 'Sign in to manage your profile picture');
  const agentId = signed.agent.id;


  if (path === '/api/avatars/image' && request.method === 'GET') {
    const raw = sourceUrl(url.searchParams.get('url'));
    if (!raw) fail(400, 'invalid_image', 'Choose an image');
    // Strict allowlist + no redirects: this must never become an arbitrary URL proxy.
    const response = await fetch(raw, {
      redirect: 'manual', signal: AbortSignal.timeout(9000),
      headers: { Accept: 'image/avif,image/webp,image/jpeg,image/png,image/gif' },
    });
    if (!response.ok) fail(502, 'image_unavailable', 'Portrait image unavailable');
    const mime = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(mime)) {
      fail(502, 'invalid_image', 'Portrait source did not return an image');
    }
    const limit = 2_500_000;
    if (Number(response.headers.get('Content-Length') || 0) > limit) fail(413, 'image_too_large', 'Portrait is too large');
    const body = await response.arrayBuffer();
    if (body.byteLength > limit) fail(413, 'image_too_large', 'Portrait is too large');
    return new Response(body, {
      status: 200, headers: {
        'Content-Type': mime, 'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (path === '/api/account/avatar' && request.method === 'GET') {
    const rows = await queryTable<{ avatar_url: string | null }>(env, 'agents', {
      select: 'avatar_url', id: 'eq.' + agentId, limit: '1',
    });
    return json({ avatarUrl: rows[0]?.avatar_url ?? null });
  }
  if (path === '/api/account/avatar' && request.method === 'PATCH') {
    if (!await requireRateLimit(env, 'avatar:change:' + agentId, 24, 3600)) fail(429, 'rate_limited', 'Too many changes');
    const body = await readJson(request);
    const avatarUrl = sourceUrl(body.avatarUrl);
    await database(env, 'agents', { method: 'PATCH', query: { id: 'eq.' + agentId }, body: { avatar_url: avatarUrl } });
    return json({ avatarUrl });
  }
  if (path === '/api/account/avatar/upload' && request.method === 'POST') {
    if (!await requireRateLimit(env, 'avatar:upload:' + agentId, 12, 3600)) fail(429, 'rate_limited', 'Too many uploads');
    const body = await readJson(request);
    const value = body.imageData;
    if (typeof value !== 'string' || !/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(value)) {
      fail(400, 'invalid_image', 'Upload a JPG, PNG or WebP image');
    }
    const data = value.slice('data:image/jpeg;base64,'.length);
    if (data.length > Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 4) fail(413, 'image_too_large', 'Avatar image is too large');
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0)); }
    catch { return fail(400, 'invalid_image', 'Avatar image could not be read'); }
    if (bytes.length < 100 || bytes.length > MAX_UPLOAD_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      fail(400, 'invalid_image', 'Avatar must be a small JPEG image');
    }
    const uploadUrl = new URL('/storage/v1/object/' + BUCKET + '/' + agentId + '/avatar.jpg', env.SUPABASE_URL);
    const headers: Record<string, string> = {
      apikey: env.SUPABASE_SECRET_KEY!, 'Content-Type': 'image/jpeg', 'x-upsert': 'true',
      'Cache-Control': 'max-age=60',
    };
    if (env.SUPABASE_SECRET_KEY!.startsWith('eyJ')) headers.Authorization = 'Bearer ' + env.SUPABASE_SECRET_KEY;
    const reply = await fetch(uploadUrl.toString(), { method: 'POST', headers, body: bytes });
    if (!reply.ok) fail(502, 'upload_failed', 'Could not save the avatar image');
    const avatarUrl = new URL('/storage/v1/object/public/' + BUCKET + '/' + agentId + '/avatar.jpg', env.SUPABASE_URL);
    avatarUrl.searchParams.set('v', String(Date.now()));
    await database(env, 'agents', { method: 'PATCH', query: { id: 'eq.' + agentId }, body: { avatar_url: avatarUrl.toString() } });
    return json({ avatarUrl: avatarUrl.toString() });
  }
  if (path === '/api/avatars/search' && request.method === 'GET') {
    const source = sourceFrom(url.searchParams.get('source'));
    const term = (url.searchParams.get('q') || '').trim();
    if (term.length < 2 || term.length > 80) fail(400, 'invalid_query', 'Search with 2–80 characters');
    if (!await requireRateLimit(env, 'avatar:search:' + agentId, 90, 900)) fail(429, 'rate_limited', 'Too many searches');
    return json({ items: await search(source, term, env), movieConfigured: Boolean(env.TMDB_READ_ACCESS_TOKEN) });
  }
  if (path === '/api/avatars/characters' && request.method === 'GET') {
    const source = sourceFrom(url.searchParams.get('source'));
    const id = url.searchParams.get('id') || '';
    const page = Number(url.searchParams.get('page') || '1');
    if (!/^(?:k-)?[0-9]{1,10}$/.test(id) || !Number.isInteger(page) || page < 1 || page > 30) {
      fail(400, 'invalid_id', 'Choose a catalog title');
    }
    if (!await requireRateLimit(env, 'avatar:characters:' + agentId, 90, 900)) fail(429, 'rate_limited', 'Too many catalog requests');
    return json(await characters(source, id, page, env));
  }
  return fail(404, 'not_found', 'Avatar route not found');
}
