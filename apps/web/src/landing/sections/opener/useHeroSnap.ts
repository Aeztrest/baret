import { stopGlide } from "@baret/web-ui/lib/glide";
import { useEffect } from "react";
import { IDS } from "../../../shared/ids.js";

/** The site header's height in px (HEADER_OFFSET in @baret/web-ui lib/layout). */
const HEADER = 56;
/** How long wheel input is held after the step, so the smooth scroll finishes. */
const HOLD_MS = 700;

/**
 * One wheel step down from the top of the page lands on the hero ("Check it
 * first. Then sign.") instead of creeping through the opener's photo. It
 * acts only while the page sits at the very top, only on a wheel (a mouse
 * or trackpad; touch and keyboard scroll as usual), and only downwards.
 * Every other scroll is the reader's own. Not mounted under reduced motion.
 */
export function useHeroSnap(): void {
  useEffect(() => {
    let holdUntil = 0;
    const onWheel = (e: WheelEvent): void => {
      const now = performance.now();
      if (now < holdUntil) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.deltaY <= 0 || e.ctrlKey || window.scrollY > 8) return;
      const hero = document.getElementById(IDS.hero);
      if (!hero) return;
      const top = hero.getBoundingClientRect().top + window.scrollY - HEADER;
      if (top <= window.scrollY) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      stopGlide();
      holdUntil = now + HOLD_MS;
      window.scrollTo({ top, behavior: "smooth" });
    };
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, []);
}
