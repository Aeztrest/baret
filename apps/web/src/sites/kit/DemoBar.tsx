import { demoFrame } from "@baret/content";
import { Tag } from "@baret/ui";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { T } from "@baret/web-ui/lib/type";
import type { JSX } from "react";
import { Link } from "react-router";

/**
 * Baret's strip across the top of a demo dApp: it says the site is
 * simulated, switches between the honest and the attack version of the same
 * button, and links back to the showcase. It sits in data-scope="baret" so it
 * keeps Baret's palette over the dApp's own colours.
 *
 * The switch is a native radio group: one tab stop, arrow keys between the
 * two versions, and the choice is announced.
 */

const frame = demoFrame;

export function DemoBar({
  pill = frame.pill,
  mode,
  onMode,
  labels,
  body,
}: {
  /** The strip's tag; a site that makes a real payment names itself a demo, not a simulation. */
  pill?: string;
  mode: DemoMode;
  onMode: (mode: DemoMode) => void;
  labels: { safe: string; danger: string };
  body: string;
}): JSX.Element {
  return (
    <aside
      data-scope="baret"
      aria-label={frame.toggle.legend}
      className="border-b border-[color:var(--rule)] bg-[color:var(--surface)] text-[color:var(--fg)]"
    >
      <div className="mx-auto flex w-full max-w-[1276px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-8 lg:px-12">
        {/* The visible pill starts the link's name (label in name), and the
            hidden rest says where it goes. */}
        <Link to={frame.back.href} className="inline-flex min-h-11 shrink-0 items-center">
          <Tag tone="brand" size="sm">
            {pill}
          </Tag>
          <span className="sr-only">{`, ${frame.back.label}`}</span>
        </Link>

        <fieldset className="flex shrink-0 border border-[color:var(--control-edge)]">
          <legend className="sr-only">{frame.toggle.legend}</legend>
          {(["safe", "danger"] as const).map((value) => {
            const on = mode === value;
            // The ink shades keep the light label at 4.5:1 or more on the
            // fill; in dark they equal the state colours.
            const tone =
              value === "safe"
                ? "has-[:checked]:bg-[color:var(--safe-ink)]"
                : "has-[:checked]:bg-[color:var(--blocked-ink)]";
            return (
              <label
                key={value}
                className={`relative flex h-11 cursor-pointer items-center px-4 font-display text-sm font-extrabold uppercase tracking-[0.06em] has-[:checked]:text-[color:var(--surface)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-[color:var(--accent)] forced-colors:forced-color-adjust-none forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] forced-colors:has-[:checked]:bg-[Highlight] forced-colors:has-[:checked]:text-[HighlightText] forced-colors:has-[:focus-visible]:outline-[CanvasText] ${tone} ${on ? "" : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"}`}
              >
                <input
                  type="radio"
                  name="demo-mode"
                  value={value}
                  checked={on}
                  onChange={() => onMode(value)}
                  className="sr-only"
                />
                {labels[value]}
              </label>
            );
          })}
        </fieldset>

        <p className={`${T.small} min-w-[24ch] flex-1`} aria-live="polite">
          {body}
        </p>
      </div>
    </aside>
  );
}
