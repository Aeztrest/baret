/**
 * Metropolis parity (TASKS.md T1.6): Baret-Metropolis's end-to-end analysis tests
 * (apps/server/src/application/analyze.test.ts), run against the NEW engine through the
 * v1 ↔ v2 layer in ./metropolis-v1.ts. Assertions are Metropolis's own. Every change to
 * them is marked "PARITY:" with the reason.
 */

import type { CallParams } from "@baret/chain-evm/engine";
import {
  EIP1967_IMPLEMENTATION_SLOT,
  KNOWN_FUNCTIONS,
  ZOS_IMPLEMENTATION_SLOT,
} from "@baret/chain-evm/engine";
import { type Address, getAddress, pad, serializeTransaction, toFunctionSelector } from "viem";
import { afterAll, describe, expect, it } from "vitest";
import {
  approvalLog,
  approveData,
  calldata,
  cleanSources,
  config,
  DAPP,
  DRAINER,
  deps,
  FAKE_USDC,
  FakeRpc,
  frame,
  IMPL,
  implSlotValue,
  log,
  maxUint256,
  NFT,
  NOW,
  network,
  ONE_MON,
  ONE_USDC,
  PEER,
  policy,
  SHOP,
  type V1Sources as Sources,
  transferLog,
  tx,
  USDC,
  USER,
} from "./metropolis-fake.js";
import {
  type V1Request as AnalyzeRequest,
  type V1Response as AnalyzeResponse,
  analyze,
  analyzeRequestSchema,
  FINDING_CODES,
} from "./metropolis-v1.js";

const emitted = new Set<string>();

async function run(
  req: AnalyzeRequest,
  rpc = new FakeRpc(),
  sources: Sources = cleanSources(),
): Promise<AnalyzeResponse> {
  const res = await analyze(req, deps(rpc, sources));
  for (const f of res.findings) emitted.add(f.code);
  return res;
}

const codes = (r: AnalyzeResponse) => r.findings.map((f) => f.code);

const sendMon = (to: string, value: bigint) => frame({ to, value: `0x${value.toString(16)}` });

describe("simulation", () => {
  it("passes a plain MON transfer to a known wallet", async () => {
    const rpc = new FakeRpc();
    rpc.frame = sendMon(PEER, ONE_MON);
    const r = await run(tx({ to: PEER, value: ONE_MON.toString() }), rpc);
    expect(r.decision).toBe("safe");
    expect(r.confidence).toBe("high");
    const mon = r.estimatedChanges.find((c) => c.asset.kind === "native");
    // One MON plus the fee for the whole gas limit (50k gas at 100 gwei).
    expect(mon?.delta).toBe((-(ONE_MON + 50_000n * 100n * 10n ** 9n)).toString());
  });

  // PARITY: the /v1/explain test (sent amount and fee kept apart) waits for T2.7.

  it("blocks a request that would revert", async () => {
    const rpc = new FakeRpc();
    rpc.outcome = { ok: false, revertReason: "insufficient balance", revertData: null };
    const r = await run(tx({ to: PEER, value: "1" }), rpc);
    expect(r.decision).toBe("blocked");
    expect(r.firedRules).toContainEqual(
      expect.objectContaining({ rule: "requireSuccessfulSimulation", code: "SIMULATION_FAILED" }),
    );
    expect(r.confidence).toBe("low");
  });

  it("does not add unmeasurable-loss findings to a request that would revert", async () => {
    const rpc = new FakeRpc();
    rpc.outcome = { ok: false, revertReason: "ExceedsPerTxCap", revertData: null };
    rpc.estimate = null; // a revert has no gas estimate, so the fee is unknown
    const r = await run(tx({ to: PEER, value: "1" }), rpc);
    expect(codes(r)).toEqual(["SIMULATION_FAILED"]);
  });

  it("names the vault's own error when a payment reverts on a cap", async () => {
    const rpc = new FakeRpc();
    rpc.outcome = {
      ok: false,
      revertReason: "Execution reverted for an unknown reason.",
      revertData: toFunctionSelector("ExceedsPerTxCap()"),
    };
    rpc.estimate = null;
    const r = await run(tx({ to: PEER, value: "1" }), rpc);
    expect(r.findings.find((f) => f.code === "SIMULATION_FAILED")?.details).toEqual({
      revertReason: "The amount is over this merchant's cap per payment.",
      revertError: "ExceedsPerTxCap",
    });
  });

  it("keeps the node's sentence for an error it cannot read", async () => {
    const rpc = new FakeRpc();
    rpc.outcome = { ok: false, revertReason: "Execution reverted.", revertData: "0xdeadbeef" };
    rpc.estimate = null;
    const r = await run(tx({ to: PEER, value: "1" }), rpc);
    expect(r.findings.find((f) => f.code === "SIMULATION_FAILED")?.details).toEqual({
      revertReason: "Execution reverted.",
    });
  });

  it("says when there is no trace", async () => {
    const r = await run(tx({ to: PEER, value: "1" }));
    expect(codes(r)).toContain("LOW_CONFIDENCE_INCOMPLETE_DATA");
    expect(r.decision).toBe("caution");
    expect(r.meta.traced).toBe(false);
  });

  it("rejects a request for another chain", async () => {
    await expect(analyze({ ...tx(), network: "mainnet" }, deps(new FakeRpc()))).rejects.toThrow(
      /does not serve/,
    );
  });
});

describe("approvals", () => {
  it.each([
    ["2^255 - 1", 2n ** 255n - 1n],
    ["2^128", 2n ** 128n],
    ["the largest uint96", 2n ** 96n - 1n],
  ])("reads an allowance of %s as unlimited", async (_name, amount) => {
    const rpc = new FakeRpc();
    rpc.code.set(USDC, "0x60");
    rpc.frame = frame({
      to: USDC,
      input: approveData(DAPP, amount),
      logs: [approvalLog(USDC, USER, DAPP, amount)],
    });
    const r = await run(tx({ to: USDC, data: approveData(DAPP, amount) }), rpc);
    expect(r.decision).toBe("blocked");
    expect(r.findings.map((f) => f.code)).toContain("ERC20_APPROVAL_UNLIMITED");
    expect(r.approvals[0]).toMatchObject({ unlimited: true });
  });

  it("keeps a large bounded allowance bounded", async () => {
    const amount = 1_000_000_000n * ONE_USDC;
    const rpc = new FakeRpc();
    rpc.code.set(USDC, "0x60");
    rpc.frame = frame({
      to: USDC,
      input: approveData(DAPP, amount),
      logs: [approvalLog(USDC, USER, DAPP, amount)],
    });
    const r = await run(tx({ to: USDC, data: approveData(DAPP, amount) }), rpc);
    expect(r.findings.map((f) => f.code)).not.toContain("ERC20_APPROVAL_UNLIMITED");
    expect(r.approvals[0]).toMatchObject({ unlimited: false });
  });

  it("blocks an unlimited allowance under Balanced and suggests the amount needed", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(USDC, "0x60");
    rpc.frame = frame({
      to: USDC,
      input: approveData(DAPP, maxUint256),
      logs: [
        approvalLog(USDC, USER, DAPP, maxUint256),
        transferLog(USDC, USER, DAPP, 5n * ONE_USDC),
      ],
    });
    const r = await run(tx({ to: USDC, data: approveData(DAPP, maxUint256) }), rpc);
    expect(r.decision).toBe("blocked");
    const f = r.findings.find((x) => x.code === "ERC20_APPROVAL_UNLIMITED");
    expect(f?.values).toEqual({ spender: DAPP, asset: "USDC", amount: "5" });
    expect(r.suggestions).toEqual([
      { code: "ERC20_APPROVAL_UNLIMITED", values: { amount: "5", asset: "USDC" } },
    ]);
    expect(r.approvals[0]).toMatchObject({ unlimited: true, spender: DAPP, symbol: "USDC" });
  });

  it("shows an unlimited allowance as Caution under Permissive", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(DAPP, "0x60");
    rpc.frame = frame({ to: USDC, logs: [approvalLog(USDC, USER, DAPP, maxUint256)] });
    const r = await run(
      {
        ...tx({ to: USDC, data: approveData(DAPP, maxUint256) }),
        policy: policy({ blockUnlimitedApprovals: false }),
      },
      rpc,
    );
    expect(r.decision).toBe("caution");
    expect(r.findings.find((f) => f.code === "ERC20_APPROVAL_UNLIMITED")?.blocking).toBe(false);
  });

  it("reads a limited allowance, operator access and calldata-only approvals", async () => {
    const rpc = new FakeRpc();
    rpc.frame = frame({
      to: DAPP,
      logs: [
        approvalLog(USDC, USER, DAPP, 10n * ONE_USDC),
        log(
          NFT,
          "ApprovalForAll",
          { owner: USER, operator: DRAINER },
          {
            types: [{ type: "bool" }],
            values: [true],
          },
        ),
      ],
    });
    const r = await run(tx({ to: DAPP }), rpc);
    expect(codes(r)).toEqual(
      expect.arrayContaining(["ERC20_APPROVAL_GRANTED", "NFT_OPERATOR_GRANTED"]),
    );
    expect(r.findings.find((f) => f.code === "ERC20_APPROVAL_GRANTED")?.values.amount).toBe("10");

    const noTrace = await run(tx({ to: USDC, data: approveData(DAPP, 3n * ONE_USDC) }));
    expect(codes(noTrace)).toContain("ERC20_APPROVAL_GRANTED");
  });

  it("catches a permit signature", async () => {
    const r = await run({
      network: "testnet",
      policy: policy(),
      typedData: {
        signer: USER,
        domain: { name: "USD Coin", verifyingContract: USDC, chainId: 10143 },
        types: { Permit: [{ name: "owner", type: "address" }] },
        primaryType: "Permit",
        message: { owner: USER, spender: DRAINER, value: "1000000", nonce: 0, deadline: NOW + 60 },
      },
    });
    expect(codes(r)).toContain("PERMIT_SIGNATURE_DETECTED");
    expect(r.decision).toBe("blocked");
  });
});

