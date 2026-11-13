import { describe, expect, it } from "vitest";
import { gate, humanAnswerSource, isYes } from "./gate.js";

describe("gate", () => {
  it("signs only when every verdict is Safe", () => {
    expect(gate(["safe"])).toBe("sign");
    expect(gate(["safe", "safe"])).toBe("sign");
  });

  it("asks a human on Caution", () => {
    expect(gate(["caution"])).toBe("ask");
    expect(gate(["safe", "caution"])).toBe("ask");
  });

  it("refuses on Blocked, even next to Caution", () => {
    expect(gate(["blocked"])).toBe("refuse");
    expect(gate(["caution", "blocked"])).toBe("refuse");
  });

  it("fails closed when Baret gave no verdict or an unknown one", () => {
    expect(gate([null])).toBe("refuse");
    expect(gate(["safe", null])).toBe("refuse");
    expect(gate(["allow"])).toBe("refuse");
    expect(gate([])).toBe("refuse");
  });
});

describe("humanAnswerSource", () => {
  it("asks in a terminal, answers no when nobody is there", () => {
    expect(humanAnswerSource([], true)).toBe("ask");
    expect(humanAnswerSource([], false)).toBe("nobody");
  });

  it("takes a recorded answer, and --deny wins over --approve", () => {
    expect(humanAnswerSource(["--approve"], false)).toBe("approve");
    expect(humanAnswerSource(["--deny"], true)).toBe("deny");
    expect(humanAnswerSource(["--approve", "--deny"], true)).toBe("deny");
  });
});

describe("isYes", () => {
  it("accepts only an explicit yes", () => {
    for (const y of ["y", "Y", "yes", " YES "]) expect(isYes(y)).toBe(true);
    for (const n of ["", "n", "no", "yes please", "sure", "1"]) expect(isYes(n)).toBe(false);
  });
});
