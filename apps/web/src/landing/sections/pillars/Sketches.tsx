import { home } from "@baret/content";
import { Tag } from "@baret/ui/primitives/Tag";
import { EASE_BRAND } from "@baret/web-ui/lib/motion";
import { useReduce } from "@baret/web-ui/lib/useReduce";
import { Check } from "lucide-react";
import { m, useInView } from "motion/react";
import { type JSX, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

/**
 * The small live sketches inside the How it works stage, one per layer:
 * reading a transaction, a daily cap filling, an alert after a signature.
 * Sample data only (home.pillars.sketch). Each one replays every LOOP_MS
 * while its layer is shown; under reduced motion it is the finished state.
 * The first client render is the server's markup (cycle 0), and motion only
 * starts in effects, so prerendering stays hydration safe.
 */

const LOOP_MS = 5200;
const { sketch } = home.pillars;

/**
 * Counts loops while the sketch is on screen, so keyed children replay their
 * entrance: once when the reader arrives, then every LOOP_MS. Off screen
 * nothing runs.
 */
function useCycle(ref: RefObject<HTMLDivElement | null>): { cycle: number; still: boolean } {
  const still = useReduce();
  const seen = useInView(ref, { amount: 0.6 });
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (still || !seen) return;
    setCycle((c) => c + 1);
    const t = window.setInterval(() => setCycle((c) => c + 1), LOOP_MS);
    return () => window.clearInterval(t);
  }, [still, seen]);
  return { cycle, still };
}

/** Appears after `at` seconds of each loop. Static under reduced motion. */
function Beat({
  at,
  still,
  className,
  children,
}: {
  at: number;
  still: boolean;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  if (still) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: EASE_BRAND, delay: at }}
    >
      {children}
    </m.div>
  );
}

/** The card every sketch sits on: the surface, a hairline, mono text. */
export function SketchCard({
  children,
  cardRef,
}: {
  children: ReactNode;
  cardRef: RefObject<HTMLDivElement | null>;
}): JSX.Element {
  return (
    <div
      ref={cardRef}
      className="w-[min(100%,300px)] border border-[color:var(--rule-strong)] bg-[color:var(--surface)] p-4 font-mono text-xs text-[color:var(--fg)] shadow-none"
    >
      {children}
    </div>
  );
}

export function ReadsSketch(): JSX.Element {
  const card = useRef<HTMLDivElement>(null);
  const { cycle, still } = useCycle(card);
  const s = sketch.reads;
  return (
    <SketchCard cardRef={card}>
      <div className="relative overflow-hidden border border-[color:var(--rule)] px-2 py-1.5">
        <span className="relative z-[1]">{s.tx}</span>
        {still ? null : (
          <m.span
            key={`scan-${cycle}`}
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/3 bg-[color:var(--accent)]/15"
            initial={{ x: "-100%" }}
            animate={{ x: "300%" }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          />
        )}
      </div>
      <ul key={`steps-${cycle}`} className="mt-3 space-y-1.5">
        {s.steps.map((step, i) => (
          <li key={step}>
            <Beat at={0.5 + i * 0.45} still={still} className="flex items-center gap-2">
              <Check
                aria-hidden="true"
                className="size-3.5 text-[color:var(--safe-ink)]"
                strokeWidth={2}
              />
              {step}
            </Beat>
          </li>
        ))}
      </ul>
      <Beat key={`tag-${cycle}`} at={2} still={still} className="mt-3">
        <Tag tone="blocked" size="sm">
          {s.verdict}
        </Tag>
      </Beat>
    </SketchCard>
  );
}

export function CapsSketch(): JSX.Element {
  const card = useRef<HTMLDivElement>(null);
  const { cycle, still } = useCycle(card);
  const s = sketch.caps;
  return (
    <SketchCard cardRef={card}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="uppercase tracking-[0.08em] text-[color:var(--fg-muted)]">{s.label}</span>
        <span>{s.used}</span>
      </div>
      <div className="relative mt-2 h-2.5 border border-[color:var(--rule-strong)]">
        <m.span
          key={`fill-${cycle}`}
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[90%] origin-left bg-[color:var(--fg)]"
          initial={still ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.3, ease: EASE_BRAND }}
        />
        {still ? null : (
          <m.span
            key={`over-${cycle}`}
            aria-hidden="true"
            className="absolute inset-y-0 left-[90%] w-[20%] bg-[color:var(--accent)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0.2, 0.9, 0] }}
            transition={{ duration: 1.4, delay: 1.4, ease: "easeInOut" }}
          />
        )}
      </div>
      <Beat
        key={`next-${cycle}`}
        at={1.3}
        still={still}
        className="mt-3 text-[color:var(--fg-muted)]"
      >
        {s.next}
      </Beat>
      <Beat key={`tag-${cycle}`} at={2.1} still={still} className="mt-3">
        <Tag tone="blocked" size="sm">
          {s.verdict}
        </Tag>
      </Beat>
    </SketchCard>
  );
}

export function WatchesSketch(): JSX.Element {
  const card = useRef<HTMLDivElement>(null);
  const { cycle, still } = useCycle(card);
  const s = sketch.watches;
  return (
    <SketchCard cardRef={card}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="relative flex size-3 items-center justify-center">
          {still ? null : (
            <m.span
              className="absolute inset-0 rounded-full bg-[color:var(--accent)]"
              animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
              transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
            />
          )}
          <span className="relative size-2 rounded-full bg-[color:var(--accent)]" />
        </span>
        <span className="uppercase tracking-[0.08em] text-[color:var(--fg-muted)]">{s.label}</span>
      </div>
      <Beat
        key={`row-${cycle}`}
        at={0.7}
        still={still}
        className="mt-3 border-l-2 border-[color:var(--accent)] pl-2"
      >
        {s.detail}
      </Beat>
      <Beat key={`tag-${cycle}`} at={1.5} still={still} className="mt-3">
        <Tag tone="watching" size="sm">
          {s.alert}
        </Tag>
      </Beat>
    </SketchCard>
  );
}
