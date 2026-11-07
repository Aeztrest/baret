import { findings, home } from "@baret/content";
import { fill } from "@baret/web-ui/lib/util";

/** The three sample requests the verdict check offers (IMPROVE H1). */
export type SampleId = "send" | "swap" | "approve";

/** The three verdicts the columns show. */
export type Verdict = "safe" | "caution" | "blocked";

const { caution } = home;

/**
 * The verdict for a sample. Only the approve sample depends on the rule:
 * on (the fail-closed default) blocks it, off leaves a Caution, because the
 * finding never goes away.
 */
export const verdictOf = (s: SampleId, ruleOn: boolean): Verdict =>
  s === "send" ? "safe" : s === "swap" ? "caution" : ruleOn ? "blocked" : "caution";

/** Which example column carries each sample's "If signed" sentence. */
const IMPACT_COLUMN: Record<SampleId, Verdict> = {
  send: "safe",
  swap: "caution",
  approve: "blocked",
};

/** What signing the sample would do. Follows the sample, not the rule. */
export function impactOf(s: SampleId): string {
  const column = IMPACT_COLUMN[s];
  return caution.examples.find((ex) => ex.verdict === column)?.impact ?? "";
}

/** The verdict's label, as the column tag spells it. */
export function verdictLabel(v: Verdict): string {
  return caution.examples.find((ex) => ex.verdict === v)?.title ?? "";
}

/** The unlimited-allowance finding, filled from the sample values. */
export function approvalFinding(): string {
  const { code, values } = caution.demo.finding;
  return fill(findings[code].body, values);
}

/** What the status region says after a sample is chosen. */
export function announceSample(s: SampleId, ruleOn: boolean): string {
  return fill(caution.demo.announce.sample, {
    verdict: verdictLabel(verdictOf(s, ruleOn)),
    impact: impactOf(s),
  });
}

/** What the status region says after the rule is switched. */
export function announceRule(ruleOn: boolean): string {
  return ruleOn ? caution.demo.announce.ruleOn : caution.demo.announce.ruleOff;
}
