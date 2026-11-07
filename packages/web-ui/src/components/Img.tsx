import { type JSX, useEffect, useRef, useState } from "react";
import type { ImgAsset, Responsive } from "../lib/img.js";
import { useReduce } from "../lib/useReduce.js";
import { cascade, cx, POSITION_CLASSES, positionStyle } from "../lib/util.js";

/**
 * Landing images. Every one is decorative: the copy beside it carries the
 * meaning, so `alt` is always empty and there is no alt prop.
 *
 * Fit and object-position take one value or a mobile-first set. Missing
 * breakpoints cascade: md falls back to base, lg to md.
 */

export type { Responsive } from "../lib/img.js";

type Fit = "cover" | "contain";

export interface ImgProps {
  asset: ImgAsset;
  /** Default "cover". */
  fit?: Responsive<Fit>;
  /** object-position. Default "50% 50%". */
  position?: Responsive<string>;
  /** Art direction below 768 px, through <picture>. */
  phone?: ImgAsset;
  /** Default "lazy". "priority" is eager plus fetchpriority="high". */
  loading?: "priority" | "eager" | "lazy";
  /** Default true: fades in over 240 ms once decoded. */
  fade?: boolean;
  /** Default "size-full". */
  className?: string;
  /**
   * Used only when the asset has a srcSet. Default: "auto" (the laid-out
   * width) for lazy images, with 100vw as the fallback.
   */
  sizes?: string;
}

const FIT_BASE: Record<Fit, string> = { cover: "object-cover", contain: "object-contain" };
const FIT_MD: Record<Fit, string> = { cover: "md:object-cover", contain: "md:object-contain" };
const FIT_LG: Record<Fit, string> = { cover: "lg:object-cover", contain: "lg:object-contain" };

function fitClasses(fit: Responsive<Fit>): string {
  const f = cascade(fit);
  return `${FIT_BASE[f.base]} ${FIT_MD[f.md]} ${FIT_LG[f.lg]}`;
}

export function Img({
  asset,
  fit = "cover",
  position,
  phone,
  loading = "lazy",
  fade = true,
  className = "size-full",
  sizes,
}: ImgProps): JSX.Element {
  const reduce = useReduce();
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);

  const instant = !fade || reduce || loading === "priority";
  const opacity = instant
    ? ""
    : `transition-opacity duration-[240ms] ease-out ${loaded ? "opacity-100" : "opacity-0"}`;

  const lazy = loading === "lazy";
  const sizeHint = sizes ?? (lazy ? "auto, 100vw" : "100vw");
  const set = asset.srcSet ? { srcSet: asset.srcSet, sizes: sizeHint } : {};

  const img = (
    <img
      ref={ref}
      src={asset.src}
      {...set}
      width={asset.width}
      height={asset.height}
      alt=""
      // The LCP picture decodes in step with the paint, not after it.
      decoding={loading === "priority" ? "auto" : "async"}
      loading={lazy ? "lazy" : "eager"}
      {...(loading === "priority" ? { fetchPriority: "high" as const } : {})}
      onLoad={() => setLoaded(true)}
      style={positionStyle(position)}
      className={cx(className, fitClasses(fit), POSITION_CLASSES, opacity)}
    />
  );

  if (!phone && !asset.avifSrcSet) return img;
  // Source order matters: the phone crop wins below 768 px (AVIF first),
  // then the AVIF of the main asset, then the WebP <img>.
  const phoneSizes = phone?.srcSet ? { sizes: sizeHint } : {};
  return (
    <picture>
      {phone?.avifSrcSet ? (
        <source
          media="(max-width: 767px)"
          type="image/avif"
          srcSet={phone.avifSrcSet}
          {...phoneSizes}
          width={phone.width}
          height={phone.height}
        />
      ) : null}
      {phone ? (
        <source
          media="(max-width: 767px)"
          srcSet={phone.srcSet ?? phone.src}
          {...phoneSizes}
          width={phone.width}
          height={phone.height}
        />
      ) : null}
      {asset.avifSrcSet ? (
        <source
          type="image/avif"
          srcSet={asset.avifSrcSet}
          {...(asset.srcSet ? { sizes: sizeHint } : {})}
        />
      ) : null}
      {img}
    </picture>
  );
}

const RATIO = {
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "2/3": "aspect-[2/3]",
  "1/1": "aspect-square",
  "16/10": "aspect-[16/10]",
  "4/5": "aspect-[4/5]",
} as const;

/**
 * A fixed-ratio frame for an illustration. The well paints the image's own
 * paper colour behind it, so a contained image letterboxes without a seam.
 * `dim` lowers the print a little in the dark theme; it never inverts it.
 */
export function ImgWell({
  asset,
  ratio,
  fit,
  position,
  dim,
  className,
  sizes,
  loading,
}: {
  asset: ImgAsset;
  ratio: keyof typeof RATIO;
  fit?: Responsive<Fit>;
  position?: Responsive<string>;
  dim?: boolean;
  className?: string;
  sizes?: string;
  /** As on Img; "priority" for a well that holds the route's LCP picture. */
  loading?: "priority" | "eager" | "lazy";
}): JSX.Element {
  return (
    <div
      className={cx("relative overflow-hidden", RATIO[ratio], className)}
      {...(asset.ground ? { style: { backgroundColor: asset.ground } } : {})}
    >
      <Img
        asset={asset}
        {...(fit ? { fit } : {})}
        {...(position ? { position } : {})}
        {...(sizes ? { sizes } : {})}
        {...(loading ? { loading } : {})}
        className={cx("absolute inset-0 size-full", dim && "dark:brightness-90")}
      />
    </div>
  );
}
