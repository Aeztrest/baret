import { claimhub, findings } from "@baret/content";
import { DEMO } from "@baret/demo-evm";
import { hasValues } from "@baret/web-ui/components/CheckBlocks";
import { decodeFunctionData, maxUint256, parseAbi } from "viem";
import { describe, expect, it, vi } from "vitest";
import { VIEWS } from "./Glyph.js";
import { isWallet, SAMPLE, sampleCheck, walletFor } from "./sample.js";
import { buildRequest, LIVE_VALUES, SOURCE } from "./source.js";

describe("ClaimHub eligibility", () => {
  it("checks the connected wallet when the field is empty, else the address typed", () => {
    expect(walletFor("", SAMPLE.wallet)).toBe(SAMPLE.wallet);
    expect(walletFor("  ", SAMPLE.wallet)).toBe(SAMPLE.wallet);
    expect(walletFor(` ${SAMPLE.spender} `, SAMPLE.wallet)).toBe(SAMPLE.spender);
  });

  it("refuses text that is not an address", () => {
    expect(walletFor("my-wallet.eth", SAMPLE.wallet)).toBeNull();
    expect(walletFor("0x1234", SAMPLE.wallet)).toBeNull();
    expect(isWallet(SAMPLE.distributor)).toBe(true);
  });
});

describe("ClaimHub sample", () => {
  it("passes the honest claim: Safe, HUB in and nothing out", () => {
    expect(sampleCheck("safe")).toEqual({
      source: "sample",
      verdict: "safe",
      findings: [],
      changes: [{ direction: "in", value: "2,410", unit: "HUB" }],
      approvals: [],
    });
  });

  it("blocks the attack twice: an unlimited USDC allowance to a listed spender", () => {
    const result = sampleCheck("danger");
    expect(result.verdict).toBe("blocked");
    expect(result.findings.map((f) => f.code)).toEqual([
      "APPROVAL_UNLIMITED",
      "KNOWN_MALICIOUS_ADDRESS",
    ]);
    for (const finding of result.findings) {
      expect(hasValues(findings[finding.code].body, finding.values)).toBe(true);
    }
    expect(result.changes).toEqual([]);
    expect(result.approvals).toEqual([
      { unit: "USDC", spender: SAMPLE.spender, unlimited: true, amount: null },
    ]);
  });

  it("answers from the sample", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await SOURCE(
      { mode: "danger", wallet: SAMPLE.wallet, from: null },
      new AbortController().signal,
    );
    expect(result).toEqual(sampleCheck("danger"));
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("ClaimHub pages", () => {
  it("has one page per nav item after the first, in nav order", () => {
    expect(claimhub.site.nav).toHaveLength(VIEWS.length);
    expect(claimhub.site.pages.views.map((v) => v.id)).toEqual(VIEWS.slice(1));
  });
});

describe("ClaimHub live request", () => {
  const from = "0x1111111111111111111111111111111111111111" as const;
  const abi = parseAbi([
    "function claim()",
    "function approve(address spender, uint256 amount) returns (bool)",
  ]);

  it("claims from the listed distributor when honest", () => {
    const call = buildRequest("safe", from);
    expect(call.from).toBe(from);
    expect(call.to).toBe(DEMO.claimhub.distributor);
    expect(call.value).toBe("0");
    expect(decodeFunctionData({ abi, data: call.data as `0x${string}` }).functionName).toBe(
      "claim",
    );
  });

  it("asks for an unlimited USDC allowance to the drainer in the attack", () => {
    const call = buildRequest("danger", from);
    expect(call.to).toBe(DEMO.usdc);
    const decoded = decodeFunctionData({ abi, data: call.data as `0x${string}` });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([DEMO.drainer, maxUint256]);
    expect(LIVE_VALUES).toEqual({ contract: DEMO.claimhub.distributor, spender: DEMO.drainer });
  });
});
