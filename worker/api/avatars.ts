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
  const allowed = /^(?:s[1-9][0-9]*\.anilist\.co|cdn\.anilist\.co|static\.tvmaze\.com|image\.tmdb\.org)$/i.test(url.hostname);
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

async function search(source: Source, term: string, env: Env): Promise<CatalogEntry[]> {
  if (source === 'anime') {
    const data = await anilist(
      'query($term:String) { Page(page:1, perPage:20) { media(search:$term, type:ANIME) { id title { english romaji } coverImage { medium large } } characters(search:$term) { id name { full } image { medium large } } } }',
      { term },
    );
    const media: CatalogEntry[] = (data?.Page?.media ?? []).map((item: any) => ({
      id: String(item.id), title: item.title.english || item.title.romaji || 'Anime',
      subtitle: 'Anime series', imageUrl: item.coverImage?.large || item.coverImage?.medium || null, kind: 'title',
    }));
    const characters: CatalogEntry[] = (data?.Page?.characters ?? []).filter((item: any) => item.image?.large).map((item: any) => ({
      id: String(item.id), title: item.name?.full || 'Character',
      subtitle: 'Anime character', imageUrl: item.image.large, kind: 'avatar', avatarUrl: item.image.large,
    }));
    return [...media, ...characters];
  }
  if (source === 'tv') {
    const params = '?q=' + encodeURIComponent(term);
    const [series, people] = await Promise.all([
      upstream('https://api.tvmaze.com/search/shows' + params),
      upstream('https://api.tvmaze.com/search/people' + params),
    ]);
    const titles: CatalogEntry[] = series.slice(0, 20).map((item: any) => ({
      id: String(item.show.id), title: item.show.name, subtitle: 'TV series',
      imageUrl: item.show.image?.medium || null, kind: 'title',
    }));
    const portraits: CatalogEntry[] = people.slice(0, 12).filter((item: any) => item.person.image?.medium).map((item: any) => ({
      id: String(item.person.id), title: item.person.name, subtitle: 'Actor portrait',
      imageUrl: item.person.image.medium, kind: 'avatar', avatarUrl: item.person.image.original || item.person.image.medium,
    }));
    return [...titles, ...portraits];
  }
  const params = '?query=' + encodeURIComponent(term) + '&include_adult=false';
  const [movies, people] = await Promise.all([
    tmdb('/search/movie' + params, env),
    tmdb('/search/person' + params, env),
  ]);
  const titles: CatalogEntry[] = (movies.results ?? []).slice(0, 20).map((item: any) => ({
    id: String(item.id), title: item.title, subtitle: item.release_date?.slice(0, 4) || 'Movie',
    imageUrl: tmdbImage(item.poster_path), kind: 'title',
  }));
  const portraits: CatalogEntry[] = (people.results ?? []).slice(0, 12).filter((item: any) => item.profile_path).map((item: any) => ({
    id: String(item.id), title: item.name, subtitle: 'Actor portrait',
    imageUrl: tmdbImage(item.profile_path), kind: 'avatar', avatarUrl: tmdbImage(item.profile_path)!,
  }));
  return [...titles, ...portraits];
}
async function characters(source: Source, id: string, page: number, env: Env): Promise<{ items: CatalogEntry[]; hasMore: boolean }> {
  if (source === 'anime') {
    const data = await anilist(
      'query($id:Int,$page:Int) { Media(id:$id, type:ANIME) { characters(page:$page, perPage:40) { pageInfo { hasNextPage } nodes { id name { full } image { large medium } } } } }',
      { id: Number(id), page },
    );
    return {
      items: (data?.Media?.characters?.nodes ?? []).filter((item: any) => item.image?.large || item.image?.medium).map((item: any) => ({
        id: String(item.id), title: item.name?.full || 'Character',
        subtitle: 'Anime character', imageUrl: item.image.large || item.image.medium, kind: 'avatar',
        avatarUrl: item.image.large || item.image.medium,
      })),
      hasMore: data?.Media?.characters?.pageInfo?.hasNextPage === true,
    };
  }
  if (source === 'tv') {
    const cast = await upstream('https://api.tvmaze.com/shows/' + id + '/cast');
    return {
      items: (cast as any[]).filter((item: any) => item.character?.image?.medium || item.person?.image?.medium).map((item: any) => {
        const characterImage = item.character?.image?.original || item.character?.image?.medium;
        const portrait = characterImage || item.person?.image?.original || item.person?.image?.medium;
        return {
          id: String(item.character?.id || item.person?.id), title: item.character?.name || item.person?.name || 'Character',
          subtitle: characterImage ? 'Character photo' : 'Actor portrait · ' + (item.person?.name || ''),
          imageUrl: portrait, avatarUrl: portrait, kind: 'avatar',
        };
      }),
      hasMore: false,
    };
  }
  const credits = await tmdb('/movie/' + id + '/credits', env);
  return {
    items: (credits.cast ?? []).filter((item: any) => item.profile_path).map((item: any) => ({
      id: String(item.cast_id ?? item.id), title: item.character || item.name, subtitle: 'Actor portrait · ' + item.name,
      imageUrl: tmdbImage(item.profile_path), avatarUrl: tmdbImage(item.profile_path)!, kind: 'avatar',
    })),
    hasMore: false,
  };
}

export async function handleAvatars(request: Request, env: Env, path: string, url: URL): Promise<Response> {
  const signed = await getSession(env, request);
  if (!signed) fail(401, 'login_required', 'Sign in to manage your profile picture');
  const agentId = signed.agent.id;

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
    if (!/^[0-9]{1,10}$/.test(id) || !Number.isInteger(page) || page < 1 || page > 30) {
      fail(400, 'invalid_id', 'Choose a catalog title');
    }
    if (!await requireRateLimit(env, 'avatar:characters:' + agentId, 90, 900)) fail(429, 'rate_limited', 'Too many catalog requests');
    return json(await characters(source, id, page, env));
  }
  return fail(404, 'not_found', 'Avatar route not found');
}
