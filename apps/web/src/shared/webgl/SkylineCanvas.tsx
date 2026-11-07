import { useReduce } from "@baret/web-ui/lib/useReduce";
import { type JSX, useEffect, useRef, useState } from "react";

/**
 * A WebGL2 layer over the hero's <img>. Place it as the img's next sibling
 * inside the same box: it reads that img (pixels, object-position) and
 * covers it exactly, so nothing jumps when it fades in.
 *
 * The <img> stays the LCP and the fallback. The canvas starts only once it
 * is within one viewport of the screen (NEAR; a quarter on phones), the img has loaded and the
 * browser is idle, and never at all under reduced motion, on Save-Data, or
 * without WebGL2. The hero sits under the 190svh opener, so the context,
 * shader compile and texture upload no longer block the main thread while
 * the visitor is still reading the opener. The WebGL code itself (loop, gl,
 * shader, scan) is a separate chunk, fetched with import() only once that
 * gate opens, so none of it sits in the HomePage bundle. It is decorative and marked aria-hidden; the <img> carries the alt text.
 */

interface NetworkInformationLike {
  readonly saveData?: boolean;
}

function allowed(): boolean {
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (conn?.saveData) return false;
  return typeof WebGL2RenderingContext !== "undefined";
}

/** Below this width the canvas is transient (see `transient`). */
const PHONE_MAX = 768;
/** Matches the canvas fade (duration-[600ms]) plus a frame of slack. */
const FADE_MS = 700;

/**
 * How close to the viewport the canvas must come before WebGL starts. On
 * phones a full viewport is most of the opener, so the gate would open at
 * load: there it waits until the hero is a quarter-screen away.
 */
const NEAR = "100% 0px";
const NEAR_PHONE = "25% 0px";

/**
 * The loop chunk loader lives at module scope: the React Compiler cannot
 * lower an import() expression inside a component body.
 */
const loadLoop = (): Promise<typeof import("./loop.js")> => import("./loop.js");

/** Runs `run` once the element is within `margin` of the viewport. */
function whenNear(el: Element, margin: string, run: () => void): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    },
    { rootMargin: margin },
  );
  io.observe(el);
  return () => io.disconnect();
}

function whenLoaded(img: HTMLImageElement, run: () => void): () => void {
  let cancelled = false;
  let started = false;
  const go = (): void => {
    if (started || cancelled) return;
    started = true;
    // decode() can settle after a cleanup (StrictMode runs effects twice).
    img
      .decode()
      .catch(() => {})
      .then(() => {
        if (!cancelled) run();
      });
  };
  if (img.complete && img.naturalWidth > 0) go();
  else img.addEventListener("load", go, { once: true });
  return () => {
    cancelled = true;
    img.removeEventListener("load", go);
  };
}

export function SkylineCanvas(): JSX.Element | null {
  const reduce = useReduce();
  const ref = useRef<HTMLCanvasElement>(null);
  // Decided once, after mount: no WebGL2 or Save-Data means no canvas at all.
  // It starts "off" because the landing is prerendered and the server has no
  // WebGL; deciding during the first render would mismatch that HTML.
  const [state, setState] = useState<"idle" | "shown" | "done" | "off">("off");
  useEffect(() => {
    if (allowed()) setState("idle");
  }, []);
  // A reduced-motion round trip unmounts the canvas; the next one starts
  // hidden. Adjusted during render, not in an effect cleanup.
  const [seenReduce, setSeenReduce] = useState(reduce);
  if (seenReduce !== reduce) {
    setSeenReduce(reduce);
    if (state !== "off") setState("idle");
  }

  useEffect(() => {
    const canvas = ref.current;
    const img = canvas?.parentElement?.querySelector("img");
    if (reduce || !canvas || !img) return;
    let stop = (): void => {};
    let idle = 0;
    let retire = 0;
    // Phones: no lean, and the capped buffer is softer than the native img,
    // so the canvas only carries the scan pass, then fades out and stops.
    const transient =
      !window.matchMedia("(pointer: fine)").matches || window.innerWidth < PHONE_MAX;
    const hasIdle = typeof window.requestIdleCallback === "function";
    let cancelLoad = (): void => {};
    let cancelled = false;
    const cancelNear = whenNear(canvas, transient ? NEAR_PHONE : NEAR, () => {
      cancelLoad = whenLoaded(img, () => {
        const run = (): void => {
          void loadLoop().then(
            ({ start }) => {
              if (cancelled) return;
              stop = start(canvas, img, {
                onReady: () => setState("shown"),
                onFail: () => setState("off"),
                onLost: () => setState("idle"),
                pointer: !transient,
                transient,
                onDone: () => {
                  setState("done");
                  retire = window.setTimeout(() => stop(), FADE_MS);
                },
              });
            },
            () => setState("off"),
          );
        };
        idle = hasIdle
          ? window.requestIdleCallback(run, { timeout: 1500 })
          : window.setTimeout(run, 200);
      });
    });
    return () => {
      cancelled = true;
      cancelNear();
      cancelLoad();
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.clearTimeout(retire);
      stop();
    };
  }, [reduce]);

  if (reduce || state === "off") return null;
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas without tabIndex is not focusable.
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full transition-opacity duration-[600ms] ease-out ${
        state === "shown" ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
