import type { JSX } from "react";

/**
 * One square radio segment (IMPROVE H shared contract). A native radio, so
 * the group gets arrow keys, one tab stop and correct announcements with no
 * library. The input sits under the face, transparent, so a tap anywhere on
 * the face hits it. Selected: ink fill, chalk text. Orange is only the focus
 * ring. The selection swaps in the same frame; only the press tint on an
 * unselected face eases (IMPROVE A1). The rest edge is ink at 55 %, which
 * clears 3:1 against the ground for a control boundary. Forced colours drop
 * the fills, so the selected face paints itself in Highlight there.
 */
const FACE =
  "flex min-h-11 w-full items-center border border-[color:var(--control-edge)] py-2 peer-[:active:not(:checked)]:transition-[background-color] peer-[:active:not(:checked)]:duration-150 peer-hover:border-[color:var(--fg)] peer-[:active:not(:checked)]:bg-[color:var(--ground-deep)] text-sm font-medium leading-snug text-[color:var(--fg)] peer-checked:border-[color:var(--fg)] peer-checked:bg-[color:var(--fg)] peer-checked:text-[color:var(--ground)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-solid peer-focus-visible:outline-[color:var(--accent)] forced-colors:peer-checked:border-[color:Highlight] forced-colors:peer-checked:bg-[color:Highlight] forced-colors:peer-checked:text-[color:HighlightText] forced-colors:peer-checked:forced-color-adjust-none";

export interface SegmentProps {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onSelect: (value: string) => void;
  /** Classes on the face in place of the default 16 px side padding, for
   *  example centred numbers in a narrow cell. */
  faceClassName?: string;
}

export function Segment({
  name,
  value,
  checked,
  label,
  onSelect,
  faceClassName,
}: SegmentProps): JSX.Element {
  return (
    <label className="relative block cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="peer absolute inset-0 size-full scroll-mb-[40vh] cursor-pointer appearance-none opacity-0"
      />
      <span className={`${FACE} ${faceClassName ?? "px-4"}`}>{label}</span>
    </label>
  );
}
