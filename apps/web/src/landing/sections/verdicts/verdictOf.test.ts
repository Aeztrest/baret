import { home } from "@baret/content";
import { describe, expect, it } from "vitest";
import {
  announceRule,
  announceSample,
  approvalFinding,
  impactOf,
  verdictLabel,
  verdictOf,
} from "./verdictOf.js";

const { caution } = home;
const impact = (v: string) => caution.examples.find((ex) => ex.verdict === v)?.impact;

describe("verdictOf", () => {
  it("keeps send safe and swap caution whatever the rule says", () => {
    for (const ruleOn of [true, false]) {
      expect(verdictOf("send", ruleOn)).toBe("safe");
      expect(verdictOf("swap", ruleOn)).toBe("caution");
    }
  });

  it("blocks the approval with the rule on and leaves a caution with it off", () => {
    expect(verdictOf("approve", true)).toBe("blocked");
    expect(verdictOf("approve", false)).toBe("caution");
  });
});

describe("verdict check copy", () => {
  it("ties each sample to its own impact sentence, not to the verdict", () => {
    expect(impactOf("send")).toBe(impact("safe"));
    expect(impactOf("swap")).toBe(impact("caution"));
    expect(impactOf("approve")).toBe(impact("blocked"));
  });

  it("uses the column tag labels", () => {
    expect(verdictLabel("blocked")).toBe("Blocked");
    expect(verdictLabel("safe")).toBe("Safe");
  });

  it("fills every placeholder of the allowance finding", () => {
    const text = approvalFinding();
    expect(text).not.toMatch(/\{\w+\}/);
    expect(text).toContain(caution.demo.finding.values.spender);
  });

  it("announces results only", () => {
    expect(announceSample("approve", true)).toBe(`Blocked. ${impact("blocked")}`);
    expect(announceSample("approve", false)).toBe(`Caution. ${impact("blocked")}`);
    expect(announceRule(false)).toBe("Rule off. Caution.");
    expect(announceRule(true)).toBe("Rule on. Blocked.");
  });
});
