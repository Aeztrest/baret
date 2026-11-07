import type { JSX } from "react";

/**
 * OrbitYield's own pieces of the shared site header (kit/site/SiteHeader):
 * its glyph and its four pages (Stake, Rewards, Stats, Security), in nav order.
 */

/** OrbitYield's mark: a ring with a body on its orbit, in the site's accent. */
export function OrbitGlyph(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
      <circle
        cx="11"
        cy="13"
        r="8"
        fill="none"
        strokeWidth="3"
        className="stroke-[color:var(--accent)]"
      />
      <circle cx="18.5" cy="5.5" r="3.5" className="fill-[color:var(--fg)]" />
    </svg>
  );
}

export const VIEWS = ["stake", "rewards", "stats", "security"] as const;
export type View = (typeof VIEWS)[number];
