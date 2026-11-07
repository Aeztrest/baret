import { Reveal } from "@baret/web-ui/components/Reveal";
import { TextReveal } from "@baret/web-ui/components/TextReveal";
import { FRAME, GRID } from "@baret/web-ui/lib/layout";
import { EASE_BRAND, SURFACE, SURFACE_SETTLE, VIEWPORT_ONCE } from "@baret/web-ui/lib/motion";
import { T } from "@baret/web-ui/lib/type";
import { format } from "@baret/web-ui/lib/useCountUp";
import { useReduce } from "@baret/web-ui/lib/useReduce";
import { animate, m, useInView } from "motion/react";
import { type JSX, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from "react";

/**
 * The page-level pieces every demo dApp shares: its hero (claim on the left,
 * its main card on the right), the head of a secondary page, and the two
 * figure blocks of a stats page. The display title is the dApp's own, never
 * Baret's stencil.
 */

/** A dApp's page title: display face, 44 to 80 px, tight leading. */
export const SITE_H1 =
  "font-display text-[clamp(2.75rem,1.5rem+4vw,5rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.005em] text-[color:var(--fg)]";

export function SiteHero({
  badge,
  title,
  body,
  keepCase,
  card,
}: {
  badge: string;
  title: string;
  body: string;
  /** Mixed-case tokens in the title (dUSDC, oMON) that must not be uppercased. */
  keepCase?: readonly string[];
  /** The site's main card: the swap form, the mint box, the question box. */
  card: ReactNode;
}): JSX.Element {
  return (
    <section className={`${FRAME} py-12 md:py-16 lg:py-24`}>
      <div className={`${GRID} gap-y-12 lg:items-center`}>
        <div className="col-span-4 grid gap-6 md:col-span-8 lg:col-span-6">
          <p className={T.label}>{badge}</p>
          <TextReveal
            as="h1"
            text={title}
            immediate
            className={SITE_H1}
            {...(keepCase ? { keepCase } : {})}
          />
          <p className={`${T.lead} max-w-[46ch]`}>{body}</p>
        </div>
        <Reveal className="col-span-4 md:col-span-8 lg:col-span-5 lg:col-start-8">{card}</Reveal>
      </div>
    </section>
  );
}

/** The head of a secondary page: its title, one line, and the sample-figures note. */
export function PageHead({
  title,
  body,
  note,
}: {
  title: string;
  body: string;
  note: string;
}): JSX.Element {
  return (
    <div className="grid max-w-[760px] gap-4">
      <TextReveal
        as="h1"
        text={title}
        immediate
        className="font-display text-[clamp(2.75rem,1.5rem+4vw,5rem)] font-extrabold uppercase leading-[0.92] text-[color:var(--fg)]"
      />
      <p className={T.lead}>{body}</p>
      <p className={T.label}>{note}</p>
    </div>
  );
}

/** A secondary page's frame: same padding as the home page's hero. */
export function PageFrame({ children }: { children: ReactNode }): JSX.Element {
  return <section className={`${FRAME} grid gap-12 py-12 md:py-16 lg:py-24`}>{children}</section>;
}

/**
 * A meter or bar that fills once, the first time it is in view: a scale from
 * 0 on the BRAND surface timing, from the left (`x`) or the bottom (`y`).
 * Transform only, so nothing around it moves. Under reduced motion it is a
 * plain, full element.
 */
export function Fill({
  axis,
  className,
  size,
  children,
  "aria-hidden": hidden,
}: {
  axis: "x" | "y";
  className: string;
  /** The filled length along `axis`, as a CSS length ("40%"). */
  size?: string;
  children?: ReactNode;
  "aria-hidden"?: boolean;
}): JSX.Element {
  const reduce = useReduce();
  const style = size === undefined ? {} : axis === "x" ? { width: size } : { height: size };
  if (reduce)
    return (
      <div className={className} style={style} aria-hidden={hidden}>
        {children}
      </div>
    );
  const from = axis === "x" ? { scaleX: 0 } : { scaleY: 0 };
  const to = axis === "x" ? { scaleX: 1 } : { scaleY: 1 };
  return (
    <m.div
      className={`${className} ${axis === "x" ? "origin-left" : "origin-bottom"}`}
      style={style}
      initial={from}
      whileInView={to}
      viewport={VIEWPORT_ONCE}
      transition={{ ...SURFACE, delay: SURFACE_SETTLE }}
      {...(hidden ? { "aria-hidden": true } : {})}
    >
      {children}
    </m.div>
  );
}

/** "$4.2M" -> { head: "$", digits: "4.2", tail: "M" }; null when there is no number. */
export function splitFigure(
  value: string,
): { head: string; digits: string; tail: string; n: number } | null {
  const match = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value);
  if (!match) return null;
  const digits = match[2] ?? "";
  const n = Number.parseFloat(digits.replaceAll(",", ""));
  if (!Number.isFinite(n) || n === 0) return null;
  return { head: match[1] ?? "", digits, tail: match[3] ?? "", n };
}

