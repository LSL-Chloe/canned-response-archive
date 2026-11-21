/** Route third-party images through our authenticated Worker to avoid broken hotlinks. */
const catalogHosts = new Set(['static.tvmaze.com', 'image.tmdb.org', 'media.kitsu.io', 'media.kitsu.app', 'cdn.anilist.co', 'static.wikia.nocookie.net', 'cdn.myanimelist.net', 'images.myanimelist.net', 'cdn.donmai.us']);
export function avatarImageSrc(value: string): string {
  try {
    const url = new URL(value);
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
    if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com') return value;
    const match = url.pathname.match(/^\/(eueueue292\/Fusion-Profile-Avatars|kalibrado\/jf-avatars-images)\/([a-f0-9]{40})\/(.+)$/);
    if (!match || !/\.(?:png|jpe?g|webp)$/i.test(match[3] || '')) return value;
    return 'https://cdn.jsdelivr.net/gh/' + match[1] + '@' + match[2] + '/' + match[3];
  } catch { return value; }
}
