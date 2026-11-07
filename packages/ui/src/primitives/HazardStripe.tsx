import { cn } from "../cn.js";

/**
 * The barricade edge. Orange and ink at 135 degrees.
 *
 * A thin edge element only: a hero card, a share image, a section divider.
 * Never a background, because at any size larger than a strip it stops reading
 * as safety equipment and starts reading as decoration.
 */
export function HazardStripe({ height = 8, className }: { height?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-slot="hazard"
      className={cn("w-full", className)}
      style={{
        height,
        backgroundImage:
          "repeating-linear-gradient(135deg, var(--accent) 0 14px, var(--fg) 14px 28px)",
      }}
    />
  );
}
