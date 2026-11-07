import { useEffect, useState } from "react";
import { cn } from "../cn.js";

/**
 * A cap bar.
 *
 * The colour is the information, not decoration: it changes as the bar fills,
 * so a merchant near its ceiling reads at a glance without anyone doing
 * arithmetic. The thresholds are deliberately early, because the point is to
 * warn before the cap bites rather than after.
 *
 * The bar itself is hidden from assistive technology on purpose. It never
 * appears alone: every place it is used already renders the numbers as text,
 * and a `role="meter"` here would make a screen reader announce the same value
 * twice. `describedBy` links the bar to that text for anyone who wants the
 * association made explicit.
 */
export interface MeterProps {
  /** Amount used. */
  value: number;
  /** The ceiling. */
  max: number;
  /** The id of the element that states these numbers in words. */
  describedBy?: string;
  className?: string;
}

/** Where the bar changes colour. Amber well before the cap, red at it. */
const CAUTION_AT = 0.8;

export function Meter({ value, max, describedBy, className }: MeterProps) {
  const ratio = max <= 0 ? 0 : Math.min(value / max, 1);
  const colour =
    ratio >= 1 ? "var(--blocked)" : ratio >= CAUTION_AT ? "var(--caution)" : "var(--accent)";

  // The first render (and the prerender) draws an empty bar; the next frame
  // sets the value, so the bar fills once on first show. Later changes move
  // from the old value.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      aria-hidden="true"
      data-slot="meter"
      {...(describedBy ? { "data-describes": describedBy } : {})}
      className={cn("h-2 w-full overflow-hidden bg-[color:var(--rule)]", className)}
    >
      {/* Transform only, so a change never triggers layout. BRAND fill: 460 ms
          on the BRAND ease (motion.ts), no overshoot, none under reduced motion. */}
      <div
        className="h-full w-full origin-left transition-[transform,background-color] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `scaleX(${shown ? ratio : 0})`, background: colour }}
      />
    </div>
  );
}
