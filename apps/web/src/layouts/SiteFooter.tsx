import { common } from "@baret/content";
import { Mark } from "@baret/ui";
import { ArrowUpRight } from "lucide-react";
import type { JSX } from "react";
import { Link } from "react-router";
import { isExternal, NewTabLink } from "../components/NewTabLink.js";
import { ROW } from "./nav.js";

/**
 * The marketing footer: the brand block and three link groups. Footer links
 * are navigation, so a page of this site opens in the same tab; a link that
 * leaves the site (the web wallet, the source) opens a new tab and says so.
 * The logo goes to https://usebaret.com, like the header's.
 */
export function SiteFooter(): JSX.Element {
  return (
    <footer className="border-t border-[color:var(--rule-strong)]">
      <div
        className={`mx-auto grid w-full grid-cols-2 gap-x-4 gap-y-8 py-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:gap-8 sm:py-12 ${ROW}`}
      >
        <div className="col-span-2 sm:col-span-1">
          <a
            href={common.nav.home.href}
            aria-label={common.nav.home.label}
            className="mb-3 inline-flex min-h-11 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]"
          >
            <Mark decorative size={24} slit="var(--ground)" />
            <span aria-hidden="true" className="font-stencil text-lg uppercase tracking-[0.04em]">
              {common.brand.wordmark}
            </span>
          </a>
          <p className="font-display text-display-m uppercase">{common.footer.tagline}</p>
          <p className="mt-2 max-w-[38ch] text-sm text-[color:var(--fg-muted)]">
            {common.footer.note}
          </p>
        </div>

        {common.footer.groups.map((group) => (
          <nav key={group.title} aria-label={group.title} className="min-w-0">
            <h2 className="mb-2.5 truncate border-b border-[color:var(--rule)] pb-2 font-mono text-label uppercase text-[color:var(--fg-muted)]">
              {group.title}
            </h2>
            <ul className="grid">
              {group.links.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}

const LINK =
  "inline-flex min-h-11 min-w-11 items-center gap-1 text-sm text-[color:var(--fg-muted)] transition-colors duration-150 hover:text-[color:var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]";

/** Footer hrefs come from the copy, so some of them leave the site. */
function FooterLink({ href, label }: { href: string; label: string }): JSX.Element {
  if (isExternal(href)) {
    return (
      <NewTabLink href={href} className={LINK}>
        {label}
        <ArrowUpRight aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
      </NewTabLink>
    );
  }
  return (
    <Link to={href} viewTransition className={LINK}>
      {label}
    </Link>
  );
}
