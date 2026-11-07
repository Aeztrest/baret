import { describe, expect, it } from "vitest";
import { amount, announceCap, capProgress, capRun, capSentence, sampleLine } from "./capRun.js";

describe("capRun", () => {
  it("fits when the cap covers every payment", () => {
    expect(capRun(2, 20, 50)).toEqual({ kind: "fits", spent: 40 });
    expect(capRun(2, 20, 40)).toEqual({ kind: "fits", spent: 40 });
  });

  it("stops the first payment that would cross the cap", () => {
    expect(capRun(2, 20, 20)).toEqual({ kind: "capped", spent: 20, next: 22 });
    expect(capRun(2, 20, 10)).toEqual({ kind: "capped", spent: 10, next: 12 });
    expect(capRun(2, 20, 30)).toEqual({ kind: "capped", spent: 30, next: 32 });
  });

  it("rounds a cap that is not a multiple of the price down to whole payments", () => {
    expect(capRun(2, 20, 21)).toEqual({ kind: "capped", spent: 20, next: 22 });
    expect(capRun(2, 20, 1)).toEqual({ kind: "capped", spent: 0, next: 2 });
  });
});

describe("cap copy", () => {
  it("fills the daily-cap finding with the run numbers", () => {
    expect(capSentence(20)).toBe(
      "This payment of 2 USDC would bring the last 24 hours to 22 USDC. Your daily cap is 20 USDC.",
    );
  });

  it("says the run fits under a big enough cap", () => {
    expect(capSentence(50)).toBe("All 20 payments fit under this cap.");
    expect(announceCap(50)).toBe(capSentence(50));
  });

  it("announces the tag and the finding when capped", () => {
    expect(announceCap(10)).toBe(`Blocked at the cap. ${capSentence(10)}`);
  });

  it("leaves no placeholder unfilled", () => {
    for (const text of [sampleLine(), amount(30), capSentence(30), capSentence(50)]) {
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });

  it("says how far a capped run got, and nothing when it fits", () => {
    expect(capProgress(20)).toBe("10 of 20 paid.");
    expect(capProgress(30)).toBe("15 of 20 paid.");
    expect(capProgress(50)).toBeNull();
  });
});
