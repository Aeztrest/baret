/**
 * The shape of one image asset, and the helpers that build its srcsets. Each
 * app keeps its own registry of paths (apps/web/src/shared/assets.ts,
 * apps/wallet/src/assets.ts), the only files where an asset path is written.
 *
 * Paths never go into @baret/content: the route test treats every string that
 * starts with "/" as an href. `ground` is the paper colour sampled from an
 * illustration's edges; a well paints it behind the image so letterboxing
 * shows no seam.
 */

export interface ImgAsset {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly ground?: string;
  /** Width descriptors for smaller copies of the same file (see `widths`). */
  readonly srcSet?: string;
  /**
   * The same set encoded as AVIF (see `avif`). Img serves it through a
   * <picture> source and keeps the WebP <img> as the fallback. Set it only
   * once every file in the set exists: a missing AVIF breaks the image.
   */
  readonly avifSrcSet?: string;
}

/** A responsive value: one value, or a mobile-first set (md and lg optional). */
export type Responsive<T> = T | { base: T; md?: T; lg?: T };

/**
 * A srcset of the original plus `-w<width>.webp` copies made from
 * assets-raw with `cwebp -q 82 -resize <width> 0`, so a small well never pulls
 * the full file.
 *
 * Never generate a copy wider than its source: an upscale only adds bytes.
 * Sharper art for a full-bleed frame needs a higher-resolution master.
 */
export function widths(src: string, width: number, sizes: readonly number[]): string {
  const base = src.replace(/\.webp$/, "");
  return [...sizes.map((w) => `${base}-w${w}.webp ${w}w`), `${src} ${width}w`].join(", ");
}

/**
 * The AVIF twin of a WebP src or srcset: same names, same widths, `.avif`.
 * The files are encoded at build time from assets-raw (IMPROVE E6).
 */
export function avif(webp: string): string {
  return webp.replace(/\.webp(?=\s|,|$)/g, ".avif");
}
