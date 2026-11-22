import { database, queryTable, type Env } from '../services/db.ts';
import { getSession, requireRateLimit } from '../auth/session.ts';
import { fail, json, readJson, readLimitedBytes } from './shared.ts';
import { popular, search, characterList, variations, type AvatarSource } from './avatarCatalog.ts';
import { moreSafeAnimePortraits } from './safeAnimePortraits.ts';

const BUCKET = 'archive-avatars';
const MAX_UPLOAD_BYTES = 150_000;
function sourceFrom(raw: string | null): AvatarSource {
  if (raw !== 'anime' && raw !== 'tv' && raw !== 'movie') {
    fail(400, 'invalid_source', 'Choose Anime, TV or Movies');
  }
  return raw;
}
function sourceUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 900) fail(400, 'invalid_avatar', 'Choose a valid avatar');
  let url: URL;
  try { url = new URL(value); } catch { return fail(400, 'invalid_avatar', 'Choose an image from the catalog'); }
  const allowed = /^(?:s[1-9][0-9]*\.anilist\.co|cdn\.anilist\.co|static\.tvmaze\.com|image\.tmdb\.org|media\.kitsu\.(?:io|app)|static\.wikia\.nocookie\.net|cdn\.myanimelist\.net|images\.myanimelist\.net|cdn\.donmai\.us)$/i.test(url.hostname);
  const rawRepo = url.hostname === 'raw.githubusercontent.com' && (
    url.pathname.startsWith('/eueueue292/Fusion-Profile-Avatars/d45287304717a441095003633a6643d6bae66289/') ||
    url.pathname.startsWith('/kalibrado/jf-avatars-images/b483c1a06325509237891f87920453b6ced31d00/')
  ) && /\.(png|jpe?g|webp)$/i.test(url.pathname);
  // Netflix's public avatar CDN has dynamic shard hostnames. Restrict this
  // exception to the exact PNG-avatar path and its three-digit revision key.
  const netflixIcon = /^occ-0-[0-9]+-[0-9]+\.1\.nflxso\.net$/i.test(url.hostname) &&
    /^\/dnm\/api\/v6\/vN7bi_My87NPKvsBoib006Llxzg\/[A-Za-z0-9_-]{90,}\.png$/.test(url.pathname) &&
    url.searchParams.size === 1 && /^[a-f0-9]{3}$/i.test(url.searchParams.get('r') || '');
  if (url.protocol !== 'https:' || !(allowed || rawRepo || netflixIcon) || url.username || url.password || url.port) {
    fail(400, 'invalid_avatar', 'This image source is not supported');
  }
  return url.toString();
}

export async function handleAvatars(request: Request, env: Env, path: string, url: URL): Promise<Response> {
  const signed = await getSession(env, request);

  if (path === '/api/avatars/image' && request.method === 'GET') {
    const raw = sourceUrl(url.searchParams.get('url'));
    if (!raw) fail(400, 'invalid_image', 'Choose an image');
    if (!signed) {
      // The team directory is public. Permit its currently selected catalog
      // pictures, but do NOT turn the signed-in catalog proxy into an arbitrary
      // anonymous fetch endpoint. Match the exact stored image URL first.
      const selected = await queryTable<{ id: string }>(env, 'agents', {
        select: 'id', avatar_url: `eq.${raw}`, limit: '1',
      });
      if (!selected.length) fail(403, 'not_public_avatar', 'This image is not a selected public profile picture');
      if (!await requireRateLimit(env, 'avatar:public:' +
        (request.headers.get('CF-Connecting-IP') || 'guest'), 160, 900)) {
        fail(429, 'rate_limited', 'Too many public avatar requests');
      }
    }
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
    // The upstream can omit Content-Length or lie about its size.
    // Stream with a strict cap instead of buffering an unlimited response.
    const bytes = await readLimitedBytes(response.body, limit);
    return new Response(bytes, {
      status: 200, headers: {
        'Content-Type': mime, 'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

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
  if (path === '/api/avatars/popular' && request.method === 'GET') {
    const source = sourceFrom(url.searchParams.get('source'));
    if (!await requireRateLimit(env, 'avatar:popular:' + agentId, 90, 900)) fail(429,'rate_limited','Too many catalog requests');
    return json({ items: await popular(source) });
  }
  if (path === '/api/avatars/search' && request.method === 'GET') {
    const source = sourceFrom(url.searchParams.get('source'));
    const term = (url.searchParams.get('q') || '').trim();
    if (term.length < 2 || term.length > 80) fail(400, 'invalid_query', 'Search with 2–80 characters');
    if (!await requireRateLimit(env, 'avatar:search:' + agentId, 90, 900)) fail(429, 'rate_limited', 'Too many searches');
    const hint=(url.searchParams.get('series') || '').trim().slice(0,80);
    return json(await search(source, term, env, hint));
  }
  if (path === '/api/avatars/characters' && request.method === 'GET') {
    const source = sourceFrom(url.searchParams.get('source'));
    const id = url.searchParams.get('id') || '';
    const page = Number(url.searchParams.get('page') || '1');
    if (!/^(?:k-)?[0-9]{1,10}$/.test(id) || !Number.isInteger(page) || page < 1 || page > 30)
      fail(400, 'invalid_id', 'Choose a series or movie');
    if (!await requireRateLimit(env,'avatar:characters:'+agentId,90,900))fail(429,'rate_limited','Too many catalog requests');
    const series=(url.searchParams.get('series') || '').trim().slice(0,80);
    const items = await characterList(source,id,page,env,series);
    return json({ items, hasMore: items.length >= 20 && source === 'anime' });
  }
  if (path === '/api/avatars/booru-looks' && request.method === 'GET') {
    const tag=(url.searchParams.get('tag') || '').trim();
    if (!/^[a-z0-9_:.!()'&-]{2,110}$/i.test(tag))
      fail(400,'invalid_tag','Choose a known character');
    if (!await requireRateLimit(env,'avatar:booru-looks:'+agentId,24,900))
      fail(429,'rate_limited','Too many portrait requests');
    return json({ items: await moreSafeAnimePortraits(tag) });
  }
  if (path === '/api/avatars/variations' && request.method === 'GET') {
    const wiki=(url.searchParams.get('wiki')||'').trim();
    const page=(url.searchParams.get('page')||'').trim();
    const malId=Number(url.searchParams.get('malId')||0);
    if (!Number.isSafeInteger(malId)||malId<0||malId>10000000)fail(400,'invalid_id','Choose a character');
    if (!await requireRateLimit(env,'avatar:variations:'+agentId,40,900))fail(429,'rate_limited','Too many image requests');
    return json({ items: await variations(wiki,page,malId||null) });
  }
  return fail(404, 'not_found', 'Avatar route not found');
}