describe("signed messages", () => {
  const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  const sign = (
    primaryType: string,
    message: Record<string, unknown>,
    over: {
      verifyingContract?: string;
      chainId?: number;
      types?: AnalyzeRequest["typedData"];
    } = {},
    policyOver: Parameters<typeof policy>[0] = {},
  ) =>
    run({
      network: "testnet",
      policy: policy(policyOver),
      typedData: {
        signer: USER,
        domain: {
          name: "A name the site chose",
          verifyingContract: over.verifyingContract ?? USDC,
          chainId: over.chainId ?? 10143,
        },
        types: {},
        primaryType,
        message,
      },
    });

  it("never calls a message it cannot read Safe: an order that names accounts is blocked", async () => {
    // A marketplace order: an offerer, a zone, items. Baret has no model of it.
    const r = await sign("OrderComponents", {
      offerer: USER,
      zone: DRAINER,
      offer: [{ itemType: 2, token: DAPP, identifierOrCriteria: "7", startAmount: "1" }],
      consideration: [],
    });
    expect(codes(r)).toContain("SIGNATURE_NOT_UNDERSTOOD");
    expect(r.decision).toBe("blocked");
    const finding = r.findings.find((f) => f.code === "SIGNATURE_NOT_UNDERSTOOD");
    // Nothing the site wrote reaches the screen through the finding.
    expect(finding?.values).toEqual({});
    expect(finding?.blocking).toBe(true);
  });

  it("blocks it under Permissive too: no rule turns an unreadable grant into a pass", async () => {
    const r = await sign(
      "Mystery",
      { beneficiary: DRAINER, amount: "5" },
      {},
      { blockPermit: false, allowWarnings: true },
    );
    expect(codes(r)).toContain("SIGNATURE_NOT_UNDERSTOOD");
    expect(r.decision).toBe("blocked");
  });

  it("says so, without stopping, when an unknown message points at no funds", async () => {
    // A vote: a proposal and a choice. No other account, no amount.
    const r = await sign("Ballot", { proposalId: "42", support: 1, reason: "yes" });
    expect(codes(r)).toEqual(["SIGNATURE_UNRECOGNISED"]);
    expect(r.decision).toBe("caution");
    // With warnings off, even that is a block.
    const strict = await sign(
      "Ballot",
      { proposalId: "42", support: 1 },
      {},
      { allowWarnings: false },
    );
    expect(strict.decision).toBe("blocked");
  });

  it("reads a message's own types to find the accounts in it", async () => {
    const r = await run({
      network: "testnet",
      policy: policy(),
      typedData: {
        signer: USER,
        domain: { verifyingContract: DAPP, chainId: 10143 },
        types: {
          Grant: [
            { name: "to", type: "Party" },
            { name: "memo", type: "string" },
          ],
          Party: [{ name: "wallet", type: "address" }],
        },
        primaryType: "Grant",
        // A string that looks like an address is text; the typed address counts.
        message: { to: { wallet: DRAINER }, memo: PEER },
      },
    });
    expect(codes(r)).toContain("SIGNATURE_NOT_UNDERSTOOD");

    const textOnly = await run({
      network: "testnet",
      policy: policy(),
      typedData: {
        signer: USER,
        domain: { verifyingContract: DAPP, chainId: 10143 },
        types: {
          Note: [
            { name: "memo", type: "string" },
            { name: "author", type: "address" },
          ],
        },
        primaryType: "Note",
        // The signer's own address is not another account.
        message: { memo: PEER, author: USER },
      },
    });
    expect(codes(textOnly)).toEqual(["SIGNATURE_UNRECOGNISED"]);
  });

  it("does not read a permit that names another owner, or one with no amount", async () => {
    const other = await sign("Permit", { owner: PEER, spender: DRAINER, value: "1000000" });
    expect(codes(other)).toContain("SIGNATURE_NOT_UNDERSTOOD");
    expect(codes(other)).not.toContain("PERMIT_SIGNATURE_DETECTED");
    const noAmount = await sign("Permit", { owner: USER, spender: DRAINER });
    expect(codes(noAmount)).toContain("SIGNATURE_NOT_UNDERSTOOD");
    expect(noAmount.decision).toBe("blocked");
  });

  it("blocks a message for another chain, readable or not", async () => {
    const r = await sign(
      "Permit",
      { owner: USER, spender: DAPP, value: "1" },
      { chainId: 143 },
      { blockPermit: false },
    );
    expect(codes(r)).toContain("SIGNATURE_NOT_UNDERSTOOD");
    expect(r.findings.find((f) => f.code === "SIGNATURE_NOT_UNDERSTOOD")?.details).toEqual({
      reason: "chain",
    });
    expect(r.decision).toBe("blocked");
  });

  it("reads the DAI form of a permit: the whole balance, or a revoke", async () => {
    const all = await sign("Permit", { holder: USER, spender: DRAINER, nonce: 0, allowed: true });
    expect(codes(all)).toEqual(
      expect.arrayContaining(["PERMIT_SIGNATURE_DETECTED", "ERC20_APPROVAL_UNLIMITED"]),
    );
    expect(all.findings.find((f) => f.code === "PERMIT_SIGNATURE_DETECTED")?.values.amount).toBe(
      "unlimited",
    );
    const revoke = await sign("Permit", { holder: USER, spender: DAPP, nonce: 1, allowed: false });
    expect(revoke.findings).toEqual([]);
    expect(revoke.decision).toBe("safe");
  });

  it("reads Permit2 signature transfers, single, batch and with a witness", async () => {
    const single = await sign(
      "PermitTransferFrom",
      { permitted: { token: USDC, amount: "2500000" }, spender: DRAINER, nonce: 1, deadline: 9 },
      { verifyingContract: PERMIT2 },
    );
    const found = single.findings.find((f) => f.code === "PERMIT_SIGNATURE_DETECTED");
    expect(found?.values).toMatchObject({ spender: DRAINER, amount: "2.5" });
    expect(single.decision).toBe("blocked");

    const witness = await sign(
      "PermitWitnessTransferFrom",
      { permitted: { token: USDC, amount: "1" }, spender: DAPP, witness: { order: "0x01" } },
      { verifyingContract: PERMIT2 },
    );
    expect(codes(witness)).toContain("PERMIT_SIGNATURE_DETECTED");

    const batch = await sign(
      "PermitBatchTransferFrom",
      {
        permitted: [
          { token: USDC, amount: "1" },
          { token: DAPP, amount: "2" },
        ],
        spender: DRAINER,
      },
      { verifyingContract: PERMIT2 },
    );
    expect(codes(batch).filter((c) => c === "PERMIT_SIGNATURE_DETECTED")).toHaveLength(2);

    // One entry that cannot be read hides an allowance: the whole batch is unread.
    const hidden = await sign(
      "PermitBatchTransferFrom",
      {
        permitted: [
          { token: USDC, amount: "1" },
          { token: "not a token", amount: "2" },
        ],
        spender: DAPP,
      },
      { verifyingContract: PERMIT2 },
    );
    expect(codes(hidden)).toContain("SIGNATURE_NOT_UNDERSTOOD");
  });

  it("lets a vote delegation and a cancelled authorisation through: nothing moves", async () => {
    const delegation = await sign("Delegation", { delegatee: PEER, nonce: 0, expiry: NOW + 60 });
    expect(delegation.findings).toEqual([]);
    expect(delegation.decision).toBe("safe");
    const cancel = await sign("CancelAuthorization", { authorizer: USER, nonce: "0x01" });
    expect(cancel.findings).toEqual([]);
    const notMine = await sign("CancelAuthorization", { authorizer: PEER, nonce: "0x01" });
    expect(codes(notMine)).toContain("SIGNATURE_NOT_UNDERSTOOD");
  });

  describe("marketplace orders (Seaport)", () => {
    const SEAPORT = "0x0000000000000068F116a894984e2DB1123eB395";
    const nft = (id: string) => ({
      itemType: 2,
      token: DAPP,
      identifierOrCriteria: id,
      startAmount: "1",
      endAmount: "1",
    });
    const pays = (recipient: string, amount: string) => ({
      itemType: 0,
      token: "0x0000000000000000000000000000000000000000",
      identifierOrCriteria: "0",
      startAmount: amount,
      endAmount: amount,
      recipient,
    });
    const place = (order: Record<string, unknown>, policyOver: Parameters<typeof policy>[0] = {}) =>
      sign(
        "OrderComponents",
        { offerer: USER, zone: PEER, orderType: 0, ...order },
        { verifyingContract: SEAPORT },
        policyOver,
      );

    it("reads a listing: said, not stopped, with what is given and what is paid", async () => {
      const r = await place({ offer: [nft("7")], consideration: [pays(USER, ONE_MON.toString())] });
      expect(codes(r)).toContain("SIGNED_ORDER_DETECTED");
      expect(codes(r)).not.toContain("ORDER_PAYS_NOTHING");
      expect(codes(r)).not.toContain("SIGNATURE_NOT_UNDERSTOOD");
      expect(r.findings.find((f) => f.code === "SIGNED_ORDER_DETECTED")?.values).toEqual({
        count: "1",
      });
      expect(r.decision).not.toBe("safe");
    });

    it("blocks an order that gives items away and pays the signer nothing", async () => {
      // The drainer's listing: the whole payment goes to somebody else.
      const stolen = await place({
        offer: [nft("7"), nft("8")],
        consideration: [pays(DRAINER, "1")],
      });
      expect(codes(stolen)).toEqual(
        expect.arrayContaining(["SIGNED_ORDER_DETECTED", "ORDER_PAYS_NOTHING"]),
      );
      expect(stolen.findings.find((f) => f.code === "ORDER_PAYS_NOTHING")?.values).toEqual({
        count: "2",
      });
      expect(stolen.decision).toBe("blocked");

      const free = await place({ offer: [nft("7")], consideration: [] });
      expect(codes(free)).toContain("ORDER_PAYS_NOTHING");
      // A payment of zero to the signer is no payment.
      const zero = await place({ offer: [nft("7")], consideration: [pays(USER, "0")] });
      expect(codes(zero)).toContain("ORDER_PAYS_NOTHING");
    });

    it("reads an offer by criteria as access to the whole collection", async () => {
      const r = await place({
        offer: [{ ...nft("0"), itemType: 4 }],
        consideration: [pays(USER, ONE_MON.toString())],
      });
      expect(codes(r)).toContain("NFT_OPERATOR_GRANTED");
      expect(r.decision).toBe("blocked");
    });

    it("does not read an order placed for another account, or with an item it cannot read", async () => {
      const other = await sign(
        "OrderComponents",
        { offerer: PEER, offer: [nft("7")], consideration: [] },
        { verifyingContract: SEAPORT },
      );
      expect(codes(other)).toContain("SIGNATURE_NOT_UNDERSTOOD");
      expect(codes(other)).not.toContain("SIGNED_ORDER_DETECTED");
      const odd = await place({ offer: [{ ...nft("7"), itemType: 9 }], consideration: [] });
      expect(codes(odd)).toContain("SIGNATURE_NOT_UNDERSTOOD");
      const noAmount = await place({
        offer: [{ itemType: 2, token: DAPP, identifierOrCriteria: "7" }],
        consideration: [],
      });
      expect(codes(noAmount)).toContain("SIGNATURE_NOT_UNDERSTOOD");
    });

    it("reads every order of a bulk signature, and none when one is unreadable", async () => {
      const order = (id: string) => ({
        offerer: USER,
        offer: [nft(id)],
        consideration: [pays(USER, "5")],
      });
      const bulk = await sign(
        "BulkOrder",
        {
          tree: [
            [order("1"), order("2")],
            [order("3"), order("4")],
          ],
        },
        { verifyingContract: SEAPORT },
      );
      expect(bulk.findings.find((f) => f.code === "SIGNED_ORDER_DETECTED")?.values).toEqual({
        count: "4",
      });
      const hidden = await sign(
        "BulkOrder",
        { tree: [[order("1"), { offerer: PEER, offer: [nft("2")], consideration: [] }]] },
        { verifyingContract: SEAPORT },
      );
      expect(codes(hidden)).toContain("SIGNATURE_NOT_UNDERSTOOD");
    });
  });

  describe("messages that carry a call", () => {
    const FORWARDER = getAddress("0x00000000000000000000000000000000000f0a0d");
    const SAFE = getAddress("0x000000000000000000000000000000000005afe5");

    /** A node that remembers the call it was asked to trace. */
    class Spy extends FakeRpc {
      traced: CallParams | null = null;
      override async traceCall(params?: CallParams) {
        this.traced = params ?? null;
        return super.traceCall();
      }
    }

    const carry = (
      primaryType: string,
      message: Record<string, unknown>,
      rpc: FakeRpc,
      verifyingContract: Address = FORWARDER,
      chainId = 10143,
    ) =>
      run(
        {
          network: "testnet",
          policy: policy(),
          typedData: {
            signer: USER,
            domain: { name: "Forwarder", verifyingContract, chainId },
            types: {},
            primaryType,
            message,
          },
        },
        rpc,
      );

    it("simulates a meta-transaction as the forwarder will send it, and shows what it moves", async () => {
      const rpc = new Spy();
      // The inner call moves 900 of the signer's 1,000 USDC to the drainer.
      rpc.frame = frame({
        from: FORWARDER,
        to: USDC,
        logs: [transferLog(USDC, USER, DRAINER, 900n * ONE_USDC)],
      });
      const r = await carry(
        "ForwardRequest",
        { from: USER, to: USDC, value: "0", gas: "100000", nonce: 0, data: "0xa9059cbb" },
        rpc,
      );
      // The call is the forwarder's, with the signer's address appended (ERC-2771).
      expect(rpc.traced?.from).toBe(FORWARDER);
      expect(rpc.traced?.to).toBe(USDC);
      expect(rpc.traced?.data).toBe(`0xa9059cbb${USER.slice(2).toLowerCase()}`);
      expect(rpc.traced?.gas).toBe(100_000n);

      const usdc = r.estimatedChanges.find((c) => c.asset.address === USDC);
      expect(usdc?.delta).toBe((-900n * ONE_USDC).toString());
      expect(codes(r)).toContain("ESTIMATED_LOSS_EXCEEDS_MAX");
      expect(codes(r)).not.toContain("SIGNATURE_NOT_UNDERSTOOD");
      expect(r.decision).toBe("blocked");
    });

    it("passes a meta-transaction that moves nothing, and charges the signer no fee", async () => {
      const rpc = new Spy();
      rpc.frame = frame({ from: FORWARDER, to: PEER });
      const r = await carry(
        "ForwardRequest",
        { from: USER, to: PEER, value: "0", gas: "50000", nonce: 1, data: "0x" },
        rpc,
      );
      expect(r.findings).toEqual([]);
      expect(r.decision).toBe("safe");
      // Whoever relays it pays: the signer's MON does not change.
      const mon = r.estimatedChanges.find((c) => c.asset.kind === "native");
      expect(mon === undefined || mon.delta === "0").toBe(true);
    });

    it("blocks one that would revert, like a transaction that would", async () => {
      const rpc = new Spy();
      rpc.outcome = { ok: false, revertReason: "nope", revertData: null };
      const r = await carry(
        "ForwardRequest",
        { from: USER, to: PEER, value: "0", gas: "50000", nonce: 1, data: "0x" },
        rpc,
      );
      expect(codes(r)).toContain("SIMULATION_FAILED");
      expect(r.decision).toBe("blocked");
    });

    it("does not simulate a meta-transaction signed for another sender: it is unread", async () => {
      const rpc = new Spy();
      const r = await carry(
        "ForwardRequest",
        { from: PEER, to: USDC, value: "0", gas: "1", nonce: 0, data: "0x" },
        rpc,
      );
      expect(rpc.traced).toBeNull();
      expect(codes(r)).toContain("SIGNATURE_NOT_UNDERSTOOD");
      expect(r.decision).toBe("blocked");
    });

    it("simulates a Safe transaction from the Safe, and refuses a Safe delegatecall", async () => {
      const rpc = new Spy();
      rpc.erc20.set(`${USDC}:${SAFE}`, 1_000n * ONE_USDC);
      rpc.frame = frame({
        from: SAFE,
        to: USDC,
        logs: [transferLog(USDC, SAFE, DRAINER, 950n * ONE_USDC)],
      });
      const safeTx = { to: USDC, value: "0", data: "0xa9059cbb", operation: 0, nonce: 3 };
      const r = await carry("SafeTx", safeTx, rpc, SAFE);
      expect(rpc.traced?.from).toBe(SAFE);
      // The funds at stake are the Safe's, not the owner's who signs.
      const usdc = r.estimatedChanges.find((c) => c.asset.address === USDC);
      expect(usdc?.account).toBe(SAFE);
      expect(usdc?.delta).toBe((-950n * ONE_USDC).toString());
      expect(r.decision).toBe("blocked");

      const spy = new Spy();
      const delegate = await carry("SafeTx", { ...safeTx, operation: 1 }, spy, SAFE);
      expect(spy.traced).toBeNull();
      expect(codes(delegate)).toContain("SIGNATURE_NOT_UNDERSTOOD");
    });

    it("blocks a carried call signed for another chain, whatever it does here", async () => {
      const rpc = new Spy();
      rpc.frame = frame({ from: FORWARDER, to: PEER });
      const r = await carry(
        "ForwardRequest",
        { from: USER, to: PEER, value: "0", gas: "50000", nonce: 1, data: "0x" },
        rpc,
        FORWARDER,
        143,
      );
      expect(codes(r)).toContain("SIGNATURE_NOT_UNDERSTOOD");
      expect(r.decision).toBe("blocked");
    });
  });

  it("checks the contract an unread message is meant for against the registry", async () => {
    const r = await run(
      {
        network: "testnet",
        policy: policy(),
        typedData: {
          signer: USER,
          domain: { verifyingContract: DRAINER, chainId: 10143 },
          types: {},
          primaryType: "Ballot",
          message: { proposalId: "1" },
        },
      },
      new FakeRpc(),
      cleanSources({ registry: { [DRAINER]: { flagged: true, severity: 4, reasonCode: "X" } } }),
    );
    expect(codes(r)).toContain("KNOWN_MALICIOUS_ADDRESS");
    expect(r.decision).toBe("blocked");
  });
});

