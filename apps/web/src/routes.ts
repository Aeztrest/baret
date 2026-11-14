import { home } from "@baret/content";
import { defineRoutes } from "@baret/routes";

/**
 * Every path the web app serves, declared once.
 *
 * Ported page by page from Baret-Metropolis apps/showcase (TASKS.md T2.4): the
 * landing, the not-found page, the showcase hub and the six demo sites first.
 * /agents, /docs, /partners and /install follow; until then their links (nav,
 * footer, landing cards) answer with the not-found page.
 *
 * The router, the header nav, the footer and the route test all read this.
 * Nothing else in the app is allowed to write a path as a literal string.
 *
 * Groups:
 *   marketing  the header nav
 *   demo       the six threat sites, linked from the hub rather than the nav
 *   utility    reachable but not listed anywhere
 */
export const routes = defineRoutes({
  home: {
    path: "/",
    title: home.meta.title,
    // Not used by the router: router.tsx imports the landing statically.
    // Kept for the RouteDef contract, `warm` and the route test; a static
    // import here would close a cycle through cardMedia.ts. The build's
    // INEFFECTIVE_DYNAMIC_IMPORT notice for it is filtered in vite.config.ts.
    load: () => import("./pages/HomePage.js"),
  },

  // Agent first (2026-11-14): the NEAR agent leads the header nav.
  near: {
    path: "/near",
    title: "NEAR agent vault · Baret",
    label: "NEAR agent",
    group: "marketing",
    load: () => import("./pages/NearPage.js"),
  },

  showcase: {
    path: "/showcase",
    title: "Baret showcase",
    label: "Wallet showcase",
    group: "marketing",
    load: () => import("./pages/HubPage.js"),
  },

  scrybe: {
    path: "/scrybe",
    title: "Scrybe",
    label: "Scrybe",
    group: "demo",
    load: () => import("./sites/ScrybePage.js"),
  },

  novaswap: {
    path: "/novaswap",
    title: "NovaSwap",
    label: "NovaSwap",
    group: "demo",
    load: () => import("./sites/NovaSwapPage.js"),
  },

  pixeldrop: {
    path: "/pixeldrop",
    title: "PixelDrop",
    label: "PixelDrop",
    group: "demo",
    load: () => import("./sites/PixelDropPage.js"),
  },

  orbityield: {
    path: "/orbityield",
    title: "OrbitYield",
    label: "OrbitYield",
    group: "demo",
    load: () => import("./sites/OrbitYieldPage.js"),
  },

  claimhub: {
    path: "/claimhub",
    title: "ClaimHub",
    label: "ClaimHub",
    group: "demo",
    load: () => import("./sites/ClaimHubPage.js"),
  },

  launchpad: {
    path: "/launchpad",
    title: "LaunchPad",
    label: "LaunchPad",
    group: "demo",
    load: () => import("./sites/LaunchPadPage.js"),
  },

  notFound: {
    path: "/*",
    title: "Not found",
    group: "utility",
    hidden: true,
    load: () => import("./pages/NotFoundPage.js"),
  },
});

export type WebRoute = keyof typeof routes;

/**
 * Pages the copy already links to that are not ported yet (TASKS.md T2.4). The
 * route test accepts a link to one of these and nothing else; each entry goes as
 * its page lands, and the list ends empty.
 */
export const PENDING_PATHS: ReadonlySet<string> = new Set([
  "/agents",
  "/docs",
  "/partners",
  "/install",
]);

/** The six demo paths, so the layout knows when to drop the marketing chrome. */
export const DEMO_PATHS: ReadonlySet<string> = new Set(
  Object.values(routes)
    .filter((route) => route.group === "demo")
    .map((route) => route.path),
);

const warmed = new Set<WebRoute>();

/**
 * Starts loading a route's chunk on intent (pointerenter or focus of a link to
 * it), so the click renders at once (IMPROVE E8). Each route is fetched at
 * most once; a failed fetch is forgotten so the real navigation retries it.
 * Speculation Rules are deliberately not used: Chromium-only and built for
 * multi-page sites.
 */
export function warm(key: WebRoute): void {
  if (warmed.has(key)) return;
  warmed.add(key);
  routes[key].load().catch(() => warmed.delete(key));
}

/** The registry key whose path is `path`, for warming a link by its href. */
export function routeKeyFor(path: string): WebRoute | undefined {
  return (Object.keys(routes) as WebRoute[]).find((key) => routes[key].path === path);
}
