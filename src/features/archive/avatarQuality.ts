/**
 * Conservative quality checks for supplemental anime character art.
 * Many catalog thumbnails are near-white sketches rather than useful avatars.
 * Judge the image, not its host: good images from the same API are preserved.
 *
 * Raw bytes may be unreadable if a third-party fallback disallows CORS;
 * when that happens, preserve the portrait instead of guessing.
 */
export type AnimePortraitQuality = 'good' | 'enhance' | 'reject';

export function classifyAnimePortraitPixels(pixels: Uint8ClampedArray): AnimePortraitQuality {
  let visible = 0;
  let white = 0;
  let pale = 0;
  let dark = 0;
  let vivid = 0;

  // Each pixel is RGBA. Analysis runs on a tiny 40×40 canvas, not full images.
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < 100) continue;
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    const chroma = hi - lo;
    const brightness = (r * 0.2126 + g * 0.7152 + b * 0.0722);

    visible++;
    if (lo >= 239 && chroma <= 24) white++;
    if (lo >= 221 && chroma <= 43) pale++;
    if (brightness < 139) dark++;
    if (chroma >= 55 && brightness >= 80 && brightness < 235) vivid++;
  }

  // Transparent or tiny image samples cannot be assessed reliably.
  if (visible < 60) return 'good';
  const whiteRatio = white / visible;
  const paleRatio = pale / visible;
  const darkRatio = dark / visible;
  const vividRatio = vivid / visible;

  // White/very pale background occupies most of the circle, with only
  // a few narrow colored outlines and almost no dark character detail.
  if (
    (whiteRatio >= 0.77 && vividRatio < 0.15 && darkRatio < 0.20) ||
    (paleRatio >= 0.84 && vividRatio < 0.15 && darkRatio < 0.18)
  ) return 'reject';

  // Slightly flat images with real details may benefit from gentle contrast.
  // Don't overprocess full-color icons or black-and-white illustrations.
  if (paleRatio >= 0.55 && paleRatio < 0.83 && vividRatio < 0.18 && darkRatio < 0.17)
    return 'enhance';

  return 'good';
}

export function assessAnimePortraitImage(image: HTMLImageElement): AnimePortraitQuality {
  try {
    if (!image.naturalWidth || !image.naturalHeight) return 'good';
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'good';
    ctx.drawImage(image, 0, 0, 40, 40);
    return classifyAnimePortraitPixels(ctx.getImageData(0, 0, 40, 40).data);
  } catch {
    // The fallback URL may be cross-origin. Never discard uninspectable
    // portraits; this avoids accidentally removing valid source images.
    return 'good';
  }
}
