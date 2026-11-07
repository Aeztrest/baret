import { cn } from "../cn.js";
import { Amount } from "./Amount.js";

/**
 * One line of "What changes" on a sign request.
 *
 * This list is the honest version of what a transaction does, so a row never
 * hides a value behind a label. If the simulation could not work out an
 * amount, the row says so rather than showing a zero.
 */
export function ChangeRow({
  label,
  value,
  unit,
  direction = "none",
  note,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  direction?: "in" | "out" | "none";
  /** A short qualifier, such as "unlimited" or "fresh wallet". */
  note?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="change-row"
      className={cn("flex items-baseline justify-between gap-4 py-1", className)}
    >
      <span className="min-w-0 truncate text-sm text-[color:var(--fg-muted)]">{label}</span>
      <span className="flex shrink-0 items-baseline gap-2">
        {note ? (
          <span className="font-mono text-label uppercase text-[color:var(--caution-ink)]">
            {note}
          </span>
        ) : null}
        <Amount value={value} {...(unit ? { unit } : {})} direction={direction} size="sm" />
      </span>
    </div>
  );
}
