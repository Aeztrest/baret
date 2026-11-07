import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { resolveRoute, routeObjects } from "./router.js";
import "./index.css";

// index.html ships a static head (title, description, og:*, twitter:*) for
// link-preview bots, which never run this script (IMPROVE G1). In a browser
// RootLayout renders the per-route <title> and <meta> instead, so the static
// copies go first and the document never carries two titles. The og:* and
// twitter:* tags describe one route only, so they go too: left in place they
// would keep that og:title on every other route of the live document.
const STATIC_HEAD = '[data-static-head], meta[property^="og:"], meta[name^="twitter:"]';
for (const node of document.querySelectorAll(STATIC_HEAD)) node.remove();

const found = document.getElementById("root");
if (!found) throw new Error("Missing #root. Check index.html.");
const container: HTMLElement = found;

const app = (
  <StrictMode>
    <RouterProvider router={createBrowserRouter(routeObjects)} />
  </StrictMode>
);

/**
 * Every route ships prerendered in its own file (scripts/prerender.mjs), so
 * React takes over the markup already on screen instead of drawing it again.
 * The markup is used only for the URL it was made for: a host that answers
 * an unknown path with index.html sends the landing, and a query string
 * (?view=, ?filter=) changes what the page shows. In both cases the flag set
 * in index.html keeps the markup hidden, and it is dropped here before the
 * right page renders. The 404 file is marked "*": its page is the same for
 * every unmatched path.
 */
function prerenderedFor(): boolean {
  const made = document.documentElement.dataset.prerender;
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const same = made === "*" || made === path;
  return same && location.search === "" && container.firstElementChild !== null;
}

function renderFresh(): void {
  container.replaceChildren();
  delete document.documentElement.dataset.prerenderHidden;
  createRoot(container).render(app);
}

if (prerenderedFor()) {
  // The page's chunk is loaded first (its modulepreload is in the head), so
  // the first client render is the page itself, not the HydrateFallback.
  resolveRoute(location.pathname).then(
    () => hydrateRoot(container, app),
    () => renderFresh(),
  );
} else {
  renderFresh();
}
