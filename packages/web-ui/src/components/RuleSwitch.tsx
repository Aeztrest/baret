import type { JSX } from "react";

export interface RuleSwitchProps {
  /** The real rule name. It never changes with the state (APG switch). */
  label: string;
  /** The state word beside the label, "On" or "Off", set like the label so
   *  it reads as part of it, not as a tag. */
  stateWord: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}

/**
 * The rule switch (IMPROVE H2): a native checkbox with role="switch", so
 * Space toggles it and a screen reader says "on" or "off". A square 24x44
 * track; only the thumb moves (150 ms transform), colours swap at once.
 * The whole row is the 44 px hit area. Forced colours drop the fills, so
 * there the track and thumb paint in system colours: Highlight when on.
 */
export function RuleSwitch({ label, stateWord, on, onToggle }: RuleSwitchProps): JSX.Element {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        role="switch"
        aria-checked={on}
        checked={on}
        onChange={(e) => onToggle(e.currentTarget.checked)}
        className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      />
      <span
        aria-hidden="true"
        className={`flex h-6 w-11 shrink-0 items-center border-2 border-[color:var(--fg)] p-0.5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-solid peer-focus-visible:outline-[color:var(--accent)] forced-colors:border-[color:CanvasText] forced-colors:forced-color-adjust-none ${on ? "bg-[color:var(--fg)] forced-colors:bg-[color:Highlight]" : "forced-colors:bg-[color:Canvas]"}`}
      >
        <span
          className={`size-4 transition-transform duration-150 ease-out motion-reduce:transition-none ${on ? "translate-x-5 bg-[color:var(--ground)] forced-colors:bg-[color:HighlightText]" : "translate-x-0 bg-[color:var(--fg)] forced-colors:bg-[color:CanvasText]"}`}
        />
      </span>
      <span className="text-sm font-medium text-[color:var(--fg)]">
        {label}
        <span aria-hidden="true" className="ml-2">
          {stateWord}
        </span>
      </span>
    </label>
  );
}
