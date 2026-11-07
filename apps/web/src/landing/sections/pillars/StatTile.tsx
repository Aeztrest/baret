import { EASE_BRAND, staggerDelay } from "@baret/web-ui/lib/motion";
import { T } from "@baret/web-ui/lib/type";
import { useReduce } from "@baret/web-ui/lib/useReduce";
import { animate, useInView } from "motion/react";
import { type JSX, useEffect, useLayoutEffect, useRef } from "react";

/**
 * A compact stat tile: the number in display type, its line under it.
 *
 * The number counts up once, the first time the tile is 10 % into the
 * viewport: 0 to the value over 600 ms on --ease-count (0.22, 1, 0.36, 1),
 * the BRAND count curve, each tile 80 ms after the one before. It starts
 * on intersection (delay = index * 80 ms only), so a tile that is on screen
 * never sits on a placeholder "0" while a reveal settles. The count
 * writes textContent through a ref onto a span with no React children, so
 * React never re-renders per frame and never owns the node being written.
 *
 * - Screen readers get the final value once (sr-only); the counting digits are
 *   aria-hidden.
 * - An invisible copy of the final digits holds the width; the live digits are
 *   right-aligned inside it, so the unit always sits right after them and
 *   never drifts while the count runs.
 * - Reduced motion: the final value, no count.
 */

/** The stat row's Reveal delay in Pillars.tsx. Keep the two in step. */
export const STAT_ROW_DELAY = staggerDelay(3);
const COUNT_S = 0.6;
const STEP_S = 0.08;

/** "800 ms" -> { n: 800, digits: "800", unit: "ms" }. */
function parse(value: string): { n: number; digits: string; unit: string } {
  const m = /^(\d+)\s*(.*)$/.exec(value);
  if (!m) return { n: 0, digits: value, unit: "" };
  const digits = m[1] ?? "";
  return { n: Number(digits), digits, unit: m[2] ?? "" };
}

function Count({ digits, n, index }: { digits: string; n: number; index: number }): JSX.Element {
  const reduce = useReduce();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });

  // The counting span has no React children, so writing textContent never
  // detaches a node React owns. Its starting text is set here instead.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) el.textContent = digits;
    else if (!inView || !el.textContent) el.textContent = "0";
  }, [reduce, inView, digits]);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || !inView) return;
    const controls = animate(0, n, {
      duration: COUNT_S,
      delay: index * STEP_S,
      ease: EASE_BRAND,
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, reduce, n, index]);

  return (
    <span className="relative inline-block tabular-nums" aria-hidden="true">
      <span className="invisible">{digits}</span>
      <span ref={ref} className="absolute inset-y-0 right-0 text-right" />
    </span>
  );
}

export function StatTile({
  value,
  label,
  index,
  stencil = false,
}: {
  value: string;
  label: string;
  index: number;
  stencil?: boolean;
}): JSX.Element {
  const { n, digits, unit } = parse(value);
  return (
    <div className="group flex h-full flex-col justify-between gap-4 border border-[color:var(--rule)] bg-[color:var(--surface)] p-6 transition-colors duration-[240ms] ease-out hover:border-[color:var(--fg)]">
      <p className="whitespace-nowrap text-[color:var(--fg)]">
        <span className="sr-only">{value}</span>
        <span className={stencil ? T.statStencil : T.stat}>
          <Count digits={digits} n={n} index={index} />
        </span>
        {unit ? (
          <span
            className="ml-2 font-display font-bold text-2xl tracking-[0.02em]"
            aria-hidden="true"
          >
            {unit}
          </span>
        ) : null}
      </p>
      <p className={`${T.small} max-w-[24ch]`}>{label}</p>
    </div>
  );
}
