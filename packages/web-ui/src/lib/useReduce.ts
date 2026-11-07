import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const snapshot = (): boolean => window.matchMedia(QUERY).matches;

/** A prerendered page is drawn for "no preference" (see below). */
const serverSnapshot = (): boolean => false;

/**
 * True when the reader asked for reduced motion, and it follows a change of
 * that setting live.
 *
 * Every landing component reads this itself. The CSS reset in tokens.css does
 * not reach Motion's JS animations or scroll-linked values.
 *
 * Hydration-safe: while React hydrates the prerendered landing it uses the
 * server value, so the first client render matches the HTML, then it renders
 * again with the reader's setting. Motion's useReducedMotion reads matchMedia
 * during that first render instead, and a reduced-motion reader would get a
 * hydration mismatch and a full redraw of the page.
 */
export function useReduce(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
