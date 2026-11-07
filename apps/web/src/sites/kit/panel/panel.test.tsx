import { analysisPanel, common, demoFrame, findings } from "@baret/content";
import type { CheckResult, DemoMode } from "@baret/web-ui/lib/check-types";
import { fill } from "@baret/web-ui/lib/util";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysisPanel, type PanelCopy } from "../AnalysisPanel.js";
import type { CheckState } from "../useCheck.js";
import { Analyzing } from "./Analyzing.js";
import { FindingCards } from "./FindingCards.js";
import { VerdictHero } from "./VerdictHero.js";

const copy: PanelCopy = {
  asks: "The site asks for an allowance.",
  call: "approve(spender, max)",
  expected: "blocked",
  expectedBody: "Two rules should fire.",
  claims: [{ claim: "Audited", check: "Not on chain" }],
  without: { title: "If this were signed", body: "The look-alike takes it all." },
  lesson: { title: "Lesson", body: "Approve the amount you sell." },
};

const blocked: CheckResult = {
  source: "live",
  verdict: "blocked",
  findings: [{ code: "APPROVAL_UNLIMITED", values: { spender: "0xabc", token: "dUSDC" } }],
  changes: [{ direction: "out", value: "1.00", unit: "MON" }],
  approvals: [],
};

function panel(state: CheckState, mode: DemoMode = "danger") {
  return render(
    <AnalysisPanel
      open
      onOpenChange={() => undefined}
      state={state}
      live
      mode={mode}
      copy={copy}
      onTryOther={() => undefined}
    />,
  );
}

describe("Analyzing", () => {
  it("has one stage per phase of the walk useCheck runs", () => {
    expect(analysisPanel.stages).toHaveLength(demoFrame.panel.phases.length);
  });

  it("ticks the stages before the current one and reports progress", () => {
    render(<Analyzing step={2} call="approve()" />);
    const bar = screen.getByRole("progressbar");
    expect(Number(bar.getAttribute("aria-valuenow"))).toBeGreaterThan(50);
    expect(screen.getByText(analysisPanel.stages[2]?.note ?? "")).toBeTruthy();
    // Only the active stage carries its note.
    expect(screen.queryByText(analysisPanel.stages[0]?.note ?? "")).toBeNull();
  });

  it("renders on the server with no window", () => {
    expect(renderToString(<Analyzing step={0} call="approve()" />)).toContain("approve()");
  });
});

describe("VerdictHero", () => {
  it("writes the word out and compares the live verdict with the expected one", () => {
    render(<VerdictHero kind="live" verdict="caution" line="Why." expected="blocked" />);
    expect(screen.getByRole("heading", { name: common.verdicts.caution.label })).toBeTruthy();
    expect(screen.getByText(analysisPanel.compare.mismatch)).toBeTruthy();
  });

  it("reads a capped expectation as Blocked", () => {
    render(<VerdictHero kind="live" verdict="blocked" line="Why." expected="capped" />);
    expect(screen.getByText(analysisPanel.compare.match)).toBeTruthy();
  });
});

describe("FindingCards", () => {
  it("says so when nothing fired", () => {
    render(<FindingCards items={[]} verdict="safe" />);
    expect(screen.getByText(demoFrame.panel.noFindings)).toBeTruthy();
  });
});

describe("AnalysisPanel", () => {
  it("shows the stages while checking", () => {
    panel({ phase: "checking", step: 1, result: null });
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("puts the verdict first, then the findings, and folds the call into details", () => {
    panel({ phase: "done", result: blocked });
    expect(screen.getByRole("status").textContent).toBe(common.verdicts.blocked.aria);
    expect(screen.getByRole("heading", { name: common.verdicts.blocked.label })).toBeTruthy();
    expect(screen.getByText(analysisPanel.compare.match)).toBeTruthy();
    expect(screen.getByText(copy.without.body)).toBeTruthy();
    const details = document.querySelector("details");
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain(copy.call);
  });

  it("fails closed: no answer reads Blocked, with the reason", () => {
    panel({
      phase: "done",
      result: { ...blocked, source: "failed", findings: [], changes: [] },
    });
    expect(screen.getByText(demoFrame.panel.failed.title)).toBeTruthy();
    expect(screen.getByRole("heading", { name: common.verdicts.blocked.label })).toBeTruthy();
  });

  it("leads a live answer with its own reason, not the prepared sentence", () => {
    panel({ phase: "done", result: blocked });
    const title = fill(findings.APPROVAL_UNLIMITED.title, blocked.findings[0]?.values ?? {});
    const hero = document.querySelector('[aria-labelledby="bp-verdict"]');
    expect(hero?.textContent).toContain(title);
    expect(hero?.textContent).not.toContain(copy.expectedBody);
  });

  it("keeps the prepared sentence on a sample answer", () => {
    panel({ phase: "done", result: { ...blocked, source: "sample" } });
    expect(screen.getByText(copy.expectedBody)).toBeTruthy();
  });

  it("shows the lesson on a risky answer", () => {
    panel({ phase: "done", result: blocked });
    expect(screen.getByText(copy.lesson.body)).toBeTruthy();
  });

  it("leaves the lesson out of an honest Safe answer", () => {
    panel({ phase: "done", result: { ...blocked, verdict: "safe", findings: [] } }, "safe");
    expect(screen.queryByText(copy.lesson.body)).toBeNull();
    expect(screen.getByText(common.verdicts.safe.line)).toBeTruthy();
  });
});
