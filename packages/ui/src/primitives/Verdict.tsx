import type { ReactNode } from "react";
import { cn } from "../cn.js";
import { Tag } from "./Tag.js";

/**
 * The verdict block on a sign request. The one screen the product exists for.
 *
 * Four states, and the fourth matters as much as the other three: when the
 * analysis server cannot be reached we say so rather than rounding up to safe.
 * A missing check is a failed check.
 */

export type VerdictKind = "safe" | "caution" | "blocked" | "unreachable";

const TONE = {
  safe: { edge: "var(--safe)", tint: "var(--safe)" },
  caution: { edge: "var(--caution)", tint: "var(--caution)" },
  blocked: { edge: "var(--blocked)", tint: "var(--blocked)" },
  unreachable: { edge: "var(--fg-faint)", tint: "var(--fg-muted)" },
} as const;

const TAG_TONE = {
  safe: "safe",
  caution: "caution",
  blocked: "blocked",
  unreachable: "neutral",
} as const;

export interface VerdictProps {
  kind: VerdictKind;
  /** The verdict word. Comes from content, never hardcoded here. */
  label: string;
  /** One sentence. The rule that fired, or what was checked. */
  body: string;
  /** Extra detail, such as the rule name with a link to edit it. */
  children?: ReactNode;
  /**
   * Announce the verdict to screen readers when it changes. On by default,
   * because on a sign request the verdict arriving is the news. Turn it off
   * for a static or illustrative use, which should not be a live region.
   */
  announce?: boolean;
  className?: string;
}

export function Verdict({ kind, label, body, children, announce = true, className }: VerdictProps) {
  const tone = TONE[kind];

  return (
    <section
      aria-live={announce ? "polite" : undefined}
      data-slot="verdict"
      data-kind={kind}
      className={cn(
        "chamfer grid gap-1.5 border-l-4 p-3.5 pl-3",
        "motion-safe:[animation:baret-tag-hang_240ms_ease-out] origin-[8px_50%]",
        className,
      )}
      style={{
        borderLeftColor: tone.edge,
        background: `color-mix(in srgb, ${tone.tint} 8%, var(--surface))`,
      }}
    >
      <h2
        className="font-display text-xl font-black uppercase tracking-[0.05em]"
        style={{ color: tone.tint }}
      >
        {label}
      </h2>
      <p className="text-sm text-[color:var(--fg-muted)]">{body}</p>
      {children}
    </section>
  );
}

/** The same four states as a tag, for a list row or a card corner. */
export function VerdictTag({ kind, label }: { kind: VerdictKind; label: string }) {
  return (
    <Tag tone={TAG_TONE[kind]} size="sm">
      {label}
    </Tag>
  );
}
