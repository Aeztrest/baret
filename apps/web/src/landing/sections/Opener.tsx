import { home } from "@baret/content";
import { FRAME } from "@baret/web-ui/lib/layout";
import { useReduce } from "@baret/web-ui/lib/useReduce";
import { type JSX, type RefObject, useEffect, useRef, useState } from "react";
import { IDS } from "../../shared/ids.js";
import { FrameLayer, type FrameState } from "./opener/FrameLayer.js";
import { FRAMES } from "./opener/frames.js";
import { LinePlate } from "./opener/LinePlate.js";
import { OPENER_HEIGHT, OPENER_LABEL, StaticNotes } from "./opener/StaticNotes.js";
import { useHeroSnap } from "./opener/useHeroSnap.js";

/**
 * The opener: one full screen under the header that tells the product in
 * three lines (problem, act, result) as a loop that plays by itself, like a
 * GIF, with no visible controls. It is never pinned and never tied to the
 * scroll. The first wheel step from the top lands on the hero ("Check it
 * first. Then sign.", useHeroSnap).
 *
 * The loop pauses while the stage is off screen or the tab is hidden. A
 * pause button stays for keyboard users (WCAG 2.2.2): it is invisible until
 * it takes focus. Under reduced motion it is one finished screen
 * (StaticNotes).
 */

/** How long each line holds before the next one, in ms. */
export const STEP_MS = 3600;

interface Step {
  readonly index: number;
  readonly prev: number;
}

function stateOf(i: number, step: Step): FrameState {
  if (i === step.index) return "active";
  if (i === step.prev) return "prev";
  return "idle";
}

/** True while the element is at least partly on screen and the tab is visible. */
function useOnScreen(ref: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let inView = true;
    const update = (): void => setSeen(inView && document.visibilityState === "visible");
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      update();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);
  return seen;
}

function OpenerLoop(): JSX.Element {
  const stage = useRef<HTMLElement>(null);
  const [step, setStep] = useState<Step>({ index: 0, prev: 0 });
  const [playing, setPlaying] = useState(true);
  // Pictures mount one step ahead and never unmount. Frame 1 waits for the
  // window load event (which waits for the LCP, frame 0) and idle time.
  const [reach, setReach] = useState(0);
  const onScreen = useOnScreen(stage);
  useHeroSnap();
  const running = playing && onScreen;

  const go = (next: number): void => {
    setStep((s) => (s.index === next ? s : { index: next, prev: s.index }));
    setReach((r) => Math.max(r, next + 1));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: `go` only sets state.
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go((step.index + 1) % FRAMES.length), STEP_MS);
    return () => window.clearTimeout(t);
  }, [running, step.index]);

  useEffect(() => {
    const hasIdle = typeof window.requestIdleCallback === "function";
    let idle = 0;
    const ahead = (): void => {
      const run = (): void => setReach((r) => Math.max(r, 1));
      idle = hasIdle
        ? window.requestIdleCallback(run, { timeout: 1500 })
        : window.setTimeout(run, 200);
    };
    if (document.readyState === "complete") ahead();
    else window.addEventListener("load", ahead, { once: true });
    return () => {
      window.removeEventListener("load", ahead);
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  return (
    <section
      ref={stage}
      id={IDS.opener}
      aria-label={OPENER_LABEL}
      data-band="dark"
      className={`relative overflow-hidden bg-graphite ${OPENER_HEIGHT}`}
    >
      <div aria-hidden="true">
        {FRAMES.map((f, i) => (
          <FrameLayer key={f.asset.src} frame={f} state={stateOf(i, step)} mounted={i <= reach} />
        ))}
      </div>
      <div
        className={`${FRAME} absolute inset-x-0 bottom-4 z-10 flex flex-col items-start gap-2 md:bottom-8 lg:bottom-10`}
      >
        <LinePlate index={step.index} />
        <button
          type="button"
          aria-label={playing ? home.opener.pause : home.opener.play}
          aria-pressed={!playing}
          onClick={() => setPlaying((p) => !p)}
          className="sr-only bg-[rgb(18_18_18/0.72)] px-3 py-2 font-mono text-[12px] uppercase tracking-[0.06em] text-chalk focus-visible:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]"
        >
          {playing ? home.opener.pause : home.opener.play}
        </button>
      </div>
    </section>
  );
}

export function OpenerSection(): JSX.Element {
  const reduce = useReduce();
  return reduce ? <StaticNotes /> : <OpenerLoop />;
}