const COUNT_S = 0.6;

/**
 * A big figure that counts up once, the first time it is in view, like the
 * landing's stat tiles: 600 ms on the BRAND ease, keeping the value's
 * decimals, commas and its prefix and unit. An invisible copy of the final
 * text holds the width, so nothing moves. Screen readers get the final value
 * once; the counting text is hidden from them. Under reduced motion, or for a
 * value with no number, the final text shows at once.
 */
export function Figure({ value }: { value: string }): JSX.Element {
  const reduce = useReduce();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, VIEWPORT_ONCE);
  const parts = useMemo(() => splitFigure(value), [value]);

  // The counting span has no React children, so writing textContent never
  // detaches a node React owns.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !parts) el.textContent = value;
    else if (!inView || !el.textContent)
      el.textContent = parts.head + format(0, parts.digits) + parts.tail;
  }, [reduce, inView, value, parts]);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || !inView || !parts) return;
    const controls = animate(0, parts.n, {
      duration: COUNT_S,
      ease: EASE_BRAND,
      onUpdate: (v) => {
        el.textContent = parts.head + format(v, parts.digits) + parts.tail;
      },
      onComplete: () => {
        el.textContent = value;
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, parts]);

  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="relative inline-block">
        <span className="invisible">{value}</span>
        <span ref={ref} className="absolute inset-0 whitespace-nowrap" />
      </span>
    </>
  );
}

/**
 * Daily bars, the last one in the accent with its value printed above it.
 * Every bar takes focus and shows its own value on hover or focus, so the
 * figures never hide behind a mouse-only tooltip.
 */
export function BarChart({
  title,
  caption,
  unit,
  labels,
  values,
}: {
  title: string;
  caption: string;
  unit: string;
  labels: readonly string[];
  values: readonly number[];
}): JSX.Element {
  const max = Math.max(...values);
  const last = values.length - 1;
  return (
    <Reveal className="grid gap-6 border-t border-[color:var(--rule-strong)] pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className={`${T.h3} text-[color:var(--fg)]`}>{title}</h2>
        <p className={T.small}>{caption}</p>
      </div>
      <figure className="grid gap-2">
        <div className="flex h-64 items-end gap-1 border-b border-[color:var(--rule-strong)] pt-8 md:h-80 md:gap-2">
          {values.map((value, i) => {
            const pct = (value / max) * 100;
            return (
              <div
                key={labels[i]}
                role="img"
                aria-label={`${labels[i]}: ${value} ${unit}`}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a bar takes focus so a keyboard reader can see its value.
                tabIndex={0}
                className="group relative flex h-full flex-1 items-end outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-mark)]"
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap pb-1 font-mono text-label text-[color:var(--fg)] ${T.num} ${i === last ? "" : "hidden group-hover:block group-focus-visible:block"}`}
                  style={{ bottom: `${pct}%` }}
                >
                  {value}
                </span>
                <Fill
                  axis="y"
                  className={`w-full ${i === last ? "bg-[color:var(--accent-mark)]" : "bg-[color:var(--fg-faint)] group-hover:bg-[color:var(--accent-mark)] group-focus-visible:bg-[color:var(--accent-mark)]"} transition-colors forced-colors:bg-[CanvasText] forced-colors:group-focus-visible:bg-[Highlight]`}
                  size={`${pct}%`}
                />
              </div>
            );
          })}
        </div>
        <div aria-hidden="true" className="flex gap-1 md:gap-2">
          {labels.map((label) => (
            <span
              key={label}
              className={`flex-1 text-center font-mono text-label text-[color:var(--fg-muted)] ${T.num}`}
            >
              {label}
            </span>
          ))}
        </div>
        <figcaption className="sr-only">
          {caption} {values.map((v, i) => `${labels[i]}: ${v}`).join(", ")}
        </figcaption>
      </figure>
    </Reveal>
  );
}

/** A row of big figures on hairlines: two per row on phones, four from 1024 px. */
export function Totals({
  title,
  items,
}: {
  title: string;
  items: readonly { readonly label: string; readonly value: string }[];
}): JSX.Element {
  return (
    <Reveal className="grid gap-6">
      <h2 className={`${T.h3} text-[color:var(--fg)]`}>{title}</h2>
      <dl className="grid grid-cols-2 border-t border-[color:var(--rule)] lg:grid-cols-4">
        {items.map((item, i) => (
          // The term comes first in the markup; flex-col-reverse keeps the figure on top.
          <div
            key={item.label}
            className={`flex flex-col-reverse justify-end gap-1 border-b border-[color:var(--rule)] py-6 ${i % 2 === 1 ? "border-l pl-6" : ""} ${i > 0 ? "lg:border-l lg:pl-6" : ""}`}
          >
            <dt className={T.small}>{item.label}</dt>
            <dd className={`${T.stat} text-[color:var(--fg)]`}>
              <Figure value={item.value} />
            </dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}
