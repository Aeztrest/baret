// The glide registry alone, not SmoothScroll: Lenis stays off the first paint.
import { stopGlide } from "@baret/web-ui/lib/glide";
import { useEffect } from "react";
import { useSearchParams } from "react-router";

/**
 * Which of a demo dApp's pages is open. The page lives in `?view=`, so Back
 * works and a page can be linked; the first view is the home page and has no
 * parameter. An unknown value falls back to the home page and is dropped
 * from the URL.
 *
 * Scroll is left to RootLayout's ScrollRestoration: a new view starts at the
 * top, and Back or Forward returns to where the visitor was. Scrolling here
 * as well would run before the router saves the page being left, so every
 * entry would be saved at 0.
 */
export function viewFrom<V extends string>(views: readonly V[], raw: string | null): V | undefined {
  return views.find((v) => v === raw) ?? views[0];
}

export function useSiteView<V extends string>(
  views: readonly [V, ...V[]],
): { view: V; go: (next: V) => void } {
  const [params, setParams] = useSearchParams();
  const home = views[0];
  const raw = params.get("view");
  const view = viewFrom(views, raw) ?? home;

  // A stale or mistyped ?view= (or ?view= naming the home page) is replaced
  // by the clean URL, so it is not shared onwards.
  const stray = raw !== null && (raw === home || !views.includes(raw as V));
  useEffect(() => {
    if (stray) setParams({}, { replace: true, preventScrollReset: true });
  }, [stray, setParams]);

  // Back and Forward restore a saved position; a wheel glide still in flight
  // (SmoothScroll) must not override it. A new view (go) starts at the top
  // for the same reason.
  useEffect(() => {
    window.addEventListener("popstate", stopGlide);
    return () => window.removeEventListener("popstate", stopGlide);
  }, []);

  function go(next: V): void {
    // The current view is not pushed again, so the forward stack survives.
    if (next === view) return;
    stopGlide();
    setParams(next === home ? {} : { view: next });
  }

  return { view, go };
}
