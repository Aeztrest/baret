import { Img } from "@baret/web-ui/components/Img";
import { DUR, EASE_OUT_SOFT } from "@baret/web-ui/lib/motion";
import { m, type Transition } from "motion/react";
import type { JSX } from "react";
import type { PictureFrame } from "./frames.js";

/**
 * One opener frame. Frames swap on discrete scroll steps and tween on time,
 * so a paused scroll never shows a half-blended pair.
 *
 * The swap is a cut through the ink ground, never a dissolve: the outgoing
 * frame sits on top and fades to the graphite stage in 160 ms (the caption's
 * own fade-out), and only then does the incoming frame fade up beneath it.
 * The two photos are never on screen at partial opacity together, and the
 * photo changes in the same beat as the caption (LinePlate). The order is the
 * same in both directions. A frame that leaves the pair drops out at once.
 */

export type FrameState = "active" | "prev" | "idle";

/** The outgoing frame: to ink, on the caption's fade-out. */
const OUT: Transition = { duration: DUR.enter, ease: "easeOut" };
/** The incoming frame: up from ink once the outgoing one is gone. */
const IN: Transition = { duration: DUR.frame - DUR.enter, ease: EASE_OUT_SOFT, delay: DUR.enter };
const RETIRE: Transition = { duration: 0 };
/** The drift resets once the outgoing frame has reached ink. */
const RESET: Transition = { duration: 0, delay: DUR.enter };

/**
 * The stage drift: a frame that takes the stage settles from 1.035x and
 * 1 % low to rest over 2.4 s, so each picture arrives with a little depth
 * and then holds still. Frames off stage reset after the crossfade. Frame 0
 * starts at rest (initial={false}): the LCP never moves on load. The opener
 * renders StaticNotes under reduced motion, so this never runs there.
 */
const SETTLED = { scale: 1, y: "0%" } as const;
const WAITING = { scale: 1.035, y: "1%" } as const;
const SETTLE: Transition = { duration: 2.4, ease: EASE_OUT_SOFT };

interface Pose {
  readonly z: string;
  readonly opacity: 0 | 1;
  readonly transition: Transition;
}

function pose(state: FrameState): Pose {
  if (state === "active") return { z: "z-[1]", opacity: 1, transition: IN };
  if (state === "prev") return { z: "z-[2]", opacity: 0, transition: OUT };
  return { z: "z-0", opacity: 0, transition: RETIRE };
}

export function FrameLayer({
  frame,
  state,
  mounted,
}: {
  frame: PictureFrame;
  state: FrameState;
  /** False until the reader is one step away; the picture then stays mounted. */
  mounted: boolean;
}): JSX.Element {
  const p = pose(state);
  const ground = frame.backdrop ?? frame.asset.ground;
  return (
    <m.div
      className={`absolute inset-0 ${p.z} overflow-hidden bg-graphite`}
      initial={false}
      animate={{ opacity: p.opacity }}
      transition={p.transition}
      {...(ground ? { style: { background: ground } } : {})}
    >
      {mounted ? (
        <m.div
          className="absolute inset-0 will-change-transform"
          initial={false}
          animate={state === "active" ? SETTLED : WAITING}
          transition={state === "active" ? SETTLE : RESET}
        >
          <Img
            asset={frame.asset}
            fit={frame.fit}
            position={frame.position}
            loading={frame.loading}
            fade={false}
            className={`absolute inset-0 size-full ${frame.zoom ?? ""}`}
          />
        </m.div>
      ) : null}
    </m.div>
  );
}
