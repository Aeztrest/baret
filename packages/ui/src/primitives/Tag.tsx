import type { ReactNode } from "react";
import { cn } from "../cn.js";

/**
 * The tag. Baret's signature device.
 *
 * A safety tag is a card with a chamfered corner so it does not snag and a
 * coloured edge that reads from across a site. Every verdict,
 * status pill and section marker in the product is one of these. It is what
 * makes a Baret screen recognisable at thumbnail size, before the logo is
 * even visible. Spec: docs/BRAND.md section 03.
 */

export type TagTone = "neutral" | "safe" | "caution" | "blocked" | "watching" | "network" | "brand";

const EDGE: Record<TagTone, string> = {
  neutral: "border-l-[color:var(--fg-faint)] text-[color:var(--fg-muted)]",
  safe: "border-l-[color:var(--safe)] text-[color:var(--safe-ink)]",
  caution: "border-l-[color:var(--caution)] text-[color:var(--caution-ink)]",
  blocked: "border-l-[color:var(--blocked)] text-[color:var(--blocked-ink)]",
  watching: "border-l-[color:var(--watching)] text-[color:var(--watching-ink)]",
  network: "border-l-[color:var(--network)] text-[color:var(--network-ink)]",
  brand: "border-l-[color:var(--on-accent)] text-[color:var(--on-accent)]",
};

export interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  /** An optional ring before the label. Off by default: the edge and chamfer carry the tag. */
  eyelet?: boolean;
  /** Plays the hang animation once, as a verdict lands. */
  hang?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function Tag({
  children,
  tone = "neutral",
  eyelet = false,
  hang = false,
  size = "md",
  className,
}: TagProps) {
  return (
    <span
      // Read by the forced-colours block in tokens.css, which gives each
      // verdict its own edge shape once the system has repainted the hues.
      data-tone={tone}
      className={cn(
        "chamfer inline-flex items-center gap-2 border-l-4 font-display font-extrabold uppercase tracking-[0.06em]",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-3 text-sm",
        tone === "brand" ? "bg-[color:var(--accent)]" : "bg-[color:var(--tag-paper)]",
        EDGE[tone],
        hang && "origin-[8px_50%] motion-safe:[animation:baret-tag-hang_240ms_ease-out]",
        className,
      )}
    >
      {eyelet ? (
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full border-2 border-current opacity-55"
        />
      ) : null}
      {children}
    </span>
  );
}
