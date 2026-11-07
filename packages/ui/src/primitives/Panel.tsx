import type { ReactNode } from "react";
import { cn } from "../cn.js";

/**
 * The card. One rule, no radius, no shadow.
 *
 * There is exactly one card shape in this system, so two cards on a screen
 * always look like the same kind of object.
 */
export function Panel({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  /** `sunken` sits on the page ground instead of lifting off it. */
  tone?: "default" | "sunken";
  className?: string;
}) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "grid content-start gap-2.5 border border-[color:var(--rule)] p-5",
        tone === "default" ? "bg-[color:var(--surface)]" : "bg-[color:var(--ground-deep)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The small uppercase label above a value. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-label uppercase text-[color:var(--fg-faint)]", className)}>
      {children}
    </span>
  );
}

/** A label and a value on one rule. Used down every detail screen. */
export function KeyValue({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-[color:var(--rule)] py-2 last:border-b-0",
        className,
      )}
    >
      <span className="text-sm text-[color:var(--fg-faint)]">{label}</span>
      <span className="text-right text-sm">{children}</span>
    </div>
  );
}
