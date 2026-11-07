import type { JSX, ReactNode } from "react";
import { FRAME, GROUND, type Ground, SECTION_PAD, SECTION_PAD_COMPACT } from "../lib/layout.js";
import { cx } from "../lib/util.js";

/** The id of a section's heading: `${id}-title`. SectionHeader takes it as `titleId`. */
export function titleIdOf(id: string): string {
  return `${id}-title`;
}

export interface SectionProps {
  /** The section's anchor. Its heading's id is titleIdOf(id). */
  id: string;
  /** Default "ground". */
  ground?: Ground;
  /** Adds data-band="dark", which a site header reads to switch to graphite. */
  band?: "dark";
  /** Default true: SECTION_PAD. "compact": SECTION_PAD_COMPACT. false: none. */
  pad?: boolean | "compact";
  /** Default true: children inside the FRAME container. */
  contained?: boolean;
  /** Appended after the frame's own classes. */
  className?: string;
  children: ReactNode;
}

const PAD: Record<string, string | undefined> = {
  true: SECTION_PAD,
  compact: SECTION_PAD_COMPACT,
};

/**
 * One page section in the landing grammar: the `<section>` landmark labelled
 * by its heading, its anchor, its ground and padding, and the container. No
 * motion of its own.
 *
 * The section takes no ref. A section that needs a scroll target or a
 * measurement box puts its own ref on an inner element.
 */
export function Section({
  id,
  ground = "ground",
  band,
  pad = true,
  contained = true,
  className,
  children,
}: SectionProps): JSX.Element {
  return (
    <section
      id={id}
      aria-labelledby={titleIdOf(id)}
      {...(band ? { "data-band": band } : {})}
      className={cx("relative", GROUND[ground], PAD[String(pad)], className)}
    >
      {contained ? <div className={FRAME}>{children}</div> : children}
    </section>
  );
}
