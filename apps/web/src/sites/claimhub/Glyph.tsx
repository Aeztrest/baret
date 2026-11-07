import type { JSX } from "react";

/**
 * ClaimHub's own pieces of the shared site header (kit/site/SiteHeader): its
 * glyph and its four pages (Claim, Eligibility, Distribution, FAQ), in nav order.
 */

/** ClaimHub's mark: a ticket with a notch on each side, in the site's ink. */
export function ClaimGlyph(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-[color:var(--accent)]">
      <path d="M1 5h22v5a2 2 0 0 0 0 4v5H1v-5a2 2 0 0 0 0-4zM8 8v8h2V8z" fillRule="evenodd" />
    </svg>
  );
}

export const VIEWS = ["claim", "eligibility", "distribution", "faq"] as const;
export type View = (typeof VIEWS)[number];
