import type { Transition, Variants } from "motion/react";

/**
 * The landing's motion vocabulary: all BRAND section 08 timings.
 * A surface rises 14 px over 460 ms on the BRAND ease, the same curve the
 * heading masks use, so tiles and headings read as one language. The opener
 * frames crossfade. Nothing overshoots and nothing loops.
 *
 * Variants carry no transitions. Components pass `transition` as a prop, so
 * the timing is explicit at the call site and never `undefined`.
 */

/** BRAND sheet slide: the opener crossfade. */
export const EASE_OUT_SOFT = [0.32, 0.72, 0, 1] as const;

/** The BRAND ease-out, shared with the heading reveal (TextReveal). */
export const EASE_BRAND = [0.22, 1, 0.36, 1] as const;

/** Durations in seconds. `enter` is the short swap/fade; `surface` the reveal. */
export const DUR = {
  enter: 0.16,
  surface: 0.46,
  tag: 0.24,
  frame: 0.48,
} as const;

/** The surface-enter rise, in px. */
export const RISE = 14;

/** Seconds between siblings in a stagger. */
export const STAGGER = 0.06;

/** Index cap: at most 300 ms of stagger, however long the list. */
export const STAGGER_CAP = 5;

/** The short BRAND enter. The page default for un-timed motion (see LandingMotion). */
export const ENTER: Transition = { duration: DUR.enter, ease: "easeOut" };

/** The surface reveal: Reveal and StaggerItem. */
export const SURFACE: Transition = { duration: DUR.surface, ease: EASE_BRAND };

/**
 * Seconds after a surface starts its reveal until it has visibly landed.
 * Anything inside it that moves on its own (a count-up) starts after this.
 */
export const SURFACE_SETTLE = 0.3;

/** Reveal once, when the element is 10 % above the bottom of the viewport. */
export const VIEWPORT_ONCE = { once: true, margin: "0px 0px -10% 0px" } as const;

export const rise: Variants = {
  hidden: { opacity: 0, y: RISE },
  shown: { opacity: 1, y: 0 },
};

/**
 * The delay for the nth sibling: `base + min(index, 5) * 60 ms`, rounded to
 * the millisecond so float noise never reaches a transition.
 */
export function staggerDelay(index: number, base?: number): number {
  const steps = Math.min(Math.max(index, 0), STAGGER_CAP);
  return Math.round(((base ?? 0) + steps * STAGGER) * 1000) / 1000;
}
