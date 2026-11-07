import { useId, useState } from "react";
import { cn } from "../cn.js";

/**
 * One risk finding on a sign request.
 *
 * Collapsed it is a severity dot, a title and one sentence. Expanded it adds
 * why the finding matters. That split is deliberate: the sentence has to be
 * readable in the two seconds someone gives it, and the reason has to be there
 * for the person who wants it.
 */

export type Severity = "critical" | "high" | "medium" | "low";

const DOT: Record<Severity, string> = {
  critical: "bg-[color:var(--blocked)]",
  high: "bg-[color:var(--blocked)]",
  medium: "bg-[color:var(--caution)]",
  low: "bg-[color:var(--fg-faint)]",
};

export interface FindingProps {
  severity: Severity;
  title: string;
  body: string;
  /** Why it matters. Rendered behind a disclosure. */
  why?: string;
  className?: string;
}

export function Finding({ severity, title, body, why, className }: FindingProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div
      data-slot="finding"
      data-severity={severity}
      className={cn("grid gap-1 border-t border-[color:var(--rule)] py-3", className)}
    >
      <div className="grid grid-cols-[10px_1fr] items-start gap-2.5">
        <span
          aria-hidden="true"
          className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", DOT[severity])}
        />
        <div className="grid gap-1">
          <h3 className="font-display text-base uppercase tracking-[0.03em]">{title}</h3>
          <p className="text-sm text-[color:var(--fg-muted)]">{body}</p>

          {why ? (
            <>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((previous) => !previous)}
                className="w-max font-mono text-label uppercase text-[color:var(--fg)] underline decoration-[color:var(--accent)] decoration-2 underline-offset-4"
              >
                {open ? "Less" : "Why this matters"}
              </button>
              <p
                id={panelId}
                hidden={!open}
                className="border-l-2 border-[color:var(--rule)] pl-3 text-sm text-[color:var(--fg-faint)]"
              >
                {why}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