describe("request shapes", () => {
  const unsigned = (chainId = 10143) =>
    serializeTransaction({
      chainId,
      type: "eip1559",
      to: PEER,
      value: 1n,
      maxFeePerGas: 100n * 10n ** 9n,
      gas: 21_000n,
    });

  it("takes an unsigned serialized transaction with userWallet as the sender", async () => {
    const r = await run({
      network: "testnet",
      transaction: { raw: unsigned() },
      userWallet: USER,
      policy: policy(),
    });
    expect(r.estimatedChanges[0]?.account).toBe(USER);
  });

  it("refuses an unsigned transaction with no sender, and one for another chain", async () => {
    await expect(
      analyze({ network: "testnet", transaction: { raw: unsigned() } }, deps(new FakeRpc())),
    ).rejects.toThrow(/account/); // PARITY: v1 `userWallet` is v2 `account`
    await expect(
      analyze(
        { network: "testnet", transaction: { raw: unsigned(1) }, userWallet: USER },
        deps(new FakeRpc()),
      ),
    ).rejects.toThrow(/chain 1/);
  });

  it("blocks a transaction that hands the account's code to a contract (EIP-7702)", async () => {
    const raw = serializeTransaction({
      chainId: 10143,
      type: "eip7702",
      to: PEER,
      value: 0n,
      maxFeePerGas: 100n * 10n ** 9n,
      gas: 60_000n,
      authorizationList: [
        {
          address: DRAINER,
          chainId: 10143,
          nonce: 0,
          r: `0x${"11".repeat(32)}`,
          s: `0x${"22".repeat(32)}`,
          yParity: 0,
        },
      ],
    });
    const r = await run({
      network: "testnet",
      transaction: { raw },
      userWallet: USER,
      // Even with the delegatecall rule off: the simulation does not apply it.
      policy: policy({ blockDelegatecall: false }),
    });
    const finding = r.findings.find((f) => f.code === "ACCOUNT_CODE_DELEGATION");
    expect(finding?.values).toEqual({ contract: DRAINER });
    expect(finding?.blocking).toBe(true);
    expect(r.decision).toBe("blocked");
  });

  it("applies a template by name with the network's USDC filled in", async () => {
    // Strict turns every finding into a block; Permissive lets this one through.
    const call = { ...tx({ to: USDC, data: approveData(DAPP, 3n * ONE_USDC) }), policy: undefined };
    const strict = await run({ ...call, policyTemplate: "strict" });
    const permissive = await run({ ...call, policyTemplate: "permissive" });
    expect(strict.decision).toBe("blocked");
    expect(permissive.decision).toBe("caution");
    expect(analyzeRequestSchema.safeParse({ ...tx(), policyTemplate: "strict" }).success).toBe(
      false,
    );
  });

  it("names a collection in an operator approval", async () => {
    const rpc = new FakeRpc();
    rpc.meta.set(NFT, { symbol: "NIGHT", decimals: null as unknown as number });
    rpc.frame = frame({
      to: NFT,
      logs: [
        log(
          NFT,
          "ApprovalForAll",
          { owner: USER, operator: DRAINER },
          {
            types: [{ type: "bool" }],
            values: [true],
          },
        ),
      ],
    });
    const r = await run(tx({ to: NFT }), rpc);
    expect(r.approvals[0]).toMatchObject({ kind: "operator", symbol: "NIGHT", decimals: null });
  });
});

