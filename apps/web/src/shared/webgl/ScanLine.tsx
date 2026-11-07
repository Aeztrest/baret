import { useReduce } from "@baret/web-ui/lib/useReduce";
import type { JSX } from "react";

/** The attribute the skyline loop finds the rule by, inside the same section. */
export const SCAN_LINE_ATTR = "data-scan-line";

/**
 * The one scan pass's rule: a hard 2 px International Orange line. It sits
 * above the hero's veil (place it after the veil in the clipping box),
 * so it reads as the true signal colour instead of a rust drawn under 30 %
 * graphite. Invisible until the skyline loop (loop.ts) drives its transform
 * and opacity; the window wake it leaves stays in the shader. Decorative, and
 * absent under reduced motion, like the canvas.
 */
export function ScanLine(): JSX.Element | null {
  const reduce = useReduce();
  if (reduce) return null;
  return (
    <span
      aria-hidden="true"
      {...{ [SCAN_LINE_ATTR]: "" }}
      className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-orange opacity-0 will-change-transform"
    />
  );
}
