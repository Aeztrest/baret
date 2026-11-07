import { m, type Variants } from "motion/react";
import { Fragment, type JSX, type ReactNode } from "react";
import { DUR, EASE_BRAND, VIEWPORT_ONCE } from "../lib/motion.js";
import { useReduce } from "../lib/useReduce.js";

/**
 * The heading reveal: every word rises out of its own mask, once.
 *
 * - Each word is an inline-block clipped by `clip-path` (not overflow, which
 *   would move the inline-block baseline). The clip reaches 0.12 em below
 *   and far above the box, so the display faces' tight leading never cuts a
 *   glyph. The word starts 140 % down, under the clip, and rises to 0.
 * - Words are separated by real spaces, so the browser wraps, balances
 *   (`text-wrap: balance`) and lays out the final lines from the first frame:
 *   only transforms move, nothing shifts.
 * - Timing: 560 ms per word on the BRAND ease-out [0.22, 1, 0.36, 1], 45 ms
 *   apart, the stagger squeezed so the whole heading lands within 760 ms.
 *   No overshoot.
 * - One copy of the text: the moving words are the real text, joined by
 *   real space text nodes, with no aria-hidden and no visually hidden twin.
 *   Screen readers, the static (prerendered) HTML, textContent, innerText,
 *   find-in-page, translation and copy-paste all get the sentence once.
 *   Generated content (`attr()`) would drop it from copy, find and
 *   translation, and aria-label is not allowed on the generic spans
 *   RevealWords renders in. Reduced motion: the plain text, no spans.
 */

const WORD_DUR = 0.56;
const NO_TOKENS: readonly string[] = [];
const WORD_STEP = 0.045;
/** The last word lands by this many seconds after the start. */
const TOTAL_CAP = 0.76;

const word: Variants = {
  // Resets only once the outgoing element has faded (LinePlate swaps lines).
  hidden: { y: "140%", transition: { duration: 0, delay: DUR.enter } },
  shown: (delay: number) => ({
    y: "0%",
    transition: { duration: WORD_DUR, ease: EASE_BRAND, delay },
  }),
};

/** The text: one string, or forced lines (each on its own line). */
export type RevealText = string | readonly string[];

function lines(text: RevealText): readonly string[] {
  return typeof text === "string" ? [text] : text;
}

/** Holds a sentence on one line from 400 px; phones may wrap inside it. */
const BEAT_LOCK = "min-[400px]:whitespace-nowrap";

/** Sentences of a line, the full stop kept with its sentence. */
function beatsOf(line: string, keepBeats: boolean): string[] {
  if (!keepBeats) return [line];
  return line.split(/(?<=\.) /);
}

