import { analyzeRequestSchema } from "@baret/core";
import { decodeFunctionData, getAddress, maxUint256 } from "viem";
import { describe, expect, it } from "vitest";
import {
  agentCalls,
  agentPayments,
  callRequest,
  claimhub,
  DEMO,
  DEMO_USDC_ABI,
  launchpad,
  NOVASWAP_ROUTER_ABI,
  novaswap,
  orbityield,
  paymentRequest,
  pixeldrop,
  quoteMonForUsdc,
  SITES_ABI,
  scrybe,
} from "./index.js";

const USER = "0x1111111111111111111111111111111111111111";

const addresses = (o: unknown): string[] =>
  typeof o === "string"
    ? /^0x[0-9a-fA-F]{40}$/.test(o)
      ? [o]
      : []
    : o && typeof o === "object"
      ? Object.values(o).flatMap(addresses)
      : [];

describe("addresses", () => {
  it("are all checksummed", () => {
    for (const a of addresses(DEMO)) expect(getAddress(a), a).toBe(a);
  });

  it("make the look-alike router start and end like the real one", () => {
    const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-3)}`.toLowerCase();
    expect(short(DEMO.novaswap.lookalike)).toBe(short(DEMO.novaswap.router));
    expect(DEMO.novaswap.lookalike.toLowerCase()).not.toBe(DEMO.novaswap.router.toLowerCase());
  });
});

describe("NovaSwap", () => {
  it("quotes at 3.2 dUSDC per MON", () => {
    expect(quoteMonForUsdc(10n ** 18n)).toBe(3_200_000n);
  });

  it("builds the honest swap with MON attached and the quote as the minimum", () => {
    const t = novaswap.swapMonForUsdc(USER, 10n ** 18n);
    expect(t).toMatchObject({ from: USER, to: DEMO.novaswap.router, value: "1000000000000000000" });
    expect(decodeFunctionData({ abi: NOVASWAP_ROUTER_ABI, data: t.data })).toEqual({
      functionName: "swapMonForUsdc",
      args: [3_200_000n],
    });
  });

  it("builds the attack as an unlimited allowance to the look-alike", () => {
    const t = novaswap.attackApprove(USER);
    expect(t.to).toBe(DEMO.novaswap.usdc);
    expect(decodeFunctionData({ abi: DEMO_USDC_ABI, data: t.data })).toEqual({
      functionName: "approve",
      args: [DEMO.novaswap.lookalike, maxUint256],
    });
  });

  it("builds the honest allowance for exactly the amount sold", () => {
    const call = decodeFunctionData({
      abi: DEMO_USDC_ABI,
      data: novaswap.approveExact(USER, 9_600_000n).data,
    });
    expect(call.args).toEqual([DEMO.novaswap.router, 9_600_000n]);
  });
});

describe("the other sites", () => {
  it("prices a mint and points the attack at the drainer", () => {
    const mint = pixeldrop.mint(USER, 3);
    expect(mint).toMatchObject({ to: DEMO.pixeldrop.collection, value: "30000000000000000" });
    expect(decodeFunctionData({ abi: SITES_ABI, data: mint.data }).args).toEqual([3n]);
    expect(
      decodeFunctionData({ abi: SITES_ABI, data: pixeldrop.attackApproveAll(USER).data }).args,
    ).toEqual([DEMO.drainer, true]);
  });

  it("sends the honest and the attack version of a site to different contracts", () => {
    expect(orbityield.stake(USER, 1n).to).toBe(DEMO.orbityield.pool);
    expect(orbityield.attackStake(USER, 1n).to).toBe(DEMO.orbityield.silentPool);
    expect(launchpad.contribute(USER, 1n).to).toBe(DEMO.launchpad.sale);
    expect(launchpad.attackContribute(USER, 1n).to).toBe(DEMO.launchpad.proxySale);
    expect(claimhub.claim(USER).to).toBe(DEMO.claimhub.distributor);
  });

  it("makes ClaimHub's attack an unlimited allowance on the real USDC", () => {
    const t = claimhub.attackApprove(USER);
    expect(t.to).toBe(DEMO.usdc);
    expect(decodeFunctionData({ abi: SITES_ABI, data: t.data }).args).toEqual([
      DEMO.drainer,
      maxUint256,
    ]);
  });
});

describe("analyze bodies", () => {
  // The EVM payload itself is checked by the adapter (chain-evm request.ts), which this
  // package may not import; the live check of every scenario is the end-to-end proof.
  const valid = (body: unknown) => analyzeRequestSchema.safeParse(body).success;

  it("are accepted by the v2 request schema", () => {
    for (const t of [
      novaswap.swapMonForUsdc(USER, 10n ** 18n),
      claimhub.attackApprove(USER),
      agentCalls.unlimitedAllowance(USER),
      agentCalls.operatorApproval(USER),
      agentCalls.flaggedAddress(USER),
    ]) {
      expect(valid(callRequest(t))).toBe(true);
    }
    for (const p of [
      scrybe.pay(USER),
      scrybe.pay(USER, 4),
      agentPayments.pay(USER),
      agentPayments.wrongPayee(USER),
      agentPayments.lookalikeToken(USER),
    ]) {
      expect(valid(paymentRequest(p))).toBe(true);
    }
  });

  it("carry one history entry per earlier payment, all inside the last hour", () => {
    const now = 1_800_000_000;
    const history = scrybe.pay(USER, 5, now).payment.spendHistory ?? [];
    expect(history).toHaveLength(5);
    for (const s of history) {
      expect(s.timestamp).toBeLessThan(now);
      expect(s.timestamp).toBeGreaterThan(now - 3600);
      expect(s.amount).toBe(DEMO.scrybe.price.toString());
      expect(s.asset).toBe(DEMO.usdcId);
    }
  });

  it("differ from the honest payment only where the action says", () => {
    const honest = agentPayments.pay(USER);
    expect(honest.typedData.message.to).toBe(honest.payment.requirements.payTo);
    const wrong = agentPayments.wrongPayee(USER);
    expect(wrong.typedData.message.to).toBe(DEMO.scrybe.otherWallet);
    expect(wrong.payment.requirements.payTo).toBe(DEMO.scrybe.payTo);
    const fake = agentPayments.lookalikeToken(USER);
    expect(fake.typedData.domain.verifyingContract).toBe(DEMO.fakeUsdc);
    expect(fake.payment.requirements.asset).toBe(DEMO.usdcId);
  });
});