describe("token metadata", () => {
  it("counts a token it cannot read in base units, named by its address", async () => {
    const rpc = new FakeRpc();
    const MYSTERY = "0xabcdef0000000000000000000000000000001234" as const;
    rpc.frame = frame({ to: MYSTERY, logs: [approvalLog(MYSTERY, USER, DAPP, 5_000n)] });
    const r = await run(tx({ to: MYSTERY, data: approveData(DAPP, 5_000n) }), rpc);
    expect(r.findings.find((f) => f.code === "ERC20_APPROVAL_GRANTED")?.values).toEqual({
      spender: DAPP,
      amount: "5000",
      asset: "0xABcD...1234", // checksummed, like every address the server returns
    });
  });
});

describe("contracts and dangerous calls", () => {
  it("flags unknown, reported, self-destructing and borrowed-code contracts", async () => {
    const rpc = new FakeRpc();
    for (const a of [DAPP, NFT, IMPL, FAKE_USDC]) rpc.code.set(a, "0x60");
    rpc.frame = frame({
      to: DAPP,
      calls: [
        frame({ from: DAPP, to: NFT, type: "DELEGATECALL" }),
        frame({ from: NFT, to: PEER, type: "SELFDESTRUCT" }),
        frame({ from: DAPP, to: FAKE_USDC }),
      ],
      logs: [
        log(
          DAPP,
          "OwnershipTransferred",
          { previousOwner: USER, newOwner: DRAINER },
          {
            types: [],
            values: [],
          },
        ),
      ],
    });
    const r = await run(
      tx({ to: DAPP }),
      rpc,
      cleanSources({
        registry: { [FAKE_USDC]: { flagged: true, severity: 2, reasonCode: "SPOOF" } },
      }),
    );
    expect(codes(r)).toEqual(
      expect.arrayContaining([
        "UNKNOWN_CONTRACT_EXPOSURE",
        "RISKY_CONTRACT_INTERACTION",
        "SELFDESTRUCT_CALL",
        "DELEGATECALL_DETECTED",
        "OWNERSHIP_TRANSFER",
      ]),
    );
    expect(r.decision).toBe("blocked");
  });

  it("blocks a call that pays an unknown contract and brings nothing back", async () => {
    const pays = () => {
      const rpc = new FakeRpc();
      rpc.code.set(DAPP, "0x60");
      rpc.frame = sendMon(DAPP, ONE_MON / 10n);
      return rpc;
    };
    const stake = { to: DAPP, value: (ONE_MON / 10n).toString(), data: "0x3a4b66f1" as const };
    const r = await run(tx(stake), pays());
    const kept = r.findings.find((f) => f.code === "VALUE_KEPT_BY_UNKNOWN_CONTRACT");
    expect(kept?.values).toEqual({ contract: DAPP, amount: "0.1", asset: "MON" });
    // A small share of the balance: the loss limit says nothing, the new finding blocks.
    expect(codes(r)).not.toContain("ESTIMATED_LOSS_EXCEEDS_MAX");
    expect(r.decision).toBe("blocked");
    expect(r.firedRules.map((f) => f.rule)).toContain("blockRiskyContracts");

    // With the rule off it is still shown, and no longer blocks.
    const off = await run({ ...tx(stake), policy: policy({ blockRiskyContracts: false }) }, pays());
    expect(codes(off)).toContain("VALUE_KEPT_BY_UNKNOWN_CONTRACT");
    expect(off.decision).toBe("caution");
  });

  it("does not call a plain transfer, a known contract or an exchange a kept payment", async () => {
    // No calldata: a transfer to a contract address, whose recipient the user chose.
    const plain = new FakeRpc();
    plain.code.set(DAPP, "0x60");
    plain.frame = sendMon(DAPP, ONE_MON / 10n);
    const transfer = await run(tx({ to: DAPP, value: (ONE_MON / 10n).toString() }), plain);
    expect(codes(transfer)).toEqual(["UNKNOWN_CONTRACT_EXPOSURE"]);

    // The unknown contract sends a token back in the same transaction.
    const swap = new FakeRpc();
    for (const a of [DAPP, FAKE_USDC]) swap.code.set(a, "0x60");
    swap.frame = frame({
      to: DAPP,
      value: `0x${(ONE_MON / 10n).toString(16)}`,
      calls: [
        frame({ from: DAPP, to: FAKE_USDC, logs: [transferLog(FAKE_USDC, DAPP, USER, ONE_USDC)] }),
      ],
    });
    const swapped = await run(
      tx({ to: DAPP, value: (ONE_MON / 10n).toString(), data: "0x3a4b66f1" }),
      swap,
    );
    expect(codes(swapped)).not.toContain("VALUE_KEPT_BY_UNKNOWN_CONTRACT");
  });

  it("knows a vault the PaymentGuard factory deployed, and only with a factory configured", async () => {
    const vault = () => {
      const rpc = new FakeRpc();
      rpc.code.set(DAPP, "0x60");
      rpc.vaults.add(DAPP);
      rpc.frame = frame({ to: DAPP });
      return rpc;
    };
    const plain = await run(tx({ to: DAPP }), vault());
    expect(codes(plain)).toContain("UNKNOWN_CONTRACT_EXPOSURE");

    const withFactory = {
      ...deps(vault()),
      config: {
        ...config,
        networks: { testnet: { ...network, paymentGuardFactoryAddress: IMPL } },
      },
    };
    const r = await analyze(tx({ to: DAPP }), withFactory);
    expect(r.findings).toEqual([]);
  });

  it("does not report a standard proxy calling its own implementation", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(USDC, "0x60");
    rpc.storage.set(`${USDC}:${EIP1967_IMPLEMENTATION_SLOT}`, implSlotValue(IMPL));
    rpc.code.set(IMPL, "0x60");
    rpc.frame = frame({ to: USDC, calls: [frame({ from: USDC, to: IMPL, type: "DELEGATECALL" })] });
    const r = await run(tx({ to: USDC }), rpc);
    expect(codes(r)).not.toContain("DELEGATECALL_DETECTED");
    // The implementation is covered by the proxy: USDC is known, so nothing is unknown.
    expect(r.findings).toEqual([]);
  });

  it("knows the proxies that predate EIP-1967, such as USDC's", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(USDC, "0x60");
    rpc.code.set(IMPL, "0x60");
    rpc.storage.set(`${USDC}:${ZOS_IMPLEMENTATION_SLOT}`, implSlotValue(IMPL));
    rpc.frame = frame({ to: USDC, calls: [frame({ from: USDC, to: IMPL, type: "DELEGATECALL" })] });
    const r = await run(tx({ to: USDC }), rpc);
    expect(r.findings).toEqual([]);
  });

  it("flags deep nesting, many operations and a gas limit above the rule", async () => {
    const rpc = new FakeRpc();
    let leaf = frame({ from: DAPP, to: DAPP });
    for (let i = 0; i < 5; i++) leaf = frame({ from: DAPP, to: DAPP, calls: [leaf] });
    rpc.frame = frame({
      to: DAPP,
      calls: [leaf, ...Array.from({ length: 12 }, () => frame({ from: DAPP, to: PEER }))],
    });
    const r = await run(
      { ...tx({ to: DAPP, gas: "3000000" }), policy: policy({ maxGas: 1_000_000 }) },
      rpc,
    );
    expect(codes(r)).toEqual(
      expect.arrayContaining(["DEEP_CALL_NESTING", "HIGH_OPERATION_COUNT", "EXCESSIVE_GAS"]),
    );
    expect(r.findings.find((f) => f.code === "EXCESSIVE_GAS")?.values).toEqual({
      actual: "3000000",
      limit: "1000000",
    });
  });
});

