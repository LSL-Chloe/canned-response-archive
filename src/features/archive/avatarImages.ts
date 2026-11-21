/**
 * Catalog artwork is public. Prefer direct CDN delivery for the two pinned
 * streaming/curated icon packs, avoiding database-backed authentication for
 * every icon in a gallery. The Worker remains available as a fallback and
 * continues to proxy sources with unreliable hotlinking.
 */
const catalogHosts = new Set(['static.tvmaze.com', 'image.tmdb.org', 'media.kitsu.io', 'media.kitsu.app', 'cdn.anilist.co', 'static.wikia.nocookie.net', 'cdn.myanimelist.net', 'images.myanimelist.net', 'cdn.donmai.us']);
function pinnedIcon(url: URL): boolean {
  if (url.hostname === 'raw.githubusercontent.com') {
    return /^\/(?:eueueue292\/Fusion-Profile-Avatars\/d45287304717a441095003633a6643d6bae66289|kalibrado\/jf-avatars-images\/b483c1a06325509237891f87920453b6ced31d00)\//.test(url.pathname);
  }
  return /^occ-0-[0-9]+-[0-9]+\.1\.nflxso\.net$/.test(url.hostname) &&
    url.pathname.startsWith('/dnm/api/v6/vN7bi_My87NPKvsBoib006Llxzg/');
}
export function avatarImageSrc(value: string, directCatalogIcon = false): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && directCatalogIcon && pinnedIcon(url)) return value;
    if (url.protocol === 'https:' &&
      (catalogHosts.has(url.hostname) || /^s[1-9][0-9]*\.anilist\.co$/.test(url.hostname) ||
       (/^occ-0-[0-9]+-[0-9]+\.1\.nflxso\.net$/.test(url.hostname) &&
        url.pathname.startsWith('/dnm/api/v6/vN7bi_My87NPKvsBoib006Llxzg/')))) {
      return '/api/avatars/image?url=' + encodeURIComponent(url.toString());
    }
  } catch { /* Keep local images untouched. */ }
  return value;
}

/** CDN fallback for source-pinned community icons; no arbitrary domain is accepted. */
export function alternateAvatarImageSrc(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return value;
    // Retry Netflix's public icons through our restricted Worker route only
    // when direct CDN hotlinking has failed.
    if (pinnedIcon(url) && url.hostname !== 'raw.githubusercontent.com') {
      return '/api/avatars/image?url=' + encodeURIComponent(url.toString());
    }
    if (url.hostname !== 'raw.githubusercontent.com') return value;
    const match = url.pathname.match(/^\/(eueueue292\/Fusion-Profile-Avatars|kalibrado\/jf-avatars-images)\/([a-f0-9]{40})\/(.+)$/);
    if (!match || !/\.(?:png|jpe?g|webp)$/i.test(match[3] || '')) return value;
    return 'https://cdn.jsdelivr.net/gh/' + match[1] + '@' + match[2] + '/' + match[3];
  } catch { return value; }
}
