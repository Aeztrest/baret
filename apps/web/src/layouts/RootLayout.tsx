import { common, home } from "@baret/content";
import { Tag } from "@baret/ui/primitives/Tag";
import { LandingMotion } from "@baret/web-ui/components/LandingMotion";
import { Signature } from "@baret/web-ui/components/Signature";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import {
  Link,
  ScrollRestoration,
  useLocation,
  useMatches,
  useOutlet,
  useRouteError,
} from "react-router";
import { DEMO_PATHS, routes, SHOWCASE_PATH } from "../routes.js";
import { ROW } from "./nav.js";
import { SiteFooter } from "./SiteFooter.js";
import { SiteHeader } from "./SiteHeader.js";

/**
 * The marketing chrome: a sticky header and a three-column footer.
 *
 * The six demo sites render without it. They are meant to look like real
 * products, and a Baret header on top would give the game away before the
 * visitor has pressed anything.
 *
 * The document title comes from the registry. React 19 hoists a <title>
 * rendered anywhere in the tree into the head, so there is no effect to run
 * and no cleanup to get wrong. The description works the same way, and
 * index.html carries neither, so the head holds exactly one of each. (The
 * static head that index.html ships for link-preview bots is removed in
 * main.tsx before React renders.)
 *
 * ScrollRestoration restores the position on back/forward and starts a new
 * page at the top. A new document load (a typed URL, an outside link) first
 * drops the saved position of the tab's first entry, so it opens at the top
 * too (forgetFreshLoadScroll). It writes the native scroll position, which Lenis (the
 * landing's wheel smoothing) reads back on its next native scroll event, so
 * the two never fight. A hash in the URL scrolls to its target, which lands
 * under the 56 px header through the scroll-padding in tokens.css.
 */

/**
 * React Router keys the first entry of every document "default", so a fresh
 * load in a tab that visited the site would jump to the old page's position.
 * Runs once at module load, before ScrollRestoration reads the store; a
 * reload or a back/forward load keeps it.
 */
const SCROLL_STORE = "react-router-scroll-positions";
function forgetFreshLoadScroll(): void {
  if (typeof window === "undefined") return;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.type !== "navigate") return;
    const saved = JSON.parse(sessionStorage.getItem(SCROLL_STORE) ?? "{}") as Record<
      string,
      number
    >;
    if (!("default" in saved)) return;
    delete saved.default;
    sessionStorage.setItem(SCROLL_STORE, JSON.stringify(saved));
  } catch {
    // Storage blocked: nothing was saved, so nothing can be restored.
  }
}
forgetFreshLoadScroll();

/** The page's main region: #main on marketing routes, the site's own <main> on a demo. */
function pageMain(): HTMLElement | null {
  return document.getElementById("main") ?? document.querySelector("main");
}

/**
 * Moves focus to the page's main region without scrolling. A demo site's
 * <main> is not focusable by itself, so it gets tabindex -1 and, like #main,
 * no focus ring (it is a region, not a control).
 */
function focusMain(): HTMLElement | null {
  const main = pageMain();
  if (!main) return null;
  if (!main.hasAttribute("tabindex")) {
    main.setAttribute("tabindex", "-1");
    main.style.outline = "none";
  }
  main.focus({ preventScroll: true });
  return main;
}

/**
 * The deepest route handle's title and description. router.tsx loads them
 * with each lazy page (the same text scripts/head.mjs writes into
 * dist/<route>/index.html), so the live head agrees with the static one
 * after hydration.
 */
function useHandleMeta(): { title?: string; description?: string } {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle as { title?: unknown; description?: unknown } | undefined;
    const title = typeof handle?.title === "string" ? handle.title : undefined;
    const description = typeof handle?.description === "string" ? handle.description : undefined;
    if (title || description) {
      return { ...(title ? { title } : {}), ...(description ? { description } : {}) };
    }
  }
  return {};
}

/**
 * The head for the current URL: the registry's, with the page's own title
 * and description from its route handle when it has them (a demo site's
 * scenario title, for one). `own` is the handle's description alone.
 */
function usePageHead() {
  const { pathname } = useLocation();
  const head = headFor(pathname);
  const meta = useHandleMeta();
  return {
    ...head,
    title: meta.title ?? head.title,
    own: meta.description,
    description: meta.description ?? head.description,
  };
}