describe("reputation", () => {
  it("blocks a listed address and labels the counterparty", async () => {
    const rpc = new FakeRpc();
    rpc.frame = sendMon(DRAINER, 1n);
    const r = await run(
      { ...tx({ to: DRAINER, value: "1" }), policy: policy({ minNansenTrustLevel: "identified" }) },
      rpc,
      cleanSources({
        registry: { [DRAINER]: { flagged: true, severity: 4, reasonCode: "DRAINER" } },
      }),
    );
    expect(codes(r)).toContain("KNOWN_MALICIOUS_ADDRESS");
    expect(r.decision).toBe("blocked");

    const peer = await run(
      { ...tx({ to: PEER, value: "1" }), policy: policy({ minNansenTrustLevel: "identified" }) },
      rpc,
      cleanSources({ nansen: { [PEER]: { trustLevel: "new", freshWallet: true, whale: true } } }),
    );
    expect(codes(peer)).toEqual(
      expect.arrayContaining([
        "NANSEN_FLAGGED_FRESH_WALLET",
        "NANSEN_FLAGGED_WHALE_COUNTERPARTY",
        "NANSEN_TRUST_BELOW_MINIMUM",
      ]),
    );
    expect(peer.findings.find((f) => f.code === "NANSEN_TRUST_BELOW_MINIMUM")?.values).toEqual({
      address: PEER,
      actual: "new",
      limit: "identified",
    });
  });

  it("fails closed when the registry, which the blocklist rules need, does not answer", async () => {
    const r = await run(
      tx({ to: PEER, value: "1" }),
      new FakeRpc(),
      cleanSources({ registry: null }),
    );
    expect(r.decision).toBe("blocked");
    expect(r.firedRules[0]).toMatchObject({
      code: "REPUTATION_DATA_UNAVAILABLE",
      rule: "blockKnownMalicious",
    });
    expect(r.sources.find((s) => s.name === "reputation-registry")?.status).toBe("unavailable");
  });

  it("does not need Nansen for the blocklist rules, only for the trust level rule", async () => {
    const noNansen = cleanSources({ nansen: null });
    const balanced = await run(tx({ to: PEER, value: "1" }), new FakeRpc(), noNansen);
    expect(codes(balanced)).not.toContain("REPUTATION_DATA_UNAVAILABLE");

    const strictTrust = await run(
      { ...tx({ to: PEER, value: "1" }), policy: policy({ minNansenTrustLevel: "established" }) },
      new FakeRpc(),
      noNansen,
    );
    expect(strictTrust.firedRules[0]).toMatchObject({
      code: "REPUTATION_DATA_UNAVAILABLE",
      rule: "minNansenTrustLevel",
    });
  });

  it("asks Nansen about wallets, not contracts", async () => {
    const asked: string[] = [];
    const sources = cleanSources();
    const nansen = sources.nansen;
    sources.nansen = nansen && {
      lookup: async (as) => {
        asked.push(...as);
        return nansen.lookup(as);
      },
    };
    const rpc = new FakeRpc();
    rpc.code.set(DAPP, "0x60");
    rpc.frame = frame({ to: DAPP, logs: [transferLog(USDC, USER, PEER, ONE_USDC)] });
    await run(tx({ to: DAPP }), rpc, sources);
    expect(asked).toEqual([PEER]);
  });

  it("does not need reputation when no rule asks for it", async () => {
    const r = await run(
      {
        ...tx({ to: PEER, value: "1" }),
        policy: policy({ blockKnownMalicious: false, blockRiskyContracts: false }),
      },
      new FakeRpc(),
      cleanSources({ nansen: null, registry: null }),
    );
    expect(codes(r)).not.toContain("REPUTATION_DATA_UNAVAILABLE");
  });
});

