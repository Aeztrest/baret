import { home } from "@baret/content";
import { RevealWords } from "@baret/web-ui/components/TextReveal";
import { DUR } from "@baret/web-ui/lib/motion";
import { T } from "@baret/web-ui/lib/type";
import { m } from "motion/react";
import type { JSX } from "react";

/**
 * The opener copy: only the active line, on one flat, hard-edged graphite
 * band (72 %) behind the text only, so the photo above stays clean and no
 * gradient is needed (BRAND: no gradients). Every line sits in
 * the same grid cell, so the block is as tall as the tallest line at every
 * width and never jumps while the lines cross-fade.
 *
 * The swap: the outgoing line fades out (160 ms); halfway through, the
 * incoming line is shown and its words rise out of their masks (RevealWords),
 * one line at a time, so the copy stays discrete and readable.
 *
 * All lines stay in the accessibility tree in reading order: each item holds
 * a visually hidden copy of its line (RevealWords; the moving words are
 * aria-hidden) and opacity does not hide it, so a screen reader reads the
 * intro once, browse mode included.
 */

const LINES = home.opener.lines;

/** Seconds the incoming line waits: the outgoing photo's cut, so the line rises with the new photo. */
const SWAP_OVERLAP = DUR.enter;

function LineItem({ line, active }: { line: string; active: boolean }): JSX.Element {
  return (
    <m.li
      className={`[grid-area:1/1] ${T.line} text-chalk`}
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{
        // The incoming item is simply visible once the outgoing one is half
        // gone; its words carry the entrance, so the two never overlap.
        duration: active ? 0 : DUR.enter,
        ease: "easeOut",
        delay: active ? SWAP_OVERLAP : 0,
      }}
    >
      <RevealWords text={line} show={active} delay={SWAP_OVERLAP} />
    </m.li>
  );
}

export function LinePlate({ index }: { index: number }): JSX.Element {
  return (
    <div className="w-full bg-[rgb(18_18_18/0.72)] p-4 md:w-fit md:max-w-[560px] md:p-5 lg:max-w-[720px]">
      <ol className="relative grid">
        {LINES.map((line, i) => (
          <LineItem key={line} line={line} active={i === index} />
        ))}
      </ol>
    </div>
  );
}
