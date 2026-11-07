import { home } from "@baret/content";
import { Img } from "@baret/web-ui/components/Img";
import { FRAME } from "@baret/web-ui/lib/layout";
import { T } from "@baret/web-ui/lib/type";
import type { JSX } from "react";
import { IDS } from "../../../shared/ids.js";
import { FRAMES } from "./frames.js";

/**
 * The opener under reduced motion: one finished screen. The Confirm button
 * (l-06, frame 0) with the three lines as one plain paragraph on the same
 * flat graphite band as the loop, then the hero.
 */

const FIRST = FRAMES[0];

/**
 * The opener's height, shared by the loop and this static screen: shorter
 * than the viewport, so the hero's headline is one scroll away.
 */
/** One screen together with the 56 px sticky header (h-14) above it. */
export const OPENER_HEIGHT = "h-[calc(100svh-3.5rem)] min-h-[480px]";

/** Accessible name of the opener region, from its dedicated content key. */
export const OPENER_LABEL = home.opener.regionLabel;

export function StaticNotes(): JSX.Element {
  return (
    <section
      id={IDS.opener}
      aria-label={OPENER_LABEL}
      data-band="dark"
      className={`relative flex items-end overflow-hidden bg-graphite ${OPENER_HEIGHT}`}
    >
      {FIRST ? (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <Img
            asset={FIRST.asset}
            fit={FIRST.fit}
            position={FIRST.position}
            loading="priority"
            className={`absolute inset-0 size-full ${FIRST.zoom ?? ""}`}
          />
        </div>
      ) : null}
      <div className={`${FRAME} relative w-full pb-4 md:pb-8 lg:pb-10`}>
        <p
          className={`${T.line} w-full bg-[rgb(18_18_18/0.72)] p-4 text-chalk md:w-fit md:max-w-[560px] md:p-5 lg:max-w-[720px]`}
        >
          {home.opener.lines.join(" ")}
        </p>
      </div>
    </section>
  );
}
