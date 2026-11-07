import { common } from "@baret/content";
import type { AnchorHTMLAttributes, JSX, ReactNode } from "react";

/**
 * The site's link rule (Meric's revision, 2026-10-13, item 7): navigation
 * (the header, the footer, a sidebar) moves within the tab; every other
 * button or link opens a new tab, so the page the visitor came from stays
 * where it was.
 *
 * `NEW_TAB` is the attribute pair for any anchor, LinkButton (`newTab`) or
 * React Router <Link> that is not navigation. `NewTabLink` is a plain anchor
 * that carries it and tells screen readers the link opens a new tab.
 */
export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/** True for an href that leaves usebaret.com (or the dev server). */
export function isExternal(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:");
}

export function NewTabLink({
  href,
  children,
  className,
  hint = true,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel" | "href"> & {
  href: string;
  children: ReactNode;
  /** Append the hidden "(opens in a new tab)" note. Off when the label already says so. */
  hint?: boolean;
}): JSX.Element {
  return (
    <a href={href} className={className} {...NEW_TAB} {...rest}>
      {children}
      {hint ? <span className="sr-only"> {common.nav.newTab}</span> : null}
    </a>
  );
}