export function Component() {
  // One ScrollRestoration for every route, so a hop between a demo site and
  // the marketing chrome never remounts it and loses the saved positions.
  // The signature layer (Lenis wheel smoothing and the eyelet cursor) runs on
  // every page and stays mounted across navigation, so the cursor never
  // drops back to the native one mid-visit. A pathname change ends any Lenis
  // glide in flight (SmoothScroll's RouteReset), so the position
  // ScrollRestoration writes is the one the new page keeps.
  // LandingMotion gives every page the motion features (m.* elements, the
  // BRAND ease-out default and the reduced-motion switch).
  return (
    <LandingMotion>
      <ScrollRestoration />
      <Signature />
      <RouteAnnouncer />
      <Chrome />
    </LandingMotion>
  );
}

/**
 * After a client-side navigation, focus moves to the new page's main region
 * (without scrolling, so ScrollRestoration keeps its position) and the page
 * title is read out through a polite live region. The region is mounted
 * once, above both chromes, and stays empty on the first load, where the
 * browser announces the document itself. A hash-only change keeps focus
 * where the hash put it.
 */
function RouteAnnouncer() {
  const { pathname } = useLocation();
  const { title } = usePageHead();
  const [message, setMessage] = useState("");
  // The last path handled, not a one-shot flag: StrictMode runs the effect
  // twice on mount, and a flag would let the second run steal focus on load.
  const last = useRef(pathname);

  // biome-ignore lint/correctness/useExhaustiveDependencies: path changes only; the title follows the path
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    focusMain();
    setMessage(title);
  }, [pathname]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

function Chrome() {
  const { path: pathname, title, description, own, noindex, demo } = usePageHead();
  // Null while a lazy page loads on first visit: this layout is also the
  // route's HydrateFallback (router.tsx), so the header paints at once and
  // the footer waits for the page instead of jumping down when it lands.
  const outlet = useOutlet();

  if (demo) {
    return (
      <>
        <title>{title}</title>
        {own ? <meta name="description" content={own} /> : null}
        {/* The demo sites imitate products on purpose; keep them out of search (G4). */}
        <meta name="robots" content="noindex" />
        <SkipLink />
        {/* Room at the end of the page for the fixed bar, so the site's
            footer can scroll clear of it (K5). */}
        <div className="pb-[calc(4rem+env(safe-area-inset-bottom))]">{outlet}</div>
        {outlet ? <DemoRibbon /> : null}
      </>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <title>{title}</title>
      <meta name="description" content={description} />
      {/* An unknown URL answers 200 on a static host: keep the soft 404 out of search. */}
      {noindex ? <meta name="robots" content="noindex" /> : null}
      <SkipLink />
      <SiteHeader pathname={pathname} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {outlet}
      </main>
      {outlet ? <SiteFooter /> : null}
    </div>
  );
}

/**
 * The first tab stop on every route (WCAG 2.4.1). Hidden until it takes
 * keyboard focus. The label lives in the copy as common.nav.skip. A demo
 * site's own <main> has no id, so there the click finds it and moves focus
 * by hand.
 */
function SkipLink() {
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    if (document.getElementById("main")) return;
    event.preventDefault();
    focusMain()?.scrollIntoView({ block: "start" });
  };
  return (
    // biome-ignore lint/a11y/useValidAnchor: a real in-page link; the handler only stands in for a missing #main on demo sites
    <a
      href="#main"
      onClick={skip}
      // The padding sits on the focus variants because `not-sr-only` resets
      // it: a plain px-4 left a 145x17 px target (IMPROVE F3).
      className="sr-only z-50 bg-[color:var(--ground)] font-mono text-[12px] uppercase tracking-[0.06em] text-[color:var(--fg)] focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:inline-flex focus-visible:min-h-11 focus-visible:items-center focus-visible:border focus-visible:border-[color:var(--fg)] focus-visible:px-4 focus-visible:py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]"
    >
      {common.nav.skip}
    </a>
  );
}

/**
 * The head for a URL. React Router also matches "/agents/", and a static host
 * serves the built dist/agents/index.html there, so the trailing slash is
 * dropped once here and every lookup below (title, description, the demo set,
 * the header) sees the canonical path. The registry is the only place a title
 * is written. The landing has its own description here; a lazy page with
 * one gets it from its route handle (useHandleDescription) and every other
 * route the brand line. A path the registry does not know is the not-found
 * page, which a static host answers with 200, so it carries noindex like the
 * demo sites.
 */
