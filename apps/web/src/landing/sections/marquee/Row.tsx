import { type MotionValue, m, useMotionValue, useScroll, useTransform } from "motion/react";
import { type JSX, type RefObject, useEffect, useRef, useState } from "react";

/**
 * The marquee rows: scroll-linked, never self-running. Each row repeats its
 * checks as identical copies, enough to cover the viewport plus the travel,
 * and starts one copy to the left, so no edge of the track is ever exposed at
 * any width. Every row drifts at one constant ratio of the scroll (RATIO),
 * the same at every width, so the checks stay readable while they move. A
 * pass need not show every check: the screen-reader list in Marquee and the
 * reduced-motion list carry all of them. No loop, no spring.
 */

/** Copies rendered before the first measure: enough for 1440 px. */
const MIN_COPIES = 3;

/** Sideways px per scrolled px. The same for every row at every width. */
const RATIO = 0.1;

/** Travel over one pass: RATIO times the scroll distance of the pass. */
function travelFor(passScroll: number): number {
  return RATIO * passScroll;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** The pass runs over the middle 90 % of the strip's trip through the viewport. */
function passOf(progress: number): number {
  return clamp01((progress - 0.05) / 0.9);
}

/** One muted tone for every row, so the heading stays the only full-contrast element. */
const ROW_TONE = "text-[color:var(--fg-muted)]";

/**
 * The left padding puts the second copy's first item on the content edge at
 * the start of the pass: the
 * FRAME gutter (16 / 32 / 48 px), then half the space beyond 1180 px. The
 * percentage resolves against the full-width wrapper, so the scrollbar never
 * shifts it.
 */
const ROW_PAD = "pl-4 md:pl-8 lg:pl-[max(3rem,calc((100%_-_1180px)_/_2))]";

/** One check with its eyelet. The eyelet is the separator. */
export function MarqueeItem({
  text,
  className,
  gap = "gap-6",
}: {
  text: string;
  className: string;
  gap?: string;
}): JSX.Element {
  return (
    <span className={`inline-flex items-center ${gap}`}>
      <span className="size-3 shrink-0 rounded-full border-2 border-current opacity-55" />
      <span className={className}>{text}</span>
    </span>
  );
}

const ROW_TEXT = "font-display text-lg font-bold uppercase tracking-[0.04em] md:text-xl";

function Row({
  items,
  reverse,
  tone,
  progress,
  wrapperRef,
}: {
  items: readonly string[];
  reverse: boolean;
  tone: string;
  progress: MotionValue<number>;
  wrapperRef: RefObject<HTMLDivElement | null>;
}): JSX.Element {
  const copyRef = useRef<HTMLDivElement>(null);
  const copy = useMotionValue(0);
  const travel = useMotionValue(0);
  const [copies, setCopies] = useState(MIN_COPIES);

  useEffect(() => {
    const first = copyRef.current;
    const wrapper = wrapperRef.current;
    if (!first || !wrapper) return;
    const measure = () => {
      const c = first.offsetWidth;
      const w = wrapper.clientWidth;
      if (c <= 0) return;
      // useScroll's range is wrapper height + viewport height; a pass is its middle 90 %.
      const t = travelFor(0.9 * (wrapper.offsetHeight + window.innerHeight));
      copy.set(c);
      travel.set(t);
      setCopies(Math.max(MIN_COPIES, 1 + Math.ceil((w + t) / c)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(first);
    observer.observe(wrapper);
    // innerHeight changes without a resize of either element (phone toolbars).
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [copy, travel, wrapperRef]);

  const x = useTransform([progress, copy, travel], ([p, c, t]: number[]) => {
    const q = passOf(p ?? 0);
    const shift = (reverse ? 1 - q : q) * (t ?? 0);
    return -(c ?? 0) - shift;
  });

  return (
    <m.div
      style={{ x }}
      className={`flex w-max whitespace-nowrap will-change-transform ${ROW_PAD} ${tone}`}
    >
      {Array.from({ length: copies }, (_, n) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: copies are identical and fixed in order
          key={n}
          ref={n === 0 ? copyRef : undefined}
          className="flex shrink-0 items-center gap-6 pr-6"
        >
          {items.map((item) => (
            <MarqueeItem key={item} text={item} className={ROW_TEXT} />
          ))}
        </div>
      ))}
    </m.div>
  );
}

/** Three rows at every width (0-5, 6-11, 12-16). A and C go left, B right; direction alone tells them apart. */
function split(items: readonly string[]): readonly (readonly string[])[] {
  return [items.slice(0, 6), items.slice(6, 12), items.slice(12)];
}

export function Rows({ items }: { items: readonly string[] }): JSX.Element {
  const rowsRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: rowsRef,
    offset: ["start end", "end start"],
  });
  const rows = split(items);

  return (
    <div ref={rowsRef} aria-hidden="true" className="mt-10 grid grid-cols-1 gap-4">
      {rows.map((row, i) => (
        <Row
          key={row[0] ?? ""}
          items={row}
          reverse={i === 1}
          tone={ROW_TONE}
          progress={scrollYProgress}
          wrapperRef={rowsRef}
        />
      ))}
    </div>
  );
}
