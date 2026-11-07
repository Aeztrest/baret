import { home } from "@baret/content";
import { Tag } from "@baret/ui/primitives/Tag";
import { Reveal } from "@baret/web-ui/components/Reveal";
import { GRID } from "@baret/web-ui/lib/layout";
import { VERDICT_TONE } from "@baret/web-ui/lib/tone";
import { T } from "@baret/web-ui/lib/type";
import { type JSX, useState } from "react";
import { SectionFrame } from "../../shared/SectionFrame.js";
import { SectionHeader } from "../../shared/SectionHeader.js";
import { VerdictCheck } from "./verdicts/VerdictCheck.js";
import { type SampleId, verdictOf } from "./verdicts/verdictOf.js";

const { caution } = home;

/**
 * One verdict per column: the same top rule as the Pillars items, then the tag (wrapped in an h3
 * so each verdict is reachable by heading navigation) and the case. One tier
 * only; the "If signed" impact line shows once, in the verdict check above.
 * From 768 to 1023 px each column is a spec-sheet row on the 8-column grid
 * (subgrid): tag in columns 1-2, case in 3-8. The three columns return at 1024.
 * The column the check points at gets a 2 px ink top rule; nothing dims.
 */
const COLUMN =
  "col-span-4 border-t border-[color:var(--rule)] pt-6 pb-8 md:col-span-8 md:grid md:grid-cols-subgrid lg:col-span-4 lg:block lg:pb-0 aria-[current=true]:border-t-2 aria-[current=true]:border-[color:var(--fg)] aria-[current=true]:pt-[23px]";

/**
 * The three verdicts side by side, all visible at once: what each one means,
 * with no tabs and no panel, so nothing is hidden behind an interaction.
 * Fail-closed closes the block as one small caption line: no Tag, no rule.
 *
 * Above the columns sits the verdict check (IMPROVE H1/H2). It owns no
 * column: it only marks the matching one with aria-current.
 *
 * Motion: the header staggers in, the row rises once. Reduced motion: static.
 */
export function VerdictsSection(): JSX.Element {
  const [sample, setSample] = useState<SampleId>("approve");
  const [ruleOn, setRuleOn] = useState(true);
  const current = verdictOf(sample, ruleOn);
  return (
    <SectionFrame sectionKey="caution" ground="deep" pad="compact">
      <SectionHeader sectionKey="caution" title={caution.title} body={caution.body} />
      <VerdictCheck sample={sample} ruleOn={ruleOn} onSample={setSample} onRule={setRuleOn} />
      <Reveal className="mt-12">
        <ul className={`${GRID} gap-y-0`}>
          {caution.examples.map((ex) => (
            <li
              key={ex.verdict}
              data-verdict={ex.verdict}
              aria-current={ex.verdict === current ? "true" : undefined}
              className={COLUMN}
            >
              <h3 className="md:col-span-2 lg:col-auto">
                <Tag tone={VERDICT_TONE[ex.verdict]}>{ex.title}</Tag>
              </h3>
              <p className={`${T.body} mt-4 md:col-span-6 md:mt-0 lg:mt-4`}>{ex.body}</p>
            </li>
          ))}
        </ul>
        <p data-verdict="unreachable" className={`${T.small} mt-2 lg:mt-10`}>
          {caution.honesty.title}
        </p>
      </Reveal>
    </SectionFrame>
  );
}
