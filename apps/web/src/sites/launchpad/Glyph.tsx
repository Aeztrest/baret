import type { JSX } from "react";

/**
 * LaunchPad's own pieces of the shared site header (kit/site/SiteHeader):
 * its glyph and its four pages (Sale, Tokenomics, Vesting, Team), in nav order.
 */

/** LaunchPad's mark: an arrow leaving its pad, in the site's accent. */
export function LaunchGlyph(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
      <path d="M12 1l7 9h-4v8H9v-8H5z" className="fill-[color:var(--accent)]" />
      <path d="M3 22h18" className="stroke-[color:var(--fg)]" strokeWidth="2" />
    </svg>
  );
}

export const VIEWS = ["sale", "tokenomics", "vesting", "team"] as const;
export type View = (typeof VIEWS)[number];
