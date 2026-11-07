import { home } from "@baret/content";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { Reveal } from "@baret/web-ui/components/Reveal";
import { TextReveal } from "@baret/web-ui/components/TextReveal";
import { GRID } from "@baret/web-ui/lib/layout";
import { T } from "@baret/web-ui/lib/type";
import type { JSX } from "react";
import { titleId } from "../../shared/ids.js";
import { SectionFrame } from "../../shared/SectionFrame.js";
import { CapPresets } from "./agents/CapPresets.js";

/** Protocol tokens that keep their lowercase in the uppercase heading. */
const KEEP_CASE = ["x402"] as const;

const { agents } = home;

/**
 * Agents: the x402 claim on the left (heading, one paragraph), the three
 * controls Baret adds (the budget, the leash, the kill switch) as plain rows
 * on the right, and the way in (one button and the Dynamic and PaymentGuard
 * line) under the heading. At 1024 px and up the left column is sticky, so
 * the heading and the action stay beside the rows instead of leaving a void.
 * Below 1024 px everything stacks in reading order: heading, paragraph,
 * rows, action. The last row drops its bottom rule so the
 * block ends on the action, not on a line.
 *
 * The budget row (the first) carries the daily-cap presets (IMPROVE H3),
 * the only hands-on proof of the agent half. The heading breaks only
 * between its sentences (keepBeats, IMPROVE C2).
 *
 * Motion: the heading reveals word by word (web-ui TextReveal), the other
 * parts rise once. Reduced motion: static.
 */
export function AgentsSection(): JSX.Element {
  return (
    <SectionFrame sectionKey="agents" ground="ground">
      <div className={`${GRID} gap-y-10`}>
        {/* Mobile: `contents`, so heading, rows and action keep reading order.
            lg: one sticky column, held under the 56 px header while the
            three rows scroll past (Lenis drives native scroll). */}
        <div className="contents lg:sticky lg:top-[calc(3.5rem+3rem)] lg:col-span-5 lg:block lg:self-start">
          <div className="order-1 col-span-4 md:col-span-8">
            <TextReveal
              id={titleId("agents")}
              className={`${T.h2} text-[color:var(--fg)]`}
              text={agents.title}
              keepBeats
              keepCase={KEEP_CASE}
            />
            <Reveal delay={0.2}>
              <p className={`${T.lead} mt-8 max-w-[60ch]`}>{agents.body}</p>
            </Reveal>
          </div>
          <Reveal className="order-3 col-span-4 md:col-span-8 lg:mt-10">
            <LinkButton
              href={agents.action.href}
              label={agents.action.label}
              variant="ghost"
              newTab
            />
            <p className={`${T.small} mt-5 max-w-[60ch]`}>{agents.note}</p>
          </Reveal>
        </div>
        <Reveal className="order-2 col-span-4 md:col-span-8 lg:col-span-6 lg:col-start-7 lg:row-start-1">
          <ul className="divide-y divide-[color:var(--rule)] border-t border-[color:var(--rule)]">
            {agents.gaps.map((gap, i) => (
              <li key={gap.control} className="py-6 last:pb-0">
                <h3 className={`${T.h3} text-[color:var(--fg)]`}>{gap.control}</h3>
                <p className={`${T.body} mt-2`}>{gap.answer}</p>
                {i === 0 ? <CapPresets /> : null}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </SectionFrame>
  );
}
