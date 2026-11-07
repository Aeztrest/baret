import type { JSX } from "react";
import { GRID } from "../lib/layout.js";
import { T } from "../lib/type.js";
import { Stagger, StaggerItem } from "./Reveal.js";
import { TextReveal } from "./TextReveal.js";

/** Split layout: title in columns 1 to 7, intro in 8 to 12 (one column below 1024). */
const TITLE_COLS = "col-span-4 md:col-span-8 lg:col-span-7";
const BODY_COLS = "col-span-4 md:col-span-8 lg:col-span-5";

/**
 * An intro split after its first sentence (IMPROVE B4): the lead renders in
 * --fg, the rest stays muted. No copy changes; a one-sentence intro is all
 * lead. The hero body uses the same split.
 */
export function splitLead(body: string): readonly [lead: string, rest: string] {
  const [lead = "", ...rest] = body.split(/(?<=\.)\s+/);
  return [lead, rest.join(" ")];
}

/** The two-tone intro text, for inside a `T.lead` paragraph. */
export function TwoToneText({ text }: { text: string }): JSX.Element {
  const [lead, rest] = splitLead(text);
  return (
    <>
      <span className="text-[color:var(--fg)]">{lead}</span>
      {rest ? ` ${rest}` : null}
    </>
  );
}

export interface SectionHeaderProps {
  /** The h2's id, which its section is labelled by (Section: titleIdOf(id)). */
  titleId: string;
  title: string;
  body?: string;
  /** Default "split": title in columns 1 to 7, body in 8 to 12 from 1024 px. */
  layout?: "split" | "stack";
  /**
   * Break the title only between sentences ("Reads it. Caps it."): the
   * spaces inside each sentence become no-break spaces. Default false.
   */
  keepBeats?: boolean;
  /** Tokens that keep their own case in the uppercase title (e.g. "x402", "dUSDC"). */
  keepCase?: readonly string[];
  className?: string;
  /** @deprecated Ignored. Removed by U6. */
  eyebrow?: string;
}

/**
 * A section's heading block: the h2 and an optional intro. No rule, no
 * eyebrow, no number; the heading carries the section.
 *
 * - split, from 1024 px: title in columns 1 to 7, intro in 8 to 12, tops
 *   aligned (a bottom alignment lifts a long intro above the title);
 * - stack, and every width below 1024 px: one column, 16 px apart.
 *
 * The intro's first sentence is in --fg, the rest muted (TwoToneText).
 *
 * Motion: the title's words rise out of their masks (TextReveal), and the
 * intro rises 120 ms after the first word, once. Reduced motion: static.
 */
export function SectionHeader({
  titleId,
  title,
  body,
  layout = "split",
  keepBeats = false,
  keepCase,
  className,
}: SectionHeaderProps): JSX.Element {
  const split = layout === "split";
  return (
    <Stagger
      className={`${split ? `${GRID} gap-y-4 lg:items-start` : "grid grid-cols-1 gap-y-4"}${className ? ` ${className}` : ""}`}
    >
      <div {...(split ? { className: TITLE_COLS } : {})}>
        <TextReveal
          id={titleId}
          className={`${T.h2} text-[color:var(--fg)]`}
          text={title}
          keepBeats={keepBeats}
          {...(keepCase ? { keepCase } : {})}
        />
      </div>
      {body ? (
        <StaggerItem index={2} {...(split ? { className: BODY_COLS } : {})}>
          {/* Balance, not pretty: a short intro should not end on a two-word tail. */}
          <p className={`${T.lead.replace("text-pretty", "text-balance")} max-w-[60ch]`}>
            <TwoToneText text={body} />
          </p>
        </StaggerItem>
      ) : null}
    </Stagger>
  );
}
