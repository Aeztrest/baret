import { cn } from "../cn.js";

/**
 * A number with a unit.
 *
 * Always tabular, so a column of amounts lines up and a changing balance does
 * not jitter. The sign is part of the meaning on a sign request, so it is
 * rendered rather than left to the caller to remember.
 */
export interface AmountProps {
  value: string;
  unit?: string;
  /** Renders a leading sign and colours the value. */
  direction?: "in" | "out" | "none";
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}

const SIZE = {
  sm: "text-sm",
  md: "text-base",
  lg: "font-display text-display-m",
  hero: "font-stencil text-display-xl",
} as const;

export function Amount({ value, unit, direction = "none", size = "md", className }: AmountProps) {
  const sign = direction === "out" ? "− " : direction === "in" ? "+ " : "";

  return (
    <span
      data-numeric
      data-slot="amount"
      className={cn(
        "whitespace-nowrap font-mono",
        SIZE[size],
        // Text takes the state's ink: the state colours themselves stay under
        // 4.5:1 on the light grounds (they are for fills and borders).
        direction === "out" && "text-[color:var(--blocked-ink)]",
        direction === "in" && "text-[color:var(--safe-ink)]",
        className,
      )}
    >
      {sign}
      {value}
      {unit ? <span className="ml-1 text-[color:var(--fg-faint)]">{unit}</span> : null}
    </span>
  );
}
