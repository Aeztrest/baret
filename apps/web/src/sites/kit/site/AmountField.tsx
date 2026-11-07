import { T } from "@baret/web-ui/lib/type";
import { type JSX, useId } from "react";

/**
 * The one amount input of a demo card (OrbitYield's stake, LaunchPad's
 * contribution): its label, the balance when the site shows it, the figure
 * in the display face, a Max control, the unit, and the card's own error
 * under it. NovaSwap's card draws the same field inline.
 */
export function AmountField({
  label,
  balance,
  max,
  unit,
  value,
  onChange,
  error,
}: {
  label: string;
  /** "Balance 25.00 MON", already written out, when the site shows it. */
  balance?: string;
  /** The control that fills the whole balance, when the site has one. */
  max?: { label: string; onMax: () => void };
  /** The token symbol, kept in its own case. */
  unit: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}): JSX.Element {
  const inputId = useId();
  const errorId = useId();
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className={T.label}>
          {label}
        </label>
        {balance ? <span className={T.small}>{balance}</span> : null}
      </div>
      <div className="flex items-stretch border border-[color:var(--control-edge)] bg-[color:var(--ground)] focus-within:outline-2 focus-within:outline-offset-[3px] focus-within:outline-solid focus-within:outline-[color:var(--focus)]">
        <input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          {...(error ? { "aria-describedby": errorId } : {})}
          className="w-0 min-w-0 flex-1 bg-transparent px-4 py-4 font-display text-3xl font-extrabold tabular-nums text-[color:var(--fg)] outline-none"
        />
        {max ? (
          <button
            type="button"
            onClick={max.onMax}
            className="px-4 font-mono text-label uppercase text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          >
            {max.label}
          </button>
        ) : null}
        <span className="flex items-center border-l border-[color:var(--rule)] px-4 font-display text-lg font-bold text-[color:var(--fg)]">
          {unit}
        </span>
      </div>
      {/* Mounted from the start, so the error is spoken when it appears; sr-only takes no grid row. */}
      <p aria-live="assertive" className="sr-only">
        {error ?? ""}
      </p>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-[color:var(--blocked)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
