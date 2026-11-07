import { home } from "@baret/content";
import { FRAME } from "@baret/web-ui/lib/layout";
import { useReduce } from "@baret/web-ui/lib/useReduce";
import type { JSX } from "react";
import { SectionFrame } from "../../shared/SectionFrame.js";
import { SectionHeader } from "../../shared/SectionHeader.js";
import { MarqueeItem, Rows } from "./marquee/Row.js";

const STATIC_TEXT = "font-display text-base font-bold uppercase tracking-[0.04em] md:text-lg";

/** Reduced motion: one check per line on phone, a wrapped list from 768 px. */
function StaticList({ items }: { items: readonly string[] }): JSX.Element {
  return (
    <ul
      className={`${FRAME} mt-10 flex flex-col gap-y-2 text-[color:var(--fg-muted)] md:flex-row md:flex-wrap md:gap-x-6 md:gap-y-3`}
    >
      {items.map((item) => (
        <li key={item}>
          <MarqueeItem text={item} className={STATIC_TEXT} gap="gap-3" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The checks under the hero: one heading, then the checks in rows that move
 * only while the reader scrolls. The rows are aria-hidden, so a visually
 * hidden list carries the same checks for screen readers and find-in-page.
 * Reduced motion: a static list.
 */
export function MarqueeSection(): JSX.Element {
  const reduce = useReduce();
  const { label, items, listLabel } = home.marquee;
  return (
    <SectionFrame
      sectionKey="marquee"
      ground="ground"
      pad={false}
      contained={false}
      className="overflow-x-clip pt-12 pb-12 lg:pt-16 lg:pb-16"
    >
      <div className={FRAME}>
        <SectionHeader sectionKey="marquee" title={label} />
      </div>
      {reduce ? (
        <StaticList items={items} />
      ) : (
        <>
          <Rows items={items} />
          {/* WebKit drops list semantics under list-none, so the role is restated. */}
          {/* biome-ignore lint/a11y/noRedundantRoles: WebKit drops list semantics under list-none */}
          <ul role="list" aria-label={listLabel} className="sr-only">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </SectionFrame>
  );
}