function escapeRe(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wraps every `keepCase` token in a `normal-case` span, so a protocol token
 * such as "x402" keeps its own case inside an uppercase heading.
 */
function cased(text: string, keepCase: readonly string[]): ReactNode {
  if (keepCase.length === 0) return text;
  const re = new RegExp(`(${keepCase.map(escapeRe).join("|")})`);
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed string
      <span key={i} className="normal-case">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** The plain string a reader hears: lines joined by spaces. */
export function revealLabel(text: RevealText): string {
  return lines(text).join(" ");
}

function stepFor(count: number): number {
  if (count <= 1) return 0;
  return Math.min(WORD_STEP, (TOTAL_CAP - WORD_DUR) / (count - 1));
}

interface LaidWord {
  key: string;
  text: string;
  /** A space goes before it. */
  lead: boolean;
  delay: number;
}
interface LaidBeat {
  key: string;
  lead: boolean;
  words: LaidWord[];
}
interface LaidLine {
  key: string;
  lead: boolean;
  beats: LaidBeat[];
}

/** Lines, beats and words, each word with its start delay in seconds. */
function layout(all: readonly string[], keepBeats: boolean, delay: number): LaidLine[] {
  const count = all.reduce((n, line) => n + line.split(" ").length, 0);
  const step = stepFor(count);
  let n = 0;
  return all.map((line, li) => ({
    key: `l${li}`,
    lead: li > 0,
    beats: beatsOf(line, keepBeats).map((beat, bi) => ({
      key: `b${bi}`,
      lead: bi > 0,
      words: beat.split(" ").map((text, wi) => {
        const at = n;
        n += 1;
        return {
          key: `w${at}`,
          text,
          lead: wi > 0,
          delay: Math.round((delay + at * step) * 1000) / 1000,
        };
      }),
    })),
  }));
}

export interface RevealWordsProps {
  text: RevealText;
  /** Break only between sentences: words of one sentence never part. */
  keepBeats?: boolean;
  /** Controlled: true reveals, false hides. Overrides `immediate`. */
  show?: boolean;
  /** Reveal on mount instead of on entering the viewport (above the fold). */
  immediate?: boolean;
  /** Seconds before the first word starts. */
  delay?: number;
  /** Tokens that keep their own case in an uppercase heading (e.g. "x402"). */
  keepCase?: readonly string[];
}

/**
 * The word pieces, the only copy of the text, with no wrapping element: use
 * it inside any element (LinePlate's list items).
 * Renders the plain text under reduced motion.
 */
export function RevealWords({
  text,
  keepBeats = false,
  show,
  immediate = false,
  delay = 0,
  keepCase = NO_TOKENS,
}: RevealWordsProps): JSX.Element {
  const reduce = useReduce();
  const all = lines(text);
  if (reduce) {
    if (all.length === 1) return <>{plainBeats(all[0] ?? "", keepBeats, keepCase)}</>;
    return (
      <>
        {all.map((line, i) => (
          <Fragment key={line}>
            {i > 0 ? " " : null}
            <span className="block">{plainBeats(line, keepBeats, keepCase)}</span>
          </Fragment>
        ))}
      </>
    );
  }

  const trigger =
    show !== undefined
      ? { animate: show ? "shown" : "hidden" }
      : immediate
        ? { animate: "shown" }
        : { whileInView: "shown", viewport: VIEWPORT_ONCE };

  const renderLine = (line: LaidLine): JSX.Element[] =>
    line.beats.map((beat) => (
      <Fragment key={beat.key}>
        {beat.lead ? " " : null}
        <span className={keepBeats ? BEAT_LOCK : undefined}>
          {beat.words.map((w) => (
            <Fragment key={w.key}>
              {w.lead ? " " : null}
              <span className="inline-block [clip-path:inset(-1em_-0.15em_-0.12em_-0.15em)]">
                <m.span className="inline-block" variants={word} custom={w.delay}>
                  {cased(w.text, keepCase)}
                </m.span>
              </span>
            </Fragment>
          ))}
        </span>
      </Fragment>
    ));

  const laid = layout(all, keepBeats, delay);
  return (
    <m.span initial="hidden" {...trigger}>
      {all.length === 1
        ? laid.map(renderLine)
        : laid.map((line) => (
            <Fragment key={line.key}>
              {line.lead ? " " : null}
              <span className="block">{renderLine(line)}</span>
            </Fragment>
          ))}
    </m.span>
  );
}

/**
 * Reduced motion keeps the beat rule the animated path uses: from 400 px each
 * sentence holds on one line; narrower, it may wrap inside so no heading runs
 * past the gutter.
 */
function plainBeats(line: string, keepBeats: boolean, keepCase: readonly string[]): ReactNode {
  if (!keepBeats) return cased(line, keepCase);
  return beatsOf(line, true).map((beat, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: sentences of one fixed string
    <Fragment key={i}>
      {i > 0 ? " " : null}
      <span className={BEAT_LOCK}>{cased(beat, keepCase)}</span>
    </Fragment>
  ));
}

type HeadingTag = "h1" | "h2" | "h3";

export interface TextRevealProps extends RevealWordsProps {
  as?: HeadingTag;
  id?: string;
  className?: string;
}

/**
 * A heading whose words reveal once. The moving words are its only text, so
 * its accessible name and its text content are the sentence, once.
 */
export function TextReveal({
  as: Tag = "h2",
  id,
  className,
  ...words
}: TextRevealProps): JSX.Element {
  return (
    <Tag id={id} className={className}>
      <RevealWords {...words} />
    </Tag>
  );
}