describe("compliance", () => {
  const usdcSend = (to: string) => {
    const rpc = new FakeRpc();
    rpc.frame = frame({ to: USDC, logs: [transferLog(USDC, USER, to as `0x${string}`, ONE_USDC)] });
    return rpc;
  };
  const strictId = policy({
    requireComplianceCheck: true,
    allowedCountries: ["DE"],
    minComplianceTier: 2,
  });
  const good = { expiresAt: NOW + 1000, countries: ["DE"], tier: 3 };

  it("checks both sides and names the side", async () => {
    const r = await run(
      { ...tx({ to: USDC }), policy: strictId },
      usdcSend(PEER),
      cleanSources({ compliance: { [USER]: null, [PEER]: good } }),
    );
    const f = r.findings.find((x) => x.code === "COMPLIANCE_NO_CREDENTIAL");
    expect(f?.details?.side).toBe("self");
    expect(r.decision).toBe("blocked");
  });

  it("checks expiry, country and level of the recipient", async () => {
    const expired = await run(
      { ...tx({ to: USDC }), policy: strictId },
      usdcSend(PEER),
      cleanSources({ compliance: { [USER]: good, [PEER]: { ...good, expiresAt: NOW - 1 } } }),
    );
    expect(codes(expired)).toContain("COMPLIANCE_EXPIRED");

    const elsewhere = await run(
      { ...tx({ to: USDC }), policy: strictId },
      usdcSend(PEER),
      cleanSources({
        compliance: { [USER]: good, [PEER]: { ...good, countries: ["DE", "FR"], tier: 1 } },
      }),
    );
    expect(codes(elsewhere)).toEqual(
      expect.arrayContaining(["COMPLIANCE_COUNTRY_DISALLOWED", "COMPLIANCE_TIER_INSUFFICIENT"]),
    );
  });

  it("names the party a CompliantPaymentGuard refused, before anything is signed", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(DAPP, "0x60");
    // NotVerified(PEER, NoCredential): the guard's typed refusal.
    const revertData = `0x0c2b355f${PEER.slice(2).toLowerCase().padStart(64, "0")}${"0".repeat(64)}`;
    rpc.outcome = { ok: false, revertReason: null, revertData: revertData as `0x${string}` };
    const r = await run(tx({ to: DAPP, data: "0x8b7bd0a5" }), rpc);
    const finding = r.findings.find((f) => f.code === "COMPLIANCE_NO_CREDENTIAL");
    expect(finding?.values).toEqual({ recipient: PEER });
    expect(finding?.details).toMatchObject({ side: "recipient", reason: "NoCredential" });
    expect(codes(r)).toContain("SIMULATION_FAILED");
    expect(r.decision).toBe("blocked");
  });

  it("accepts a credential that does not expire, and refuses one with no country on it", async () => {
    const forever = { ...good, expiresAt: null };
    const ok = await run(
      { ...tx({ to: USDC }), policy: strictId },
      usdcSend(PEER),
      cleanSources({ compliance: { [USER]: forever, [PEER]: forever } }),
    );
    expect(codes(ok).filter((c) => c.startsWith("COMPLIANCE_"))).toEqual([]);

    const nowhere = await run(
      { ...tx({ to: USDC }), policy: strictId },
      usdcSend(PEER),
      cleanSources({ compliance: { [USER]: good, [PEER]: { ...good, countries: [] } } }),
    );
    expect(codes(nowhere)).toContain("COMPLIANCE_COUNTRY_DISALLOWED");
  });

  it("checks both sides of a compliant asset even when no rule asks for identity", async () => {
    const noRules = { ...tx({ to: USDC }), policy: policy() };
    const refused = await run(
      noRules,
      usdcSend(PEER),
      cleanSources({ compliance: { [USER]: good, [PEER]: null }, gated: [USDC] }),
    );
    const f = refused.findings.find((x) => x.code === "COMPLIANCE_NO_CREDENTIAL");
    expect(f).toMatchObject({ blocking: true, details: { side: "recipient", asset: USDC } });
    expect(refused.decision).toBe("blocked");
    expect(refused.sources).toContainEqual({ name: "cleanverse", status: "ok" });

    const fine = await run(
      noRules,
      usdcSend(PEER),
      cleanSources({ compliance: { [USER]: good, [PEER]: good }, gated: [USDC] }),
    );
    expect(codes(fine).filter((c) => c.startsWith("COMPLIANCE_"))).toEqual([]);
  });

  it("leaves an ordinary token alone when no rule asks for identity", async () => {
    const r = await run(
      { ...tx({ to: USDC }), policy: policy() },
      usdcSend(PEER),
      cleanSources({ compliance: { [USER]: null, [PEER]: null } }),
    );
    expect(codes(r).filter((c) => c.startsWith("COMPLIANCE_"))).toEqual([]);
    expect(r.sources).toContainEqual({ name: "cleanverse", status: "skipped" });
  });

  it("fails closed when Cleanverse does not answer", async () => {
    const r = await run(
      { ...tx({ to: USDC }), policy: strictId },
      usdcSend(PEER),
      cleanSources({ compliance: null }),
    );
    expect(codes(r)).toEqual(["COMPLIANCE_DATA_UNAVAILABLE"]);
    expect(r.decision).toBe("blocked");
  });
});

describe("loss limits", () => {
  it("blocks a request that takes more than the loss limit", async () => {
    const rpc = new FakeRpc();
    rpc.frame = sendMon(PEER, 60n * ONE_MON);
    const r = await run(tx({ to: PEER, value: (60n * ONE_MON).toString() }), rpc);
    expect(r.findings.find((f) => f.code === "ESTIMATED_LOSS_EXCEEDS_MAX")?.values.limit).toBe(
      "50%",
    );
    expect(r.decision).toBe("blocked");
  });

  it("does not count an exchange with a listed contract as a loss", async () => {
    // 80 of 100 MON staked for a receipt token, minted to the user by the pool.
    const stake = () => {
      const rpc = new FakeRpc();
      rpc.code.set(DAPP, "0x60");
      rpc.frame = frame({
        to: DAPP,
        value: `0x${(80n * ONE_MON).toString(16)}`,
        logs: [transferLog(NFT, "0x0000000000000000000000000000000000000000", USER, 80n * ONE_MON)],
      });
      return rpc;
    };
    const request = tx({ to: DAPP, value: (80n * ONE_MON).toString() });

    const unlisted = await run(request, stake());
    expect(codes(unlisted)).toContain("ESTIMATED_LOSS_EXCEEDS_MAX");

    const listed = {
      ...deps(stake()),
      config: { ...config, networks: { testnet: { ...network, knownContracts: [DAPP, NFT] } } },
    };
    const r = await analyze(request, listed);
    expect(r.findings.map((f) => f.code)).not.toContain("ESTIMATED_LOSS_EXCEEDS_MAX");
    expect(r.decision).toBe("safe");
  });

  it("still measures a payment to a listed contract that returns nothing", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(DAPP, "0x60");
    rpc.frame = sendMon(DAPP, 80n * ONE_MON);
    const listed = {
      ...deps(rpc),
      config: { ...config, networks: { testnet: { ...network, knownContracts: [DAPP] } } },
    };
    const r = await analyze(tx({ to: DAPP, value: (80n * ONE_MON).toString() }), listed);
    expect(r.findings.map((f) => f.code)).toContain("ESTIMATED_LOSS_EXCEEDS_MAX");
  });

  it("fails closed when the balance cannot be read", async () => {
    const rpc = new FakeRpc();
    rpc.balanceFails = true;
    rpc.frame = sendMon(PEER, ONE_MON);
    const r = await run(tx({ to: PEER, value: ONE_MON.toString() }), rpc);
    expect(codes(r)).toEqual(
      expect.arrayContaining(["LOSS_PERCENT_UNAVAILABLE", "POST_BALANCE_UNAVAILABLE"]),
    );
  });

  it("keeps the MON and USDC floors", async () => {
    const rpc = new FakeRpc();
    rpc.frame = frame({
      to: USDC,
      value: `0x${(99n * ONE_MON).toString(16)}`,
      logs: [transferLog(USDC, USER, PEER, 999n * ONE_USDC)],
    });
    const r = await run(
      {
        ...tx({ to: USDC, value: (99n * ONE_MON).toString() }),
        policy: policy({
          maxLossPercent: null,
          minPostNativeBalance: "5",
          minPostUsdcBalance: "10",
        }),
      },
      rpc,
    );
    const floors = r.findings.filter((f) => f.code === "POST_BALANCE_TOO_LOW");
    expect(floors.map((f) => f.values.asset).sort()).toEqual(["MON", "USDC"]);
    expect(floors.find((f) => f.values.asset === "USDC")?.values).toEqual({
      actual: "1",
      limit: "10",
      asset: "USDC",
    });
  });
});

describe("x402 payments", () => {
  const pay = (over: Partial<{ to: string; token: string; value: string }> = {}) => ({
    signer: USER,
    domain: { name: "USDC", verifyingContract: over.token ?? USDC, chainId: 10143 },
    types: { TransferWithAuthorization: [{ name: "from", type: "address" }] },
    primaryType: "TransferWithAuthorization",
    message: { from: USER, to: over.to ?? SHOP, value: over.value ?? "1000000" },
  });
  const payment = (over: Record<string, unknown> = {}) => ({
    origin: "https://shop.example",
    payTo: SHOP,
    asset: USDC,
    amount: "1000000",
    memo: "inv-1",
    spendHistory: [],
    ...over,
  });

  it("lets a payment within every rule through", async () => {
    const r = await run({
      network: "testnet",
      policy: policy(),
      typedData: pay(),
      payment: payment(),
    });
    expect(r.findings).toEqual([]);
    expect(r.decision).toBe("safe");
  });

  it("catches a tampered destination and asset", async () => {
    const r = await run({
      network: "testnet",
      policy: policy({ allowWarnings: false }),
      typedData: pay({ to: DRAINER, token: FAKE_USDC }),
      payment: payment(),
    });
    expect(codes(r)).toEqual(
      expect.arrayContaining([
        "X402_DESTINATION_MISMATCH",
        "X402_ASSET_MISMATCH",
        "X402_NON_CANONICAL_ASSET",
      ]),
    );
    expect(r.findings.find((f) => f.code === "X402_ASSET_MISMATCH")?.values).toEqual({
      expected: USDC,
      actual: FAKE_USDC,
    });
    expect(r.decision).toBe("blocked");
  });

  it("enforces the asset list, the reference and the merchant list", async () => {
    const r = await run({
      network: "testnet",
      policy: policy({
        allowedAssets: [],
        requireMemo: true,
        allowedMerchantOrigins: ["https://other.example"],
      }),
      typedData: pay(),
      payment: payment({ memo: null }),
    });
    expect(codes(r)).toEqual(
      expect.arrayContaining([
        "X402_ASSET_NOT_ALLOWED",
        "X402_MEMO_MISSING",
        "X402_MERCHANT_NOT_ALLOWED",
      ]),
    );
  });

  it("enforces caps over rolling windows", async () => {
    const r = await run({
      network: "testnet",
      policy: policy({ maxPerTxCap: "0.5", maxHourlyCap: "3", maxDailyCap: "4" }),
      typedData: pay(),
      payment: payment({
        spendHistory: [
          { amount: "2500000", timestamp: NOW - 600 },
          { amount: "1000000", timestamp: NOW - 7200 },
          { amount: "9000000", timestamp: NOW - 90_000 },
        ],
      }),
    });
    const byCode = Object.fromEntries(r.findings.map((f) => [f.code, f.values]));
    expect(byCode.X402_PER_TX_CAP_EXCEEDED).toEqual({
      origin: "https://shop.example",
      actual: "1",
      cap: "0.5",
    });
    expect(byCode.X402_HOURLY_CAP_EXCEEDED).toEqual({ amount: "1", actual: "3.5", cap: "3" });
    expect(byCode.X402_DAILY_CAP_EXCEEDED).toEqual({ amount: "1", actual: "4.5", cap: "4" });
  });

  it("fails closed without spend history when a window cap is set", async () => {
    const r = await run({
      network: "testnet",
      policy: policy(),
      typedData: pay(),
      payment: payment({ spendHistory: undefined }),
    });
    expect(codes(r)).toEqual(["X402_SPEND_HISTORY_UNAVAILABLE"]);
    expect(r.decision).toBe("blocked");
  });
});

