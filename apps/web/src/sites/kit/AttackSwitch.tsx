import { T } from "@baret/web-ui/lib/type";
import { type JSX, useId } from "react";

/**
 * The "suspicious swap" switch at the bottom of a demo dApp's main card. It
 * drives the same honest/attack state as Baret's strip on top, so the two
 * always agree. A native checkbox with role="switch": Space toggles it and a
 * screen reader says on or off. Square 24x44 track like the landing's rule
 * switch; on, the track takes the blocked colour, because on means attack.
 */
export function AttackSwitch({
  label,
  description,
  on,
  onToggle,
}: {
  label: string;
  /** The sentence for the current state, read after the label. */
  description: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}): JSX.Element {
  const descId = useId();
  return (
    <div className="grid gap-2 border-t border-[color:var(--rule)] pt-4">
      <label className="relative flex min-h-11 cursor-pointer items-center justify-between gap-4">
        <span className="text-sm font-medium text-[color:var(--fg)]">{label}</span>
        <input
          type="checkbox"
          role="switch"
          aria-checked={on}
          aria-describedby={descId}
          checked={on}
          onChange={(e) => onToggle(e.currentTarget.checked)}
          className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
        />
        <span
          aria-hidden="true"
          className={`flex h-6 w-11 shrink-0 items-center border-2 p-0.5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-solid peer-focus-visible:outline-[color:var(--focus)] forced-colors:border-[color:CanvasText] forced-colors:forced-color-adjust-none ${on ? "border-[color:var(--blocked)] bg-[color:var(--blocked)] forced-colors:bg-[color:Highlight]" : "border-[color:var(--fg)] forced-colors:bg-[color:Canvas]"}`}
        >
          <span
            className={`size-4 transition-transform duration-150 ease-out motion-reduce:transition-none ${on ? "translate-x-5 bg-[color:var(--surface)] forced-colors:bg-[color:HighlightText]" : "translate-x-0 bg-[color:var(--fg)] forced-colors:bg-[color:CanvasText]"}`}
          />
        </span>
      </label>
      <p id={descId} className={`${T.small} ${on ? "text-[color:var(--blocked)]" : ""}`}>
        {description}
      </p>
    </div>
  );
}
