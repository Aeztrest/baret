import { FAILED, runCheck } from "@baret/web-ui/lib/check";
import type { CheckResult } from "@baret/web-ui/lib/check-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { advance, type CheckState, settle } from "./useCheck.js";

const SAFE: CheckResult = {
  source: "sample",
  verdict: "safe",
  findings: [],
  changes: [],
  approvals: [],
};

afterEach(() => {
  vi.useRealTimers();
});

describe("panel phases", () => {
  const checking = (step: number, result: CheckResult | null = null): CheckState => ({
    phase: "checking",
    step,
    result,
  });

  it("walks every phase, then waits on the last one until the answer is in", () => {
    expect(advance(checking(0), 4)).toEqual(checking(1));
    const waiting = checking(3);
    expect(advance(waiting, 4)).toBe(waiting);
    expect(settle(waiting, SAFE, 4)).toEqual({ phase: "done", result: SAFE });
  });

  it("holds a fast answer until the walk is over", () => {
    const early = settle(checking(1), SAFE, 4);
    expect(early).toEqual(checking(1, SAFE));
    expect(advance(advance(early, 4), 4)).toEqual(checking(3, SAFE));
    expect(advance(checking(3, SAFE), 4)).toEqual({ phase: "done", result: SAFE });
  });

  it("ignores ticks and answers outside a check", () => {
    const idle: CheckState = { phase: "idle" };
    expect(advance(idle, 4)).toBe(idle);
    expect(settle(idle, SAFE, 4)).toBe(idle);
  });
});

describe("runCheck fails closed", () => {
  it("passes an answer through", async () => {
    await expect(runCheck(async () => SAFE, null, new AbortController())).resolves.toBe(SAFE);
  });

  it("turns a rejection into Blocked", async () => {
    const result = await runCheck(
      async () => {
        throw new Error("offline");
      },
      null,
      new AbortController(),
    );
    expect(result).toBe(FAILED);
    expect(result.verdict).toBe("blocked");
  });

  it("turns a source that never answers into Blocked, and aborts it", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = runCheck(() => new Promise<CheckResult>(() => {}), null, controller, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBe(FAILED);
    expect(controller.signal.aborted).toBe(true);
  });
});
