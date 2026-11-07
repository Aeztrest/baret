import { FRAME } from "@baret/web-ui/lib/layout";
import { type JSX, type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { WalletControl } from "../wallet/WalletControl.js";

/**
 * A demo dApp's own header, in the site's palette: its glyph and name, a nav
 * that switches between the site's pages (`?view=`), and the wallet control
 * (wallet/WalletControl.tsx): a real wallet found over EIP-6963, or the
 * sample wallet. On phones the nav drops to a row under the brand. Shared by
 * the six sites; each passes its own glyph, copy and views.
 *
 * Nav items are real links to `?view=`, so they open in a new tab and can be
 * copied; a plain click goes through `onView` instead (no push for the page
 * already open). A view change is announced politely; the wallet control
 * announces its own changes.
 */

/** The search string of a view: the home page has none. */
function searchOf(view: string, home: string | undefined): string {
  return view === home ? "" : `?view=${encodeURIComponent(view)}`;
}

/** A click the browser should handle itself: new tab, new window, download. */
function isModified(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function NavItems<V extends string>({
  nav,
  views,
  view,
  onView,
}: {
  nav: readonly string[];
  views: readonly V[];
  view: V;
  onView: (view: V) => void;
}): JSX.Element {
  const { pathname } = useLocation();
  const first = views[0];
  return (
    <>
      {nav.map((item, i) => {
        const key = views[i] ?? first;
        if (key === undefined) return null;
        const active = key === view;
        return (
          <Link
            key={item}
            to={{ pathname, search: searchOf(key, first) }}
            data-nav-item=""
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (isModified(event)) return;
              event.preventDefault();
              onView(key);
            }}
            className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border-b-2 text-sm transition-colors ${active ? "border-[color:var(--accent-mark)] font-medium text-[color:var(--fg)]" : "border-transparent text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"}`}
          >
            {item}
          </Link>
        );
      })}
    </>
  );
}

export function SiteHeader<V extends string>({
  brand,
  glyph,
  nav,
  views,
  view,
  onView,
  connect,
  sample,
}: {
  brand: string;
  /** The site's mark, drawn in its accent. */
  glyph: ReactNode;
  nav: readonly string[];
  /** One view per nav item, in the same order. The first is the home page. */
  views: readonly V[];
  view: V;
  onView: (view: V) => void;
  connect: { readonly label: string; readonly connected: string };
  /** The sample wallet: in use once the site's main button ran on it. */
  sample: { readonly connected: boolean; readonly address: string; readonly onUse: () => void };
}): JSX.Element {
  const home = views[0];
  const { pathname } = useLocation();

  // Always mounted, empty on load: it speaks only when the view or the
  // wallet changes after that.
  const [said, setSaid] = useState("");
  const shown = useRef(view);
  const label = nav[views.indexOf(view)] ?? "";
  useEffect(() => {
    if (shown.current === view) return;
    shown.current = view;
    setSaid(label);
  }, [view, label]);

  return (
    <header className="border-b border-[color:var(--rule)]">
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
      {/* The smaller gap below 360 px keeps the brand and Connect wallet on one 320 px row. */}
      <div className={`${FRAME} flex h-16 items-center justify-between gap-3 min-[360px]:gap-6`}>
        <Link
          to={{ pathname, search: "" }}
          onClick={(event) => {
            if (isModified(event)) return;
            event.preventDefault();
            if (home !== undefined) onView(home);
          }}
          className="flex min-h-11 items-center gap-3"
        >
          {glyph}
          <span className="font-display text-xl font-extrabold uppercase tracking-[0.06em] text-[color:var(--fg)]">
            {brand}
          </span>
        </Link>

        <nav aria-label={brand} className="hidden items-center gap-8 md:flex">
          <NavItems nav={nav} views={views} view={view} onView={onView} />
        </nav>

        <WalletControl connect={connect} sample={sample} />
      </div>
      <nav
        aria-label={brand}
        className={`${FRAME} flex gap-6 overflow-x-auto border-t border-[color:var(--rule)] md:hidden`}
      >
        <NavItems nav={nav} views={views} view={view} onView={onView} />
      </nav>
    </header>
  );
}
