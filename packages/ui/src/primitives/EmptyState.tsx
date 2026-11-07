import type { ReactNode } from "react";
import { cn } from "../cn.js";

/**
 * What a screen says when it has nothing to show.
 *
 * Twenty-one of these exist in the copy. The rule they all follow: reassuring
 * and actionable, never apologetic. An empty allowances list is the safest
 * possible state and the copy says so, rather than treating it as a gap.
 */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "grid justify-items-center gap-2 border border-dashed border-[color:var(--rule-strong)] px-5 py-10 text-center",
        className,
      )}
    >
      <h3 className="font-display text-display-m uppercase">{title}</h3>
      <p className="max-w-[46ch] text-sm text-[color:var(--fg-muted)]">{body}</p>
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}
