import "lenis/dist/lenis.css";
import Lenis from "lenis";
import { cancelFrame, frame } from "motion/react";
import { type JSX, useEffect, useLayoutEffect, useRef } from "react";
import { useInRouterContext, useLocation } from "react-router";
import { currentGlide, registerGlide, stopGlide } from "../lib/glide.js";
import { useFinePointer } from "../lib/useFinePointer.js";
import { useReduce } from "../lib/useReduce.js";

/**
 * Smoothed wheel scrolling for the landing, with Lenis.
 *
 * - Wheel and trackpad only. Lenis is not even created unless the main
 *   pointer is fine and hovers (`useFinePointer`, live): phones and tablets
 *   keep the platform's own scrolling and pay no per-frame cost. Same-page
 *   hash links there use the browser's own jump.
 * - No idle frames: the Lenis tick runs in Motion's frame loop only while a
 *   scroll is in flight. A wheel event or an anchor glide arms it; the first
 *   frame where Lenis is no longer scrolling disarms it, so a page at rest
 *   schedules no rAF at all.
 * - `lerp` 0.1: each frame closes 10 % of the gap to the target. That reads as
 *   a calm ease-out of about half a second, with no overshoot.
 * - Lenis runs inside Motion's frame loop, so the opener's frame swaps and the
 *   marquee (both `useScroll`) read the scroll position Lenis just wrote, in
 *   the same frame, instead of one frame late.
 * - Same-page `#hash` links glide to their target in 1.1 s on an expo-out
 *   curve. Lenis reads each section's `scroll-margin-top` (56 px, the sticky
 *   header), so the header never covers a heading. Cancelling the jump also
 *   cancels the browser's focus move, so focus is moved to the target here
 *   (tabindex -1 when it is not focusable): the skip link lands on <main>.
 * - Inner scrollers keep the wheel: an open dialog or sheet, a textarea, a
 *   `pre`, anything marked `data-lenis-prevent`, and any other element that
 *   can still scroll (`allowNestedScroll`) scroll themselves, natively.
 * - While a dialog locks the page (Radix sets `data-scroll-locked` on body),
 *   Lenis is stopped, so the page under the overlay never moves.
 * - Reduced motion: no Lenis at all, the native scroll stays untouched. The
 *   preference is live, so switching it mid-visit tears Lenis down.
 * - Mounted once by Signature in the layout, so it outlives route changes; a
 *   pathname change ends any glide in flight (RouteReset) so
 *   ScrollRestoration's position wins. In-page views call `stopGlide` too.
 */

const LERP = 0.1;
const ANCHOR_DURATION = 1.1;

/** Expo-out: fast start, long soft landing, never past the target. */
function expoOut(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

/** Wheel events that start inside these scroll natively, never through Lenis. */
const NATIVE_SCROLL = "[role=dialog],[role=alertdialog],[data-lenis-prevent],textarea,pre";

function preventSmooth(node: HTMLElement): boolean {
  return node.closest(NATIVE_SCROLL) !== null;
}

/**
 * A new page must not inherit the last page's glide. The layout stays
 * mounted across routes, so a wheel glide still running when a link is
 * followed would carry the new page past the position ScrollRestoration
 * gives it. Stopping and restarting Lenis ends the glide at the real
 * position; the first render (a fresh load) needs nothing.
 */
function RouteReset(): null {
  const { pathname } = useLocation();
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on every route change by design
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    stopGlide();
  }, [pathname]);
  return null;
}

/** The same-page hash a click went to, or null. Modified clicks are left alone. */
function sameDocumentHash(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0) return null;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!(a instanceof HTMLAnchorElement) || a.target === "_blank") return null;
  const url = new URL(a.href);
  const here = window.location;
  if (url.origin !== here.origin || url.pathname !== here.pathname || url.hash.length < 2) {
    return null;
  }
  return url.hash;
}

export function SmoothScroll(): JSX.Element | null {
  const inRouter = useInRouterContext();
  const reduce = useReduce();
  const fine = useFinePointer();
  const on = fine && !reduce;

  useEffect(() => {
    if (!on) return;
    const lenis = new Lenis({
      lerp: LERP,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false,
      anchors: false,
      prevent: preventSmooth,
      allowNestedScroll: true,
    });
    registerGlide(lenis);

    // Follow the body scroll lock a modal dialog sets and clears.
    const syncLock = (): void => {
      if (document.body.hasAttribute("data-scroll-locked")) lenis.stop();
      else lenis.start();
    };
    syncLock();
    const lock = new MutationObserver(syncLock);
    lock.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] });

    let armed = false;
    const tick = ({ timestamp }: { timestamp: number }): void => {
      lenis.raf(timestamp);
      // "native" (keyboard, scrollbar) needs no Lenis frames; only a glide does.
      if (lenis.isScrolling !== "smooth") disarm();
    };
    const arm = (): void => {
      if (armed) return;
      armed = true;
      frame.update(tick, true);
    };
    const disarm = (): void => {
      if (!armed) return;
      armed = false;
      cancelFrame(tick);
    };
    // Lenis registered its own wheel listener first, so by the time this runs
    // it has already set its target; the next frame starts the glide.
    window.addEventListener("wheel", arm, { passive: true });

    // Bubble phase on the window: React's handlers (on the root) run first.
    const onClick = (e: MouseEvent): void => {
      const hash = sameDocumentHash(e);
      if (!hash) return;
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      window.history.pushState(null, "", hash);
      lenis.scrollTo(target, { duration: ANCHOR_DURATION, easing: expoOut });
      arm();
      // preventDefault() also cancelled the browser's focus move, so redo it:
      // the skip link must land keyboard focus on its target (WCAG 2.4.1).
      // A link's own handler that already focused something inside wins.
      if (!target.contains(document.activeElement)) {
        if (!target.hasAttribute("tabindex") && target.tabIndex < 0) {
          target.setAttribute("tabindex", "-1");
        }
        target.focus({ preventScroll: true });
      }
    };
    window.addEventListener("click", onClick);

    return () => {
      lock.disconnect();
      window.removeEventListener("click", onClick);
      window.removeEventListener("wheel", arm);
      disarm();
      if (currentGlide() === lenis) registerGlide(null);
      lenis.destroy();
    };
  }, [on]);

  return inRouter ? <RouteReset /> : null;
}
