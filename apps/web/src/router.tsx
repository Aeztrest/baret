import { matchRoutes, type RouteObject } from "react-router";
import * as RootLayout from "./layouts/RootLayout.js";
import * as HomePage from "./pages/HomePage.js";
import { routes } from "./routes.js";

/**
 * A page's own head, loaded with its chunk and handed to RootLayout as the
 * route handle, so the live head matches the static dist/<route>/index.html
 * that scripts/head.mjs writes: the description for the marketing pages,
 * and the scenario title and description for the demo sites (so a tab reads
 * "NovaSwap swap scenario · Baret", never the imitated product's name
 * alone). Each lookup is a dynamic import so the copy stays in the page
 * chunk, not the entry. The path points at the content file itself, never
 * the barrel: importing the @baret/content barrel (statically or
 * dynamically) pulled all four pages' copy into the entry chunk (+27 KB raw,
 * measured).
 */
type Head = { readonly title?: string; readonly description: string };
const HEAD: Partial<Record<keyof typeof routes, () => Promise<Head>>> = {
  showcase: () =>
    import("../../../packages/content/src/web/hub.content.js").then(({ hub }) => ({
      description: hub.meta.description,
    })),
};

/**
 * The route tree, built from the registry so a new page cannot be added to
 * one without the other. main.tsx makes the browser router from it, and
 * entry-server.tsx renders "/" from the same tree at build time.
 *
 * Data mode rather than framework mode: this is a client-rendered site with
 * twelve routes, so loaders and error boundaries are worth having and a route
 * config file and generated types are not. Every route is prerendered at
 * build time (scripts/prerender.mjs) and hydrated in the browser.
 *
 * The layout and the landing are imported statically (IMPROVE E2): "/" is the
 * entry for nearly every visit, and two lazy hops in a row held the first
 * frame back by about a second. Every other route stays lazy.
 */
export const routeObjects: RouteObject[] = [
  {
    path: "/",
    Component: RootLayout.Component,
    // The same layout while a lazy page loads on first visit: the header
    // paints at once instead of a blank screen (Chrome waits for the page
    // before it draws the footer).
    HydrateFallback: RootLayout.Component,
    ErrorBoundary: RootLayout.ErrorBoundary,
    children: Object.entries(routes).map(([key, route]) =>
      route.path === "/"
        ? { index: true, Component: HomePage.Component }
        : {
            path: key === "notFound" ? "*" : route.path.slice(1),
            lazy: async () => {
              const head = HEAD[key as keyof typeof routes];
              const [page, handle] = await Promise.all([route.load(), head?.()]);
              return handle ? { ...page, handle } : page;
            },
          },
    ),
  },
];

/**
 * Loads the lazy page of `pathname` into the route tree before the browser
 * router is made, so a prerendered page hydrates against the page itself. Left
 * lazy, the router's first render would be the HydrateFallback (the layout
 * alone), which does not match the markup in the HTML, and React would throw
 * the whole page away and draw it again. The route is changed in place, the
 * way the router itself does once a lazy route has loaded.
 */
export async function resolveRoute(pathname: string): Promise<void> {
  const matches = matchRoutes(routeObjects, pathname) ?? [];
  await Promise.all(
    matches.map(async ({ route }) => {
      if (typeof route.lazy !== "function") return;
      const loaded = await route.lazy();
      Object.assign(route, loaded);
      delete route.lazy;
    }),
  );
}
