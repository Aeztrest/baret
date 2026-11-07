import { DEMO_USDC_ABI, NOVASWAP, novaswap } from "@baret/demo-evm";
import { decodeFunctionData, maxUint256, parseEther } from "viem";
import { describe, expect, it } from "vitest";
import { toUnits, toWei } from "../kit/amount.js";
import { SAMPLE } from "./sample.js";
import { buildRequest, faucetCall, signCalls } from "./source.js";

const from = SAMPLE.wallet;
const wei = parseEther("2");
const units = 20_000_000n;

describe("NovaSwap sign calls", () => {
  it("signs the honest swap the panel checks, and nothing else", () => {
    const calls = signCalls("safe", wei, units, from);
    expect(calls).toEqual([buildRequest("safe", wei, from)]);
    expect(calls[0]?.to).toBe(NOVASWAP.router);
    expect(calls[0]?.value).toBe(wei.toString());
  });

  it("signs the attack's approval the panel checks, then the look-alike's swap", () => {
    const [approve, swap, ...rest] = signCalls("danger", wei, units, from);
    expect(rest).toEqual([]);
    expect(approve).toEqual(buildRequest("danger", wei, from));
    expect(approve?.to).toBe(NOVASWAP.usdc);
    const decoded = decodeFunctionData({ abi: DEMO_USDC_ABI, data: approve?.data ?? "0x" });
    expect(decoded).toEqual({ functionName: "approve", args: [NOVASWAP.lookalike, maxUint256] });
    expect(swap?.to).toBe(NOVASWAP.lookalike);
    expect(swap?.data).toBe(novaswap.attackSwap(from, units).data);
  });

  it("takes test dUSDC from the dUSDC contract", () => {
    expect(faucetCall(from).to).toBe(NOVASWAP.usdc);
  });
});

describe("toUnits", () => {
  it("reads plain digits with a dot or a comma", () => {
    expect(toUnits("20", 6)).toBe(20_000_000n);
    expect(toUnits("1,5", 6)).toBe(1_500_000n);
  });

  it("refuses more decimals than the token has, exponents, hex, signs and zero", () => {
    for (const raw of ["0.0000001", "1e3", "0x10", "-1", "0", ""])
      expect(toUnits(raw, 6)).toBeNull();
  });

  it("leaves toWei as it was", () => {
    expect(toWei("2.5")).toBe(2_500_000_000_000_000_000n);
  });
});
