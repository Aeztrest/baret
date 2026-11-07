import { createSkyline, type Skyline } from "./gl.js";
import { createScan } from "./scan.js";

/**
 * The skyline's lifecycle, outside React: sizing, the frame loop, the one
 * scan pass, pausing and context loss. `start` returns a cleanup.
 *
 * The grain is static, so at rest nothing redraws and the frame loop stops.
 * It runs only while the pointer lean is easing or the scan is waiting or
 * crossing (scan.ts), and only while the canvas is on screen and the tab is
 * visible. While the scan waits for the page to settle, nothing is drawn and
 * the loop polls at 10 Hz instead of every frame.
 *
 * `transient` (phones, coarse pointers): there is no lean, so after the one
 * scan pass the canvas has nothing left to add over the native-resolution
 * <img>; `onDone` fires and the owner fades the canvas out and stops it.
 * It also fires when the pass never gets to play: once the canvas scrolls
 * out of view after it was shown (a touch fling past the hero), or
 * TRANSIENT_MS after it was shown, so a phone never keeps a softer 1.5x
 * buffer and a live context over the native <img>.
 */

export interface LoopOptions {
  /** Called once, after the first frame is on the canvas: fade it in now. */
  onReady(): void;
  /** Called when WebGL is gone for good: show the <img> again. */
  onFail(): void;
  /**
   * Called on a context loss that may still be restored: hide the canvas but
   * keep it mounted, so the restore event can reach it. `onReady` fires
   * again once a restored context has drawn.
   */
  onLost(): void;
  /** Lean toward the pointer (fine pointers only). */
  pointer: boolean;
  /** Retire the canvas after the scan pass (no lean to keep it for). */
  transient: boolean;
  /** Called once, when `transient`: the pass is over, or will not play. */
  onDone(): void;
}

/** Poll interval while the scan waits for the page to settle. */
const POLL_MS = 100;
/** `transient`: the longest the canvas waits on screen for its scan pass. */
const TRANSIENT_MS = 6000;

const DPR_CAP = 1.5;
/** Fixed grain seed: the grain is paper, it does not crawl. */
const SEED = 17;
/** Pointer easing per 60 Hz frame. */
const EASE = 0.06;

/** object-position of the <img>, as fractions; percentages only, else centre. */
function objectPosition(img: HTMLImageElement): [number, number] {
  const parts = getComputedStyle(img).objectPosition.split(/\s+/);
  const f = (v: string | undefined): number =>
    v?.endsWith("%") ? Number.parseFloat(v) / 100 : 0.5;
  return [f(parts[0]), f(parts[1])];
}

export function start(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  o: LoopOptions,
): () => void {
  let gl: Skyline | null = createSkyline(canvas, img);
  if (!gl) {
    o.onFail();
    return () => {};
  }

  let raf = 0;
  let poll = 0;
  let finished = false;
  let visible = false;
  let last = 0;
  let ready = false;
  let dirty = true;
  let scanWas = false;
  let crossing = false;
  let expiry = 0;
  const target = { x: 0, y: 0 };
  const lean = { x: 0, y: 0 };

  const size = (): void => {
    // Layout size, not the transformed rect: the parallax and the 1.2x zoom
    // scale the canvas and the img together.
    const [px, py] = objectPosition(img);
    gl?.resize(
      canvas.clientWidth,
      canvas.clientHeight,
      Math.min(window.devicePixelRatio || 1, DPR_CAP),
      px,
      py,
    );
    dirty = true;
    wake();
  };

  const frame = (now: number): void => {
    raf = 0;
    if (!gl || !visible || document.hidden) return;
    const dt = last ? Math.min(now - last, 100) : 16.7;
    const k = 1 - (1 - EASE) ** (dt / 16.7);
    lean.x += (target.x - lean.x) * k;
    lean.y += (target.y - lean.y) * k;
    const easing = Math.abs(target.x - lean.x) + Math.abs(target.y - lean.y) > 0.002;

    const sc = scan.frame(now, canvas);
    const busy = easing || sc.busy;
    // One clean frame after the pass, so no wake is left behind.
    const ended = scanWas && !sc.busy;
    if (ended) dirty = true;
    scanWas = sc.busy;
    crossing = sc.busy && sc.waiting !== true;
    const idleWait = sc.waiting === true && !easing;

    if ((busy && !idleWait) || dirty || !ready) {
      gl.draw({ pointerX: lean.x, pointerY: lean.y, seed: SEED, scan: sc.scan, scanA: sc.scanA });
      dirty = false;
      if (!ready) {
        ready = true;
        o.onReady();
        if (o.transient && !expiry) {
          expiry = window.setTimeout(() => {
            // Mid-pass, the pass's own end retires it a moment later.
            if (!crossing) retire();
          }, TRANSIENT_MS);
        }
      }
    }
    if (ended) retire();
    last = now;
    if (idleWait) {
      last = 0;
      poll = window.setTimeout(() => {
        poll = 0;
        wake();
      }, POLL_MS);
    } else if (busy) raf = requestAnimationFrame(frame);
    else last = 0;
  };

  function retire(): void {
    if (!o.transient || finished) return;
    finished = true;
    o.onDone();
  }

  function wake(): void {
    if (!raf && !poll && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      const was = visible;
      visible = entry?.isIntersecting ?? false;
      if (visible) wake();
      // Scrolled away (before or during the pass): nothing left to show.
      else if (was && ready) retire();
    },
    { threshold: 0 },
  );
  io.observe(canvas);
  const scan = createScan(canvas, () => wake());

  const ro = new ResizeObserver(size);
  ro.observe(canvas);

  const onVis = (): void => {
    last = 0;
    wake();
  };
  document.addEventListener("visibilitychange", onVis);

  const onMove = (e: PointerEvent): void => {
    if (e.pointerType !== "mouse") return;
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
    wake();
  };
  if (o.pointer) window.addEventListener("pointermove", onMove, { passive: true });

  const onLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    window.clearTimeout(poll);
    raf = 0;
    poll = 0;
    gl = null;
    ready = false;
    o.onLost();
  };
  const onRestored = (): void => {
    gl = createSkyline(canvas, img);
    if (gl) {
      size();
      return;
    }
    // Gone for good: stop everything before the owner unmounts the canvas.
    teardown();
    o.onFail();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  size();

  function teardown(): void {
    cancelAnimationFrame(raf);
    window.clearTimeout(poll);
    window.clearTimeout(expiry);
    io.disconnect();
    scan.dispose();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    gl?.dispose();
    gl = null;
  }

  return teardown;
}
