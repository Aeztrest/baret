import { home, policy } from "@baret/content";
import { Tag } from "@baret/ui/primitives/Tag";
import { RuleSwitch } from "@baret/web-ui/components/RuleSwitch";
import { Segment } from "@baret/web-ui/components/Segment";
import { VERDICT_TONE } from "@baret/web-ui/lib/tone";
import { T } from "@baret/web-ui/lib/type";
import { type JSX, useId, useState } from "react";
import { Link } from "react-router";
import {
  announceRule,
  announceSample,
  approvalFinding,
  impactOf,
  type SampleId,
  verdictLabel,
  verdictOf,
} from "./verdictOf.js";

const { caution, hero } = home;
const { demo } = caution;
const RULE_LABEL = policy.fields["core.blockUnlimitedApprovals"].label;

const LINK =
  "inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--fg)] underline decoration-[color:var(--rule-strong)] underline-offset-4 hover:decoration-[color:var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]";

export interface VerdictCheckProps {
  sample: SampleId;
  ruleOn: boolean;
  onSample: (s: SampleId) => void;
  onRule: (on: boolean) => void;
}

/**
 * The verdict check (IMPROVE H1, with the H2 rule switch folded in): pick a
 * sample request and the verdict lands in the same frame. No timer, no
 * "checking" delay. The only motion is the tag hang, replayed by keying the
 * tag on the verdict. The status region exists from the first render and is
 * filled only by a choice; focus never leaves the control. Every slot keeps
 * its height for every sample, so a choice never shifts the page.
 */
export function VerdictCheck({ sample, ruleOn, onSample, onRule }: VerdictCheckProps): JSX.Element {
  const name = useId();
  const [said, setSaid] = useState("");
  const verdict = verdictOf(sample, ruleOn);
  const current = demo.samples.find((s) => s.id === sample) ?? demo.samples[2];
  const approve = sample === "approve";

  const pick = (value: string) => {
    const s = value as SampleId;
    onSample(s);
    setSaid(announceSample(s, ruleOn));
  };
  const toggle = (on: boolean) => {
    onRule(on);
    setSaid(announceRule(on));
  };

  return (
    <div data-demo="verdict-check" className="mt-12">
      <fieldset>
        <legend className={T.label}>{demo.legend}</legend>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {demo.samples.map((s) => (
            <Segment
              key={s.id}
              name={name}
              value={s.id}
              checked={s.id === sample}
              label={s.label}
              onSelect={pick}
            />
          ))}
        </div>
      </fieldset>
      {/* One flat grid. Below lg the rule switch and the approval finding
          share one reserved block under the impact line, sized for the
          approve state, so Send and Swap leave a single gap and nothing
          shifts. At lg that block dissolves (display: contents): the finding
          ends the left column and the right column stacks with fixed gaps,
          switch level with the tag, then the link, then the sample line. */}
      <div
        data-result={verdict}
        className="mt-6 grid gap-y-4 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-0"
      >
        <div className="lg:col-span-7 lg:row-start-1">
          <p className={T.label}>{demo.checked}</p>
          <div className="mt-3 lg:flex lg:min-h-11 lg:items-center">
            <Tag key={verdict} tone={VERDICT_TONE[verdict]} hang>
              {verdictLabel(verdict)}
            </Tag>
          </div>
        </div>
        <div className="lg:col-span-7 lg:row-start-2 lg:mt-4">
          <p className={T.label}>{caution.labels.impact}</p>
          <p className={`${T.body} mt-1 text-[color:var(--fg)]`}>{impactOf(sample)}</p>
        </div>
        <div data-slot="rule" className="flex flex-col gap-2 lg:contents">
          <div className="min-h-11 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:self-end">
            {approve ? (
              <RuleSwitch
                label={RULE_LABEL}
                stateWord={ruleOn ? demo.rule.on : demo.rule.off}
                on={ruleOn}
                onToggle={toggle}
              />
            ) : null}
          </div>
          {/* The finding shows for approve whatever the rule says; the rule
              only changes the tag. "A rule you set stopped it." is already
              the Blocked column's first sentence right below, so it is not
              repeated here. */}
          <div
            data-slot="rule-result"
            className={`${T.small} lg:col-span-7 lg:col-start-1 lg:row-start-3 lg:mt-2`}
          >
            <p className="min-h-[3lh] min-[380px]:min-h-[2lh] md:min-h-[1lh] lg:min-h-[2lh] xl:min-h-[1lh]">
              {approve ? approvalFinding() : null}
            </p>
          </div>
        </div>
        <div className="-mt-2 flex flex-col items-start gap-2 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-2 lg:mt-3 lg:self-start">
          <Link to={current.href} target="_blank" rel="noopener noreferrer" className={LINK}>
            {current.tryLabel}
          </Link>
          <p className={T.small}>{hero.previewLabel}</p>
        </div>
      </div>
      <p role="status" className="sr-only">
        {said}
      </p>
    </div>
  );
}
