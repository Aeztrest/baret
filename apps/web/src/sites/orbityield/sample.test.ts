import { findings, orbityield } from "@baret/content";
import { DEMO } from "@baret/demo-evm";
import { hasValues } from "@baret/web-ui/components/CheckBlocks";
import { decodeFunctionData, parseAbi } from "viem";
import { describe, expect, it } from "vitest";
import { format, LOSS_LIMIT, parseAmount, percent, toWei } from "../kit/amount.js";
import { VIEWS } from "./Glyph.js";
import { overLimit, poolOf, SAMPLE, sampleCheck } from "./sample.js";
import { buildRequest, livePoolOf, overLimitLive, SOURCE } from "./source.js";

describe("the amount on a demo card", () => {
  it("reads dots, commas and spaces, and refuses anything that is not positive", () => {
    expect(parseAmount("2.5")).toBe(2.5);
    expect(parseAmount(" 12,5 ")).toBe(12.5);
    for (const raw of ["", " ", "0", "-1", "abc", "1e400"]) expect(parseAmount(raw)).toBeNull();
  });

  it("prints percentages with at most one decimal", () => {
    expect(percent(60)).toBe("60%");
    expect(percent(50.4)).toBe("50.4%");
    expect(percent(LOSS_LIMIT)).toBe("50%");
  });
});

describe("OrbitYield sample", () => {
  it("passes the honest stake: Safe, MON out and the same oMON in", () => {
    expect(sampleCheck("safe", 5)).toEqual({
      source: "sample",
      verdict: "safe",
      findings: [],
      changes: [
        { direction: "out", value: "5.00", unit: "MON" },
        { direction: "in", value: "5.00", unit: "oMON" },
      ],
      approvals: [],
    });
  });

  it("blocks the attack at any size: an unknown pool keeps the MON and sends nothing back", () => {
    const result = sampleCheck("danger", 5);
    expect(result.verdict).toBe("blocked");
    expect(result.findings).toEqual([
      { code: "UNKNOWN_CONTRACT_EXPOSURE", values: { contract: SAMPLE.other } },
      {
        code: "VALUE_KEPT_BY_UNKNOWN_CONTRACT",
        values: { contract: SAMPLE.other, amount: format(5), asset: "MON" },
      },
    ]);
    for (const finding of result.findings) {
      expect(hasValues(findings[finding.code].body, finding.values)).toBe(true);
    }
    expect(result.changes).toEqual([{ direction: "out", value: format(5), unit: "MON" }]);
  });

  it("adds the loss finding above the loss limit, with the share it would cost", () => {
    expect(overLimit("danger", 12.5)).toBe(false);
    expect(overLimit("danger", 15)).toBe(true);
    expect(overLimit("safe", 20)).toBe(false);
    const result = sampleCheck("danger", 15);
    expect(result.verdict).toBe("blocked");
    expect(result.findings.at(-1)).toEqual({
      code: "ESTIMATED_LOSS_EXCEEDS_MAX",
      values: { actual: "60%", limit: "50%" },
    });
    for (const finding of result.findings) {
      expect(hasValues(findings[finding.code].body, finding.values)).toBe(true);
    }
  });

  it("calls the pool Baret knows when honest and the other one in the attack", () => {
    expect(poolOf("safe")).toBe(SAMPLE.pool);
    expect(poolOf("danger")).toBe(SAMPLE.other);
  });

  it("answers from the sample", async () => {
    const result = await SOURCE(
      { mode: "danger", amount: 5, wei: 5n * 10n ** 18n, from: null },
      new AbortController().signal,
    );
    expect(result).toEqual(sampleCheck("danger", 5));
  });
});

describe("OrbitYield pages", () => {
  it("has one page per nav item after the first, in nav order", () => {
    expect(orbityield.site.nav).toHaveLength(VIEWS.length);
    expect(orbityield.site.pages.views.map((v) => v.id)).toEqual(VIEWS.slice(1));
  });
});

describe("OrbitYield live request", () => {
  const from = "0x1111111111111111111111111111111111111111" as const;
  const abi = parseAbi(["function stake() payable"]);
  const mon = 10n ** 18n;

  it("stakes in the listed pool when honest and the silent pool in the attack", () => {
    const honest = buildRequest("safe", 2n * mon, from);
    const attack = buildRequest("danger", 2n * mon, from);
    expect(honest.to).toBe(DEMO.orbityield.pool);
    expect(attack.to).toBe(DEMO.orbityield.silentPool);
    for (const call of [honest, attack]) {
      expect(call.value).toBe((2n * mon).toString());
      expect(decodeFunctionData({ abi, data: call.data as `0x${string}` }).functionName).toBe(
        "stake",
      );
    }
    expect(livePoolOf("danger")).toBe(DEMO.orbityield.silentPool);
  });

  it("expects Blocked only when the attack's deposit is over the loss limit of the real balance", () => {
    const limit = BigInt(Math.round(LOSS_LIMIT));
    const balance = 10n * mon;
    const atLimit = (balance * limit) / 100n;
    expect(overLimitLive("danger", atLimit, balance)).toBe(false);
    expect(overLimitLive("danger", atLimit + 1n, balance)).toBe(true);
    expect(overLimitLive("safe", balance, balance)).toBe(false);
    expect(overLimitLive("danger", balance, null)).toBe(false);
  });

  it("reads plain decimal MON into wei and refuses exponents, hex and signs", () => {
    expect(toWei("2.5")).toBe(25n * 10n ** 17n);
    expect(toWei("2,5")).toBe(25n * 10n ** 17n);
    expect(toWei(" 0.000000000000000001 ")).toBe(1n);
    for (const bad of ["", "0", "1e3", "0x10", "-1", "1.0000000000000000001", "abc"]) {
      expect(toWei(bad)).toBeNull();
    }
  });
});