describe("calldata fallback", () => {
  it("still sees a transfer when there is no trace", async () => {
    const data = calldata({
      abi: KNOWN_FUNCTIONS,
      functionName: "transfer",
      args: [PEER, 900n * ONE_USDC],
    });
    const r = await run(tx({ to: USDC, data }));
    expect(codes(r)).toContain("ESTIMATED_LOSS_EXCEEDS_MAX");
  });
});

describe("value that reaches a listed address, whoever pays it", () => {
  const flagged = () =>
    cleanSources({
      registry: { [DRAINER]: { flagged: true, severity: 4, reasonCode: "DRAINER" } },
    });
  const SEAPORT = "0x0000000000000068F116a894984e2DB1123eB395";
  const order = (recipient: string, template: "balanced" | "permissive") => ({
    network: "testnet" as const,
    policyTemplate: template,
    typedData: {
      signer: USER,
      domain: { name: "Seaport", verifyingContract: SEAPORT, chainId: 10143 },
      types: {},
      primaryType: "OrderComponents",
      message: {
        offerer: USER,
        zone: PEER,
        orderType: 0,
        offer: [
          {
            itemType: 1,
            token: USDC,
            identifierOrCriteria: "0",
            startAmount: "5000000",
            endAmount: "5000000",
          },
        ],
        consideration: [
          {
            itemType: 0,
            token: "0x0000000000000000000000000000000000000000",
            identifierOrCriteria: "0",
            startAmount: "1",
            endAmount: "1",
            recipient,
          },
        ],
      },
    },
  });

  it("blocks a Seaport order whose consideration pays a listed drainer, under every template", async () => {
    const balanced = await run(order(DRAINER, "balanced"), new FakeRpc(), flagged());
    expect(codes(balanced)).toContain("KNOWN_MALICIOUS_ADDRESS");
    expect(balanced.findings.find((f) => f.code === "KNOWN_MALICIOUS_ADDRESS")?.values).toEqual({
      address: DRAINER,
    });
    // Permissive turns off blockPermit (ORDER_PAYS_NOTHING) but keeps blockKnownMalicious.
    const permissive = await run(order(DRAINER, "permissive"), new FakeRpc(), flagged());
    expect(codes(permissive)).toContain("KNOWN_MALICIOUS_ADDRESS");
    expect(permissive.decision).toBe("blocked");
    const honest = await run(order(PEER, "permissive"), new FakeRpc(), flagged());
    expect(codes(honest)).not.toContain("KNOWN_MALICIOUS_ADDRESS");
  });

  it("never reports a balance below zero after the request", async () => {
    const rpc = new FakeRpc();
    rpc.erc20.set(`${USDC}:${USER}`, 2n * ONE_USDC);
    const r = await run(order(PEER, "balanced"), rpc, flagged());
    const usdc = r.estimatedChanges.find((c) => c.asset.address === USDC);
    expect(usdc).toMatchObject({ before: "2000000", after: "0", delta: "-5000000" });
  });

  const payData = (merchant: Address) =>
    calldata({
      abi: KNOWN_FUNCTIONS,
      functionName: "pay",
      args: [merchant, 10_000n, `0x${"ab".repeat(32)}`],
    });
  const vaultPay = (merchant: Address) => {
    const rpc = new FakeRpc();
    rpc.code.set(DAPP, "0x60");
    rpc.code.set(USDC, "0x60");
    rpc.vaults.add(DAPP);
    // The agent calls the vault; the vault moves its own USDC to the merchant.
    rpc.frame = frame({
      to: DAPP,
      input: payData(merchant),
      calls: [frame({ from: DAPP, to: USDC, logs: [transferLog(USDC, DAPP, merchant, 10_000n)] })],
    });
    return {
      ...deps(rpc, flagged()),
      config: {
        ...config,
        networks: { testnet: { ...network, paymentGuardFactoryAddress: IMPL } },
      },
    };
  };

  it("blocks a vault payment to a listed drainer and leaves the honest merchant alone", async () => {
    const stolen = await analyze(tx({ to: DAPP, data: payData(DRAINER) }), vaultPay(DRAINER));
    for (const f of stolen.findings) emitted.add(f.code);
    expect(codes(stolen)).toContain("KNOWN_MALICIOUS_ADDRESS");
    expect(stolen.decision).toBe("blocked");
    const honest = await analyze(tx({ to: DAPP, data: payData(PEER) }), vaultPay(PEER));
    expect(honest.findings).toEqual([]);
    expect(honest.decision).toBe("safe");
  });

  it("names the merchant of a vault payment from the calldata when the call reverts", async () => {
    const d = vaultPay(DRAINER);
    const rpc = d.rpcFor(network) as FakeRpc;
    rpc.outcome = { ok: false, revertReason: "UnknownMerchant", revertData: null };
    rpc.estimate = null;
    const r = await analyze(tx({ to: DAPP, data: payData(DRAINER) }), d);
    expect(codes(r)).toEqual(
      expect.arrayContaining(["SIMULATION_FAILED", "KNOWN_MALICIOUS_ADDRESS"]),
    );
  });
});

describe("requests that cannot be what they say", () => {
  it("refuses the zero address as the sender, the user or the signer", async () => {
    const zero = "0x0000000000000000000000000000000000000000";
    await expect(
      analyze(tx({ from: zero, to: PEER, value: "1" }), deps(new FakeRpc())),
    ).rejects.toThrow(/zero address/);
    await expect(
      analyze({ ...tx({ to: PEER, value: "1" }), userWallet: zero }, deps(new FakeRpc())),
    ).rejects.toThrow(/zero address/);
    await expect(
      analyze(
        {
          network: "testnet",
          typedData: {
            signer: zero,
            domain: { verifyingContract: USDC, chainId: 10143 },
            types: {},
            primaryType: "Permit",
            message: { owner: zero, spender: DAPP, value: "1" },
          },
        },
        deps(new FakeRpc()),
      ),
    ).rejects.toThrow(/zero address/);
  });

  it("refuses a gas limit no Monad transaction can carry, as a bad request, not an outage", async () => {
    await expect(
      analyze(tx({ to: PEER, value: "1", gas: "99999999999999999999" }), deps(new FakeRpc())),
    ).rejects.toThrow(/gas limit .* above Monad testnet's limit/); // PARITY: the chain's registry name
    // The limit itself is a request the node can run.
    await expect(run(tx({ to: PEER, value: "1", gas: "30000000" }))).resolves.toBeDefined();
  });

  it("refuses a legacy transaction that names no chain id", async () => {
    const raw = serializeTransaction({
      type: "legacy",
      to: PEER,
      value: 1n,
      gas: 21_000n,
      gasPrice: 1n,
    });
    await expect(
      analyze({ network: "testnet", transaction: { raw }, userWallet: USER }, deps(new FakeRpc())),
    ).rejects.toThrow(/no chain id/);
  });

  it("warns when calldata goes to an account that has no code", async () => {
    const rpc = new FakeRpc();
    rpc.frame = frame({ to: DAPP, input: "0xa9059cbb0000" });
    const r = await run(tx({ to: DAPP, data: "0xa9059cbb0000" }), rpc);
    expect(codes(r)).toEqual(["CALL_TO_ADDRESS_WITHOUT_CODE"]);
    expect(r.findings[0]?.values).toEqual({ address: DAPP });
    expect(r.decision).toBe("caution");
    // A plain MON transfer to the same account is a transfer, not a call.
    rpc.frame = sendMon(DAPP, 1n);
    const plain = await run(tx({ to: DAPP, value: "1" }), rpc);
    expect(codes(plain)).not.toContain("CALL_TO_ADDRESS_WITHOUT_CODE");
  });
});

describe("collectibles in the balance changes", () => {
  const erc721Transfer = (from: Address, to: Address, tokenId: bigint) => {
    const base = transferLog(NFT, from, to, 0n);
    return {
      address: NFT,
      topics: [...base.topics, pad(`0x${tokenId.toString(16)}`, { size: 32 })],
      data: "0x",
    };
  };

  it("lists a minted piece as 1 of the collection with its token id", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(NFT, "0x60");
    rpc.meta.set(NFT, { symbol: "PIXEL", decimals: null } as never);
    rpc.frame = frame({
      to: NFT,
      value: `0x${(ONE_MON / 100n).toString(16)}`,
      input: "0xa0712d68",
      logs: [erc721Transfer("0x0000000000000000000000000000000000000000", USER, 7n)],
    });
    const r = await run(
      {
        ...tx({ to: NFT, value: (ONE_MON / 100n).toString(), data: "0xa0712d68" }),
        policy: policy({ blockUnknownContractExposure: false }),
      },
      rpc,
    );
    const piece = r.estimatedChanges.find((c) => c.asset.kind === "erc721");
    expect(piece).toEqual({
      account: USER,
      asset: { kind: "erc721", address: NFT, symbol: "PIXEL", decimals: 0, tokenId: "7" },
      before: null,
      after: null,
      delta: "1",
    });
    expect(r.estimatedChanges.find((c) => c.asset.kind === "native")).toBeDefined();
  });

  it("lists a piece that leaves, and nothing for one that comes straight back", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(NFT, "0x60");
    rpc.frame = frame({
      to: NFT,
      logs: [
        erc721Transfer(USER, PEER, 9n),
        erc721Transfer(PEER, USER, 11n),
        erc721Transfer(USER, PEER, 11n),
      ],
    });
    const r = await run(tx({ to: NFT, data: "0x42842e0e" }), rpc);
    const pieces = r.estimatedChanges.filter((c) => c.asset.kind === "erc721");
    expect(pieces.map((p) => [p.asset.tokenId, p.delta])).toEqual([["9", "-1"]]);
  });
});

