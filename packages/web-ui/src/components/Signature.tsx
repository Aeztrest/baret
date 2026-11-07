import { type JSX, lazy, Suspense, useEffect, useState } from "react";

/**
 * Mounts the two desktop-only signature pieces, the smoothed wheel scroll
 * (Lenis) and the eyelet cursor, off the critical path.
 *
 * Both live in their own lazy chunks, requested only when the browser is
 * idle after first paint AND the media query says they will run: a fine,
 * hovering pointer with no reduced-motion preference and no forced colours.
 * Phones, tablets, reduced motion and High Contrast never download either
 * chunk. The query is live, so docking a tablet to
 * a trackpad loads them later; the components re-check the same conditions
 * themselves and render nothing when they stop matching.
 */

const QUERY =
  "(pointer: fine) and (hover: hover) and (prefers-reduced-motion: no-preference) and (forced-colors: none)";

const SmoothScroll = lazy(() =>
  import("./SmoothScroll.js").then((m) => ({ default: m.SmoothScroll })),
);
const Cursor = lazy(() => import("./Cursor.js").then((m) => ({ default: m.Cursor })));

/** True once the page has painted and the main thread went idle. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setIdle(true), { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setIdle(true), 1200);
    return () => window.clearTimeout(id);
  }, []);
  return idle;
}

/**
 * Live media-query match; false before the first effect. Nothing renders
 * before the idle gate opens anyway, so the server and the first client
 * render agree.
 */
function useMatch(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = (): void => setMatch(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return match;
}

export interface SignatureProps {
  /**
   * `false` keeps the native scroll on a screen where a glide would get in
   * the way. The cursor stays.
   */
  readonly smoothScroll?: boolean;
  /**
   * Turns both pieces off, the smoothed scroll and the eyelet cursor: the
   * wallet's sign and connect requests, where the reader has to land exactly
   * on a finding or a decision button with the platform's own pointer.
   */
  readonly quiet?: boolean;
}

export function Signature({
  smoothScroll = true,
  quiet = false,
}: SignatureProps): JSX.Element | null {
  const idle = useIdle();
  const on = useMatch(QUERY);
  if (!idle || !on || quiet) return null;
  return (
    <Suspense fallback={null}>
      {smoothScroll ? <SmoothScroll /> : null}
      <Cursor />
    </Suspense>
  );
}
