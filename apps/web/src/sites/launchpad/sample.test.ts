import { findings, launchpad } from "@baret/content";
import { DEMO } from "@baret/demo-evm";
import { hasValues } from "@baret/web-ui/components/CheckBlocks";
import { decodeFunctionData, parseAbi } from "viem";
import { describe, expect, it } from "vitest";
import { VIEWS } from "./Glyph.js";
import { limitOf, SAMPLE, saleOf, sampleCheck, tokensFor } from "./sample.js";
import { buildRequest, liveSaleOf, SOURCE } from "./source.js";

describe("LaunchPad contribution", () => {
  it("buys LNTL at 0.001 MON each, grouped", () => {
    expect(tokensFor(0.5)).toBe("500");
    expect(tokensFor(1)).toBe("1,000");
    expect(tokensFor(0.01)).toBe("10");
  });

  it("keeps a contribution between the sale's minimum and maximum", () => {
    expect(limitOf(0.005)).toBe("tooLow");
    expect(limitOf(1.5)).toBe("tooHigh");
    expect(limitOf(SAMPLE.min)).toBeNull();
    expect(limitOf(SAMPLE.max)).toBeNull();
  });
});

describe("LaunchPad sample", () => {
  it("passes the honest sale: Safe, MON out and LNTL in", () => {
    expect(sampleCheck("safe", 0.5)).toEqual({
      source: "sample",
      verdict: "safe",
      findings: [],
      changes: [
        { direction: "out", value: "0.50", unit: "MON" },
        { direction: "in", value: "500", unit: "LNTL" },
      ],
      approvals: [],
    });
  });

  it("blocks the attack: borrowed code in a sale Baret does not know, LNTL still in", () => {
    const result = sampleCheck("danger", 0.5);
    expect(result.verdict).toBe("blocked");
    expect(result.findings.map((f) => f.code)).toEqual([
      "DELEGATECALL_DETECTED",
      "UNKNOWN_CONTRACT_EXPOSURE",
    ]);
    for (const finding of result.findings) {
      expect(hasValues(findings[finding.code].body, finding.values)).toBe(true);
    }
    expect(result.changes).toEqual(sampleCheck("safe", 0.5).changes);
  });

  it("pays the plain sale when honest and the proxy in the attack", () => {
    expect(saleOf("safe")).toBe(SAMPLE.sale);
    expect(saleOf("danger")).toBe(SAMPLE.proxy);
  });

  it("answers from the sample", async () => {
    const result = await SOURCE(
      { mode: "danger", amount: 1, wei: 10n ** 18n, from: null },
      new AbortController().signal,
    );
    expect(result).toEqual(sampleCheck("danger", 1));
  });
});

describe("LaunchPad pages", () => {
  it("has one page per nav item after the first, in nav order", () => {
    expect(launchpad.site.nav).toHaveLength(VIEWS.length);
    expect(launchpad.site.pages.views.map((v) => v.id)).toEqual(VIEWS.slice(1));
  });

  it("splits the supply into shares that add up to 100", () => {
    const tokenomics = launchpad.site.pages.views.find((v) => v.id === "tokenomics");
    const total =
      tokenomics?.kind === "shares" ? tokenomics.items.reduce((sum, i) => sum + i.value, 0) : 0;
    expect(total).toBe(100);
  });
});

describe("LaunchPad live request", () => {
  const from = "0x1111111111111111111111111111111111111111" as const;
  const abi = parseAbi(["function contribute() payable"]);
  const wei = 5n * 10n ** 17n;

  it("pays the plain sale when honest and the proxy sale in the attack, the same call", () => {
    const honest = buildRequest("safe", wei, from);
    const attack = buildRequest("danger", wei, from);
    expect(honest.to).toBe(DEMO.launchpad.sale);
    expect(attack.to).toBe(DEMO.launchpad.proxySale);
    for (const call of [honest, attack]) {
      expect(call.from).toBe(from);
      expect(call.value).toBe(wei.toString());
      expect(decodeFunctionData({ abi, data: call.data as `0x${string}` }).functionName).toBe(
        "contribute",
      );
    }
    expect(liveSaleOf("safe")).toBe(DEMO.launchpad.sale);
    expect(liveSaleOf("danger")).toBe(DEMO.launchpad.proxySale);
  });
});