describe("drainer techniques a wallet's own prompt lets through", () => {
  // Copies of USDC (0x2222...2222) and of the user (0x1111...1111): the
  // first and last four characters match, the middle does not.
  const USDC_COPY = getAddress("0x2222aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2222");
  const USER_COPY = getAddress("0x1111bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1111");
  const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
  const transferData = (to: Address, amount: bigint) =>
    calldata({ abi: KNOWN_FUNCTIONS, functionName: "transfer", args: [to, amount] });

  it("blocks a call to a contract that copies a known one", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(USDC_COPY, "0x60");
    rpc.frame = frame({ to: USDC_COPY, input: transferData(PEER, ONE_USDC) });
    const r = await run(tx({ to: USDC_COPY, data: transferData(PEER, ONE_USDC) }), rpc);
    const f = r.findings.find((x) => x.code === "LOOKALIKE_ADDRESS");
    expect(f?.values).toEqual({ address: USDC_COPY, expected: USDC });
    expect(f?.details).toEqual({ imitates: "known" });
    expect(f?.blocking).toBe(true);
    expect(r.decision).toBe("blocked");
  });

  it("blocks a send to an address that copies the sender's own (address poisoning)", async () => {
    const rpc = new FakeRpc();
    rpc.frame = sendMon(USER_COPY, ONE_MON);
    const r = await run(tx({ to: USER_COPY, value: ONE_MON.toString() }), rpc);
    const f = r.findings.find((x) => x.code === "LOOKALIKE_ADDRESS");
    expect(f?.values).toEqual({ address: USER_COPY, expected: USER });
    expect(f?.details).toEqual({ imitates: "self" });
    expect(r.decision).toBe("blocked");
  });

  it("shows a copy as Caution under Permissive", async () => {
    const rpc = new FakeRpc();
    rpc.frame = sendMon(USER_COPY, ONE_MON);
    const r = await run(
      {
        ...tx({ to: USER_COPY, value: ONE_MON.toString() }),
        policy: policy({ blockRiskyContracts: false }),
      },
      rpc,
    );
    expect(codes(r)).toContain("LOOKALIKE_ADDRESS");
    expect(r.decision).toBe("caution");
  });

  it("catches a permit whose spender copies another address in the same message", async () => {
    // The spender copies Permit2: a fake allowance manager.
    const fake = getAddress("0x000000000022d473cccccccccccccccccccc8BA3");
    const r = await run({
      network: "testnet",
      policy: policy(),
      typedData: {
        signer: USER,
        domain: { name: "USD Coin", verifyingContract: USDC, chainId: 10143 },
        types: {},
        primaryType: "Permit",
        message: { owner: USER, spender: fake, value: "1000000", nonce: 0, deadline: NOW + 60 },
      },
    });
    const f = r.findings.find((x) => x.code === "LOOKALIKE_ADDRESS");
    expect(f?.values).toEqual({ address: fake, expected: PERMIT2 });
  });

  it("blocks an allowance to a wallet (ice phishing), however small", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(USDC, "0x60");
    rpc.frame = frame({
      to: USDC,
      input: approveData(PEER, ONE_USDC),
      logs: [approvalLog(USDC, USER, PEER, ONE_USDC)],
    });
    const r = await run(tx({ to: USDC, data: approveData(PEER, ONE_USDC) }), rpc);
    const f = r.findings.find((x) => x.code === "APPROVAL_TO_WALLET");
    expect(f?.values).toEqual({ spender: PEER, contract: USDC });
    expect(f?.blocking).toBe(true);
    expect(r.decision).toBe("blocked");
  });

  it("does not report an allowance to a contract as one to a wallet", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(USDC, "0x60");
    rpc.code.set(DAPP, "0x60");
    rpc.frame = frame({
      to: USDC,
      input: approveData(DAPP, ONE_USDC),
      logs: [approvalLog(USDC, USER, DAPP, ONE_USDC)],
    });
    const r = await run(tx({ to: USDC, data: approveData(DAPP, ONE_USDC) }), rpc);
    expect(codes(r)).not.toContain("APPROVAL_TO_WALLET");
  });

  it("reports operator access and a single item granted to a wallet", async () => {
    const rpc = new FakeRpc();
    rpc.code.set(NFT, "0x60");
    const itemApproval = {
      ...approvalLog(NFT, USER, DRAINER, 0n),
      data: "0x" as const,
    };
    itemApproval.topics = [...itemApproval.topics, pad("0x07", { size: 32 })];
    rpc.frame = frame({
      to: NFT,
      logs: [
        log(
          NFT,
          "ApprovalForAll",
          { owner: USER, operator: PEER },
          { types: [{ type: "bool" }], values: [true] },
        ),
        itemApproval,
      ],
    });
    const r = await run(tx({ to: NFT, data: "0xa22cb465" }), rpc);
    const grants = r.findings.filter((x) => x.code === "APPROVAL_TO_WALLET");
    expect(grants.map((g) => g.values.spender).sort()).toEqual([PEER, DRAINER].sort());
    expect(codes(r)).toContain("NFT_OPERATOR_GRANTED");
  });

  it.each([
    ["increaseAllowance", [DAPP, maxUint256]],
    ["increaseApproval", [DAPP, maxUint256]],
  ])("reads %s to the maximum as an unlimited allowance", async (functionName, args) => {
    const rpc = new FakeRpc();
    rpc.code.set(DAPP, "0x60");
    const data = calldata({ abi: KNOWN_FUNCTIONS, functionName, args });
    const r = await run(tx({ to: USDC, data }), rpc);
    expect(codes(r)).toContain("ERC20_APPROVAL_UNLIMITED");
    expect(r.approvals[0]).toMatchObject({ contract: USDC, spender: DAPP, unlimited: true });
  });

  it("reads Permit2's on-chain allowance, with and without a trace", async () => {
    const data = calldata({
      abi: KNOWN_FUNCTIONS,
      functionName: "approve",
      args: [USDC, DAPP, 2n ** 160n - 1n, NOW + 3600],
    });
    for (const traced of [false, true]) {
      const rpc = new FakeRpc();
      rpc.code.set(DAPP, "0x60");
      rpc.code.set(PERMIT2, "0x60");
      if (traced) rpc.frame = frame({ to: PERMIT2, input: data });
      const r = await run(tx({ to: PERMIT2, data }), rpc);
      expect(codes(r)).toContain("ERC20_APPROVAL_UNLIMITED");
      expect(r.approvals).toEqual([
        expect.objectContaining({ contract: USDC, spender: DAPP, unlimited: true }),
      ]);
    }
  });
});

afterAll(() => {
  // Dead-code ban: every finding code is produced by at least one scenario above.
  const missing = FINDING_CODES.filter((c) => !emitted.has(c));
  expect(missing).toEqual([]);
});
