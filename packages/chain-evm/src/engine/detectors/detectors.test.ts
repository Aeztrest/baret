import { getChain, policyContext } from "@baret/chains";
import { type ChainConfig, createPolicy, type GuardPolicy } from "@baret/core";
import { type Address, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import type { EvmContext } from "../analysis/context.js";
import type { TransferEffect } from "../analysis/effects.js";
import { compute } from "./compute.js";
import { evmDanger } from "./evm-danger.js";
import { runDetectors } from "./index.js";
import { policyFindings } from "./policy-rules.js";
import { reputation } from "./reputation.js";
import { x402 } from "./x402.js";

const chain = getChain("eip155:10143") as ChainConfig;
const USDC = getAddress("0x534b2f3A21130d7a60830c2Df862319e593943A3");
const USDC_ID = `eip155:10143/erc20:${USDC}`;
const USER = getAddress("0x00000000000000000000000000000000000000a1");
const SHOP = getAddress("0x00000000000000000000000000000000000000b2");
const OTHER = getAddress("0x00000000000000000000000000000000000000c3");
const MON = 10n ** 18n;

/** A context with nothing in it; tests add what they need. Balanced policy for Monad testnet. */
function ctx(over: Partial<EvmContext> = {}, policy?: GuardPolicy): EvmContext {
  return {
    network: {
      chain,
      chainId: 10143,
      usdcAddress: USDC,
      knownContracts: [],
      paymentGuardFactoryAddress: null,
      cleanverse: null,
    },
    policy: policy ?? createPolicy("balanced", policyContext(chain)),
    now: 1_800_000_000,
    user: USER,
    tx: null,
    simulation: {
      ran: true,
      ok: true,
      revertReason: null,
      revertData: null,
      traced: true,
      gasLimit: 21_000n,
    },
    trace: null,
    effects: {
      approvals: [],
      transfers: [],
      ownership: [],
      paidAddresses: [],
      operationCount: 1,
      source: "trace",
    },
    delegateCalls: [],
    selfdestructs: [],
    contracts: [],
    codeless: [],
    counterparties: [],
    recipients: [],
    tokens: new Map([[USDC, { symbol: "USDC", decimals: 6 }]]),
    balancesBefore: { native: 5n * MON, tokens: new Map([[USDC, 100_000_000n]]) },
    feeWei: 0n,
    reputation: { status: "ok", data: new Map() },
    registry: { status: "ok", data: new Map() },
    compliance: { status: "skipped", data: null },
    gatedAssets: [],
    payment: null,
    ...over,
  };
}

const usdcOut = (amount: bigint, to = SHOP): TransferEffect => ({
  token: USDC,
  from: USER,
  to,
  amount,
  nft: false,
});
const effectsWith = (transfers: TransferEffect[]): EvmContext["effects"] => ({
  approvals: [],
  transfers,
  ownership: [],
  paidAddresses: [],
  operationCount: 1,
  source: "trace",
});
const payment = (amount: string, spendHistory?: { amount: string; timestamp: number }[]) => ({
  origin: "https://shop.example",
  requirements: {
    scheme: "exact",
    network: "eip155:10143",
    payTo: SHOP,
    asset: USDC_ID,
    amount,
  },
  ...(spendHistory ? { spendHistory: spendHistory.map((s) => ({ ...s, asset: USDC_ID })) } : {}),
});
const codes = (drafts: { code: string }[]) => drafts.map((d) => d.code);

describe("an empty request", () => {
  it("produces no findings under Balanced", () => {
    expect(runDetectors(ctx())).toEqual([]);
  });
});

describe("x402 caps are per asset, in base units", () => {
  it("passes a payment inside the Balanced caps (5 / 25 / 100 USDC)", () => {
    const c = ctx({
      effects: effectsWith([usdcOut(1_000_000n)]),
      payment: payment("1000000", []),
    });
    expect(codes([...x402(c), ...policyFindings(c)])).toEqual([]);
  });

  it("stops a payment over the per-payment cap, with amounts in USDC", () => {
    const c = ctx({
      effects: effectsWith([usdcOut(6_000_000n)]),
      payment: payment("6000000", []),
    });
    const f = policyFindings(c).find((d) => d.code === "X402_PER_TX_CAP_EXCEEDED");
    expect(f?.values).toMatchObject({ actual: "6", cap: "5" });
    expect(f?.rule).toBe("core.x402.caps");
  });

  it("counts the last hour's payments in the same asset", () => {
    const c = ctx({
      effects: effectsWith([usdcOut(4_000_000n)]),
      payment: payment("4000000", [{ amount: "22000000", timestamp: 1_800_000_000 - 60 }]),
    });
    expect(codes(policyFindings(c))).toContain("X402_HOURLY_CAP_EXCEEDED");
  });

  it("fails closed without spend history when a window cap is set", () => {
    const c = ctx({ effects: effectsWith([usdcOut(1n)]), payment: payment("1") });
    expect(codes(policyFindings(c))).toEqual(["X402_SPEND_HISTORY_UNAVAILABLE"]);
  });
});

describe("x402 shape", () => {
  it("flags an overpayment, but not an underpayment", () => {
    const over = ctx({
      effects: effectsWith([usdcOut(2_000_000n)]),
      payment: payment("1000000", []),
    });
    expect(codes(x402(over))).toContain("X402_AMOUNT_MISMATCH");
    const under = ctx({
      effects: effectsWith([usdcOut(500_000n)]),
      payment: payment("1000000", []),
    });
    expect(codes(x402(under))).not.toContain("X402_AMOUNT_MISMATCH");
  });

  it("flags a 402 for another network and a payment to someone else", () => {
    const p = payment("1000000", []);
    const c = ctx({
      effects: effectsWith([usdcOut(1_000_000n, OTHER)]),
      payment: { ...p, requirements: { ...p.requirements, network: "eip155:1" } },
    });
    expect(codes(x402(c))).toEqual(
      expect.arrayContaining(["X402_NETWORK_MISMATCH", "X402_DESTINATION_MISMATCH"]),
    );
  });

  it("refuses to judge a 402 whose asset is not on this chain", () => {
    const p = payment("1", []);
    const c = ctx({
      payment: { ...p, requirements: { ...p.requirements, asset: "stellar:pubnet/sep41:CABC" } },
    });
    expect(codes(x402(c))).toContain("X402_SHAPE_INVALID");
  });
});

describe("balance floors use the chain's native coin", () => {
  it("Balanced keeps 0.1 MON on Monad testnet: sending 4.95 of 5 breaks it", () => {
    const c = ctx({
      tx: { from: USER, to: SHOP, value: 495n * 10n ** 16n, data: "0x", gas: 21000n, gasPrice: 1n },
      effects: effectsWith([
        { token: null, from: USER, to: SHOP, amount: 495n * 10n ** 16n, nft: false },
      ]),
    });
    const f = policyFindings(c).find((d) => d.code === "POST_BALANCE_TOO_LOW");
    expect(f?.values).toMatchObject({ asset: "MON", limit: "0.1" });
  });
});

describe("fees", () => {
  it("reports the gas-limit rule and the native fee rule as EXCESSIVE_FEE", () => {
    const policy = createPolicy("strict", policyContext(chain));
    policy.core.maxFee = "1000";
    const c = ctx(
      {
        simulation: { ...ctx().simulation, gasLimit: 3_000_000n },
        feeWei: 2000n,
      },
      policy,
    );
    expect(compute(c).map((d) => d.rule)).toEqual(["evm.maxGas", "core.maxFee"]);
  });
});

describe("reputation", () => {
  const rated = (trustLevel: "new" | "known" | "trusted") =>
    ctx(
      {
        counterparties: [SHOP],
        reputation: {
          status: "ok",
          data: new Map<Address, never>([
            [SHOP, { trustLevel, flagged: false, freshWallet: false, whale: false } as never],
          ]),
        },
      },
      createPolicy("strict", policyContext(chain)),
    );

  it("Strict asks for at least `known`", () => {
    expect(codes(reputation(rated("new")))).toEqual(["REPUTATION_TRUST_BELOW_MINIMUM"]);
    expect(codes(reputation(rated("known")))).toEqual([]);
  });

  it("fails closed when the provider a rule needs is down", () => {
    const c = ctx(
      { reputation: { status: "unavailable", data: null } },
      createPolicy("strict", policyContext(chain)),
    );
    expect(reputation(c)[0]).toMatchObject({
      code: "REPUTATION_DATA_UNAVAILABLE",
      rule: "core.minReputationTrust",
    });
  });
});

describe("unified codes", () => {
  it("an ownership handover is AUTHORITY_CHANGE", () => {
    const c = ctx({
      effects: { ...ctx().effects, ownership: [{ contract: OTHER, newOwner: SHOP }] },
    });
    expect(evmDanger(c)).toEqual([
      {
        code: "AUTHORITY_CHANGE",
        values: { contract: OTHER, recipient: SHOP },
        details: { kind: "owner-transfer" },
      },
    ]);
  });
});
