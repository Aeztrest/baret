import { describe, expect, it } from "vitest";
import { format } from "./useCountUp.js";

describe("count-up figures", () => {
  it("keep the value's decimals", () => {
    expect(format(1.5, "12.48")).toBe("1.50");
    expect(format(7, "40")).toBe("7");
  });

  it("keep thousands commas when the value has them", () => {
    expect(format(1234.5, "1,240.50")).toBe("1,234.50");
    expect(format(999, "1,240")).toBe("999");
    expect(format(1000000, "2,000,000")).toBe("1,000,000");
  });
});
