import { m, useScroll, useTransform } from "motion/react";
import { type JSX, type ReactNode, useCallback, useRef, useSyncExternalStore } from "react";
import { useReduce } from "../lib/useReduce.js";
import { cx } from "../lib/util.js";

/**
 * A scroll-linked vertical drift for a picture inside a clipping frame.
 *
 * The wrapper fills its parent (which must clip: `overflow-hidden`) and
 * moves its child from +amount to -amount of its own height while the
 * parent crosses the viewport, so the picture travels a little slower than
 * the page. The wrapper is overscanned by exactly the travel, so no edge
 * ever shows. `settle` adds a slow zoom-out (1 + settle to 1, on top of the
 * overscan) over the same pass.
 *
 * Transform only, through a range-mapping `useTransform`, so Motion can hand
 * it to a native ScrollTimeline. Phones (below 768 px) get none: on a short
 * band the travel is a few pixels, the overscan zoom softens the photo, and
 * a scroll-linked transform can trail iOS momentum scrolling by a frame. The
 * wrapper stays mounted there (so its children never remount when the width
 * crosses 768 px) with an identity transform.
 * `wide` swaps in other values from 1440 px, where a picture already scaled
 * up for the layout should not be magnified further.
 * Under reduced motion the child renders unwrapped and still.
 */

export interface ParallaxProps {
  children: ReactNode;
  /** Travel each way, as a fraction of the frame height. Default 0.04 (8 % in all). */
  amount?: number;
  /** Extra starting zoom that settles to none, e.g. 0.06 for 1.06 to 1. Default 0. */
  settle?: number;
  /** Travel and settle from 1440 px, when they should differ. */
  wide?: { readonly amount: number; readonly settle: number };
  /** Classes on the moving wrapper (it is already `absolute inset-0`). */
  className?: string;
}

const PHONE = "(max-width: 767px)";
const WIDE = "(min-width: 1440px)";

/**
 * Live media-query match. A client-only render reads the real value in its
 * first render, so a phone never shows the desktop pose for a frame. While
 * React hydrates the prerendered landing it uses the server value (desktop,
 * as drawn), then re-renders before paint with the reader's width.
 */
function useMq(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function Drift({
  children,
  amount,
  settle: baseSettle,
  wide,
  className,
}: Required<Omit<ParallaxProps, "className" | "wide">> & {
  wide: ParallaxProps["wide"];
  className: string | undefined;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const phone = useMq(PHONE);
  const isWide = useMq(WIDE) && wide !== undefined;
  const settle = phone ? 0 : isWide ? wide.settle : baseSettle;
  const a = phone ? 0 : isWide ? wide.amount : amount;
  // The frame is the clipping parent; its pass across the viewport drives the drift.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const pct = `${(a * 100).toFixed(2)}%`;
  const y = useTransform(scrollYProgress, [0, 1], [pct, `-${pct}`]);
  const base = 1 + 2 * a;
  const scale = useTransform(scrollYProgress, [0, 0.5], [base + settle, base], { clamp: true });
  return (
    <div ref={ref} className="absolute inset-0">
      <m.div
        className={cx("absolute inset-0", !phone && "will-change-transform", className)}
        style={{ y, scale }}
      >
        {children}
      </m.div>
    </div>
  );
}

export function Parallax({
  children,
  amount = 0.04,
  settle = 0,
  wide,
  className,
}: ParallaxProps): JSX.Element {
  const reduce = useReduce();
  if (reduce) return <div className={cx("absolute inset-0", className)}>{children}</div>;
  return (
    <Drift amount={amount} settle={settle} wide={wide} className={className}>
      {children}
    </Drift>
  );
}
