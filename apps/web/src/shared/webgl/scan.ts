import { SCAN_LINE_ATTR } from "./ScanLine.js";

/**
 * The one scan pass, timed so it is actually seen:
 *   - It arms the first time three quarters of the hero is in view (or of
 *     the viewport, when the hero is taller than it).
 *   - It starts no sooner than 1060 ms after arming (the H1 reveal lands
 *     within 760 ms, then a 300 ms beat) and only once the page has stopped
 *     scrolling for 250 ms, so the smooth-scroll glide is over.
 *   - From 1024 px it starts right of the copy column (48 px past the H1 and
 *     body boxes, never before 48 % of the hero) and crosses only the skyline; on the narrower photo band, nothing sits on
 *     the photo, so it crosses all of it.
 * The rule is a DOM element above the veil (ScanLine); the shader only gets
 * the line's position in canvas fractions for the window wake.
 */

const SWEEP_MS = 1200;
const FADE_MS = 500;
const AFTER_ARM_MS = 1060;
const STILL_MS = 250;
const ARM_RATIO = 0.75;
const START_WIDE = 0.48;
/** Clear space between the copy column and the line's first position. */
const COPY_GAP = 48;

/** easeOutSine: a steady sweep that eases into the right edge, no lurch. */
const easeOut = (t: number): number => Math.sin((t * Math.PI) / 2);

export interface ScanState {
  /** Line x in canvas fractions; < 0 when idle. */
  readonly scan: number;
  readonly scanA: number;
  /** The loop must keep drawing every frame (waiting or running). */
  readonly busy: boolean;
  /** Armed but not started: nothing to draw, the loop may poll slowly. */
  readonly waiting?: boolean;
}

export interface Scan {
  frame(now: number, canvas: HTMLCanvasElement): ScanState;
  dispose(): void;
}

const IDLE: ScanState = { scan: -1, scanA: 0, busy: false };

/** The first line position right of the hero copy, px from the box's left. */
function copyEdge(box: Element, b: DOMRect): number {
  let right = 0;
  for (const el of box.querySelectorAll("h1, p")) {
    right = Math.max(right, el.getBoundingClientRect().right - b.left);
  }
  return Math.max(START_WIDE * b.width, right + COPY_GAP);
}

export function createScan(canvas: HTMLCanvasElement, wake: () => void): Scan {
  const box = canvas.closest("section") ?? canvas;
  const line = box.querySelector<HTMLElement>(`[${SCAN_LINE_ATTR}]`);
  let armedAt = -1;
  let startedAt = -1;
  let from = 0;
  let done = false;
  let lastY = window.scrollY;
  let stillSince = performance.now();

  const io = new IntersectionObserver(
    ([e]) => {
      if (!e || armedAt >= 0 || done) return;
      const fit = Math.min(e.boundingClientRect.height, window.innerHeight);
      if (fit > 0 && e.intersectionRect.height / fit >= ARM_RATIO) {
        armedAt = performance.now();
        io.disconnect();
        wake();
      }
    },
    { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
  );
  io.observe(box);

  const hide = (): void => {
    if (line) line.style.opacity = "0";
  };

  return {
    frame(now, cv) {
      if (done || armedAt < 0) return IDLE;
      if (startedAt < 0) {
        const y = window.scrollY;
        if (y !== lastY) {
          lastY = y;
          stillSince = now;
        }
        if (now - armedAt < AFTER_ARM_MS || now - stillSince < STILL_MS) {
          return { scan: -1, scanA: 0, busy: true, waiting: true };
        }
        startedAt = now;
        const b0 = box.getBoundingClientRect();
        from = window.innerWidth >= 1024 ? copyEdge(box, b0) : 0;
      }
      const t = now - startedAt;
      if (t >= SWEEP_MS + FADE_MS) {
        done = true;
        hide();
        return IDLE;
      }
      const b = box.getBoundingClientRect();
      const c = cv.getBoundingClientRect();
      const x = from + easeOut(Math.min(t / SWEEP_MS, 1)) * (b.width + 2 - from);
      const a = t < SWEEP_MS ? 1 : 1 - (t - SWEEP_MS) / FADE_MS;
      if (line) {
        line.style.transform = `translate3d(${Math.round(x - 1)}px,0,0)`;
        line.style.opacity = a.toFixed(3);
      }
      const scan = c.width > 0 ? (b.left + x - c.left) / c.width : -1;
      return { scan, scanA: a, busy: true };
    },
    dispose() {
      io.disconnect();
      hide();
    },
  };
}
