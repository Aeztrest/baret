import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { looksAlike } from "./lookalike.js";

const a = (s: string) => getAddress(s);

describe("looksAlike", () => {
  it("matches the NovaSwap drainer ground to look like the router", () => {
    // 0xEB9E...1888 against 0xeB9E...3888: four characters in front, three behind.
    expect(
      looksAlike(
        a("0xEB9EA352613D8545d70a586C112C30D23D5C1888"),
        a("0xeB9EBB97BcD146FF1a4424490cbE8e19b7983888"),
      ),
    ).toBe(true);
  });

  it("matches four and four, whatever the case", () => {
    expect(
      looksAlike(
        a("0xabcd000000000000000000000000000000001234"),
        a("0xABCDffffffffffffffffffffffffffffffff1234"),
      ),
    ).toBe(true);
  });

  it("does not match an address with itself", () => {
    const x = a("0xabcd000000000000000000000000000000001234");
    expect(looksAlike(x, x)).toBe(false);
  });

  it("needs both ends and seven characters in all", () => {
    // Three and three: too common to mean anything.
    expect(
      looksAlike(
        a("0xabc0000000000000000000000000000000000123"),
        a("0xabcfffffffffffffffffffffffffffffffff9123"),
      ),
    ).toBe(false);
    // A long match at one end only.
    expect(
      looksAlike(
        a("0xabcdef0000000000000000000000000000000001"),
        a("0xabcdefffffffffffffffffffffffffffffffff02"),
      ),
    ).toBe(false);
  });

  it("does not match unrelated addresses", () => {
    expect(
      looksAlike(
        a("0x534b2f3A21130d7a60830c2Df862319e593943A3"),
        a("0x5BB6fF1FCbE31ED8FBce6805852Ce279475522fc"),
      ),
    ).toBe(false);
  });
});