export function headFor(raw: string): {
  path: string;
  title: string;
  description: string;
  noindex: boolean;
  demo: boolean;
} {
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") || "/" : raw;
  const match = Object.values(routes).find((route) => route.path === path);
  const demo = DEMO_PATHS.has(path);
  return {
    path,
    title: match?.title ?? routes.notFound.title,
    description: path === routes.home.path ? home.meta.description : common.brand.description,
    // Utility routes (the hidden /kit gallery, not found) stay out of search too.
    noindex: demo || !match || match.group === "utility",
    demo,
  };
}

/**
 * Pinned to every demo site so nobody mistakes one for a real product: a
 * slim Baret bar across the foot of the screen, in its own landmark. It is
 * opaque, so the site scrolls under its edge instead of under a floating
 * tag that covered whatever sat at the bottom of a phone screen (K5). The
 * demo layout reserves room at the end of the page so the site's footer
 * scrolls clear of it, and index.css keeps anything scrolled or tabbed to
 * above it (WCAG 2.4.11). Sheets and dialogs (z-50) open over it.
 */
function DemoRibbon() {
  return (
    // data-scope="baret": the bar is Baret's, so it keeps Baret's palette
    // on top of a dApp theme (sites/theme).
    <aside
      aria-label={common.demo.label}
      data-scope="baret"
      data-demo-bar=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--rule-strong)] bg-[color:var(--surface)] pb-[env(safe-area-inset-bottom)] text-[color:var(--fg)]"
    >
      <div className="mx-auto flex h-12 w-full max-w-[1276px] items-center justify-between gap-4 px-4 md:px-8 lg:px-12">
        <Tag tone="brand" size="sm">
          {common.demo.ribbon}
        </Tag>
        <Link
          to={SHOWCASE_PATH}
          viewTransition
          className="inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--fg)] underline decoration-[color:var(--rule-strong)] underline-offset-4 hover:decoration-[color:var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]"
        >
          {common.demo.back}
        </Link>
      </div>
    </aside>
  );
}

/**
 * A lazy chunk that no longer exists (a tab left open across a deploy)
 * fails its import. One automatic reload fetches the new build; a second
 * failure within a minute shows the error page instead of looping.
 */
const RELOAD_FLAG = "baret-chunk-reload";
const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

function useChunkReload(error: unknown): boolean {
  const chunk = error instanceof Error && CHUNK_ERROR.test(error.message);
  const [reloading, setReloading] = useState(chunk);
  useEffect(() => {
    if (!chunk) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
      if (Date.now() - last > 60_000) {
        sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
        window.location.reload();
        return;
      }
    } catch {
      // Storage blocked: never reload blind, show the page.
    }
    setReloading(false);
  }, [chunk]);
  return reloading;
}

/**
 * The route error page, inside the site chrome. It never prints the raw
 * error to readers (that goes to the console); it offers a reload and the
 * way back to the start.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const { pathname } = useLocation();
  const reloading = useChunkReload(error);
  const copy = common.errors.unknown;

  useEffect(() => {
    console.error(error);
  }, [error]);

  const action =
    "chamfer-sm inline-flex min-h-11 w-max items-center border border-[color:var(--fg)] px-4 font-display text-sm uppercase tracking-[0.08em]";

  return (
    <div className="flex min-h-dvh flex-col">
      <title>{copy.title}</title>
      <meta name="robots" content="noindex" />
      <SkipLink />
      <SiteHeader pathname={headFor(pathname).path} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* Blank for the moment a chunk failure reloads the page. */}
        {reloading ? null : (
          <div className={`mx-auto grid w-full gap-4 py-24 ${ROW}`}>
            <Tag tone="blocked">{copy.tag}</Tag>
            <h1 className="font-display text-display-l uppercase">{copy.heading}</h1>
            <p className="max-w-[60ch] text-[color:var(--fg-muted)]">{copy.pageBody}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => window.location.reload()} className={action}>
                {copy.reload}
              </button>
              <Link to={routes.home.path} className={action}>
                {copy.back}
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
