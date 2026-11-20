/** Route third-party images through our authenticated Worker to avoid broken hotlinks. */
const catalogHosts = new Set(['static.tvmaze.com', 'image.tmdb.org', 'media.kitsu.io', 'media.kitsu.app', 'cdn.anilist.co']);
export function avatarImageSrc(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' &&
      (catalogHosts.has(url.hostname) || /^s[1-9][0-9]*\.anilist\.co$/.test(url.hostname))) {
      return '/api/avatars/image?url=' + encodeURIComponent(url.toString());
    }
  } catch { /* Keep local images untouched. */ }
  return value;
}
