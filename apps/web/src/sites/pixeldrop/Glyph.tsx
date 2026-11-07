import type { JSX } from "react";

/**
 * PixelDrop's own pieces of the shared site header (kit/site/SiteHeader):
 * its glyph and its four pages (Mint, Collection, Roadmap, Team), in nav order.
 */

/** PixelDrop's mark: a diamond of five pixels in the site's accent. */
export function PixelGlyph(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-[color:var(--accent)]">
      <path d="M9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9zM17 9h6v6h-6zM9 17h6v6H9z" />
    </svg>
  );
}

export const VIEWS = ["mint", "collection", "roadmap", "team"] as const;
export type View = (typeof VIEWS)[number];
