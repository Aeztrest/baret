import type { JSX } from "react";

/**
 * NovaSwap's own pieces of the shared site header (kit/site/SiteHeader): its
 * glyph and its four pages (Swap, Pools, Stats, Docs), in nav order.
 */

/** NovaSwap's mark: a four-point star in the site's accent. */
export function NovaGlyph(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-[color:var(--accent)]">
      <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
    </svg>
  );
}

export const VIEWS = ["swap", "pools", "stats", "docs"] as const;
export type View = (typeof VIEWS)[number];
