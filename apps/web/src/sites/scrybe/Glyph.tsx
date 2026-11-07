import type { JSX } from "react";

/**
 * Scrybe's own pieces of the shared site header (kit/site/SiteHeader): its
 * glyph and its four pages (Ask, Pricing, API, Usage), in nav order.
 */

/** Scrybe's mark: one highlighter stroke across a line of text, in the site's accent. */
export function ScrybeGlyph(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
      <path d="M1 15.5 7.5 6H23l-6.5 9.5z" className="fill-[color:var(--accent)]" />
      <path d="M3 19h18" className="stroke-[color:var(--fg)]" strokeWidth="2" />
    </svg>
  );
}

export const VIEWS = ["ask", "pricing", "api", "usage"] as const;
export type View = (typeof VIEWS)[number];
