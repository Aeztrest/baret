import { getChain } from "@baret/chains";
import type { ChainConfig } from "@baret/core";
import { describe, expect, it } from "vitest";
import {
  createNearAdapter,
  MPC_CONTRACTS,
  type NearAccountState,
  type NearRpc,
  vaultRefusal,
} from "./index.js";

/**
 * The NEAR adapter end to end through a stub engine-shaped call: the adapter's drafts
 * decided by the real `decide()` rules are covered in packages/engine; here we check the
 * drafts, the preflight and the effects against a fake RPC.
 */

const chain = getChain("near:testnet") as ChainConfig;
const NEAR = 10n ** 24n;
const USDC = "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af";

const ACCOUNTS: Record<string, NearAccountState> = {
  "alice.testnet": { amount: 10n * NEAR, locked: 0n, hasCode: false, storageUsage: 500n },
  "shop.testnet": { amount: NEAR, locked: 0n, hasCode: false, storageUsage: 500n },
  "vault.testnet": { amount: 50n * NEAR, locked: 0n, hasCode: true, storageUsage: 9000n },
  "agent.testnet": { amount: NEAR, locked: 0n, hasCode: false, storageUsage: 500n },
  "random-dapp.testnet": { amount: NEAR, locked: 0n, hasCode: true, storageUsage: 9000n },
  "v1.signer-prod.testnet": { amount: NEAR, locked: 0n, hasCode: true, storageUsage: 9000n },
  [USDC]: { amount: NEAR, locked: 0n, hasCode: true, storageUsage: 9000n },
};

const POLICY = {
  owner: "alice.testnet",
  paused: false,
  agents: ["agent.testnet"],
  receivers: ["shop.testnet", "0x5bb6ff1fcbe31ed8fbce6805852ce279475522fc"],
  limits: [
    ["native", { per_transfer: NEAR.toString(), per_day: (3n * NEAR).toString() }],
    [
      "eip155:10143",
      { per_transfer: (10n ** 17n).toString(), per_day: (3n * 10n ** 17n).toString() },
    ],
  ],
};

/** What the vault's get_evm_payload answers (contracts/near/vault/src/evm.rs). */
function evmParts(tx: Record<string, string | number>) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(tx.to))) return null;
  return {
    payload: "ab".repeat(32),
    asset: `eip155:${tx.chain_id}`,
    receiver: String(tx.to).toLowerCase(),
    max_cost: (
      BigInt(tx.value ?? 0) +
      BigInt(tx.max_fee_per_gas ?? 0) * BigInt(tx.gas_limit ?? 0)
    ).toString(),
    path: "eip155",
  };
}

function fakeRpc(over: Partial<{ remaining: string; paused: boolean }> = {}): NearRpc {
  return {
    pin: async () => ({ height: 1234n, hash: "blockhash" }),
    viewAccount: async (id) => ACCOUNTS[id] ?? null,
    callView: async (contract, method, args) => {
      if (contract === "vault.testnet" && method === "get_policy")
        return { ...POLICY, paused: over.paused ?? false };
      if (contract === "vault.testnet" && method === "get_evm_payload")
        return evmParts((args as { tx: Record<string, string | number> }).tx);
      if (contract === "vault.testnet" && method === "get_remaining")
        return over.remaining ?? (2n * NEAR).toString();
      if (contract === USDC && method === "ft_balance_of") {
        return (args as { account_id: string }).account_id === "alice.testnet" ? "20000000" : "0";
      }
      return null;
    },
    chainId: async () => "testnet",
  };
}

const adapter = (rpc = fakeRpc(), flagged = new Map<string, string>()) =>
  createNearAdapter(() => ({
    rpc,
    knownContracts: ["vault.testnet"],
    flagged,
    mpcContracts: MPC_CONTRACTS["near:testnet"] ?? [],
  }));

async function run(
  tx: unknown,
  extra: Partial<{ payment: unknown; rpc: NearRpc; flagged: Map<string, string> }> = {},
) {
  const { createPolicy } = await import("@baret/core");
  const { policyContext } = await import("@baret/chains");
  const a = adapter(extra.rpc, extra.flagged);
  const request = a.requestSchema.parse({ kind: "transaction", tx });
  return a.analyze({
    chain,
    request,
    account: null,
    policy: createPolicy("balanced", policyContext(chain)),
    payment: (extra.payment as never) ?? null,
    now: 1_800_000_000,
  });
}

const codes = (r: { drafts: { code: string }[] }) => r.drafts.map((d) => d.code).sort();

describe("NEAR adapter", () => {
  it("passes a plain transfer and shows what leaves", async () => {
    const r = await run({
      signerId: "alice.testnet",
      receiverId: "shop.testnet",
      actions: [{ type: "Transfer", deposit: NEAR.toString() }],
    });
    expect(codes(r)).toEqual([]);
    expect(r.simulation).toBe("preflight");
    expect(r.pinnedAt).toEqual({ kind: "block", value: "1234" });
    expect(r.estimatedChanges).toContainEqual(
      expect.objectContaining({ account: "near:testnet:alice.testnet", delta: (-NEAR).toString() }),
    );
  });

  it("calls a full access key a change of control, and a function call key a limited key", async () => {
    const r = await run({
      signerId: "alice.testnet",
      receiverId: "alice.testnet",
      actions: [
        { type: "AddKey", publicKey: "ed25519:attacker", accessKey: "FullAccess" },
        {
          type: "AddKey",
          publicKey: "ed25519:agent",
          accessKey: {
            receiverId: "vault.testnet",
            methodNames: ["execute_transfer"],
            allowance: "250000000000000000000000",
          },
        },
      ],
    });
    expect(codes(r)).toEqual(["AUTHORITY_CHANGE", "FUNCTION_CALL_KEY_ADDED"]);
    expect(r.drafts.find((d) => d.code === "FUNCTION_CALL_KEY_ADDED")?.values).toEqual({
      contract: "vault.testnet",
      amount: "0.25",
      asset: "NEAR",
    });
  });

  it("flags deleting the account and deploying code", async () => {
    const r = await run({
      signerId: "alice.testnet",
      receiverId: "alice.testnet",
      actions: [
        { type: "DeployContract" },
        { type: "DeleteAccount", beneficiaryId: "attacker.testnet" },
      ],
    });
    expect(codes(r)).toContain("ACCOUNT_DELETE_DETECTED");
    expect(codes(r)).toContain("CONTRACT_DEPLOY_DETECTED");
  });

  it("predicts the vault's refusal before anything is signed", async () => {
    const r = await run({
      signerId: "agent.testnet",
      receiverId: "vault.testnet",
      actions: [
        {
          type: "FunctionCall",
          methodName: "execute_transfer",
          args: { asset: "native", receiver: "attacker.testnet", amount: NEAR.toString() },
          gas: "30000000000000",
          deposit: "0",
        },
      ],
    });
    const failed = r.drafts.find((d) => d.code === "SIMULATION_FAILED");
    expect(failed?.details).toEqual({ reason: "E_RECEIVER_NOT_ALLOWED" });
  });

  it("lets an allowed vault payment through and shows the vault paying, not the agent", async () => {
    const r = await run({
      signerId: "agent.testnet",
      receiverId: "vault.testnet",
      actions: [
        {
          type: "FunctionCall",
          methodName: "execute_transfer",
          args: { asset: "native", receiver: "shop.testnet", amount: NEAR.toString() },
          gas: "30000000000000",
          deposit: "0",
        },
      ],
    });
    expect(codes(r)).toEqual([]);
    expect(r.estimatedChanges).toContainEqual(
      expect.objectContaining({ account: "near:testnet:vault.testnet", delta: (-NEAR).toString() }),
    );
  });

  it("knows the vault's daily limit from its remaining allowance", async () => {
    const r = await run(
      {
        signerId: "agent.testnet",
        receiverId: "vault.testnet",
        actions: [
          {
            type: "FunctionCall",
            methodName: "execute_transfer",
            args: { asset: "native", receiver: "shop.testnet", amount: NEAR.toString() },
            gas: "30000000000000",
            deposit: "0",
          },
        ],
      },
      { rpc: fakeRpc({ remaining: "1" }) },
    );
    expect(r.drafts.find((d) => d.code === "SIMULATION_FAILED")?.details).toEqual({
      reason: "E_DAILY_LIMIT",
    });
  });

  it("refuses a vault asset that is neither native nor a token contract", async () => {
    // A CAIP-19 id here once ended as an invalid asset id in the answer (a 500).
    const r = await run({
      signerId: "agent.testnet",
      receiverId: "vault.testnet",
      actions: [
        {
          type: "FunctionCall",
          methodName: "execute_transfer",
          args: { asset: "near:testnet/slip44:397", receiver: "shop.testnet", amount: "1" },
          gas: "30000000000000",
          deposit: "0",
        },
      ],
    });
    expect(r.drafts.find((d) => d.code === "SIMULATION_FAILED")?.details).toEqual({
      reason: "E_ASSET_NOT_ALLOWED",
    });
    expect(r.estimatedChanges.every((c) => !c.asset.id.includes("slip44:397/"))).toBe(true);
  });

  describe("Chain Signatures through the vault (TN.7)", () => {
    const evm = (over: Record<string, unknown> = {}) => ({
      signerId: "agent.testnet",
      receiverId: "vault.testnet",
      actions: [
        {
          type: "FunctionCall",
          methodName: "request_evm_signature",
          args: {
            tx: {
              chain_id: 10143,
              nonce: 0,
              max_priority_fee_per_gas: "2000000000",
              max_fee_per_gas: "60000000000",
              gas_limit: 21000,
              to: "0x5BB6fF1FCbE31ED8FBce6805852Ce279475522fc",
              value: "10000000000000000",
              ...over,
            },
          },
          gas: "300000000000000",
          deposit: "0",
        },
      ],
    });

    it("lets an EVM payment within the vault's policy through", async () => {
      expect(codes(await run(evm()))).toEqual([]);
    });

    it("predicts the refusal of an EVM receiver the owner never listed", async () => {
      const r = await run(evm({ to: "0x000000000000000000000000000000000000dEaD" }));
      expect(r.drafts.find((d) => d.code === "SIMULATION_FAILED")?.details).toEqual({
        reason: "E_RECEIVER_NOT_ALLOWED",
      });
    });

    it("counts the worst-case fee like the vault does", async () => {
      // Exactly the per-transfer limit in value: the fee on top crosses it.
      const r = await run(evm({ value: (10n ** 17n).toString() }));
      expect(r.drafts.find((d) => d.code === "SIMULATION_FAILED")?.details).toEqual({
        reason: "E_PER_TRANSFER_LIMIT",
      });
    });

    it("refuses a malformed EVM transfer and an EVM chain with no limit", async () => {
      const bad = await run(evm({ to: "0x12" }));
      expect(bad.drafts.find((d) => d.code === "SIMULATION_FAILED")?.details).toEqual({
        reason: "E_BAD_EVM_TX",
      });
      const chain1 = await run(evm({ chain_id: 1 }));
      expect(chain1.drafts.find((d) => d.code === "SIMULATION_FAILED")?.details).toEqual({
        reason: "E_ASSET_NOT_ALLOWED",
      });
    });
  });

  describe("NEAR Intents quotes (TN.8)", () => {
    const DEPOSIT = "0abb20418af35c7061cde7cd51effdfc0222852f8c63ea60104b26d773d6487a";
    const WRAP = "wrap.testnet";
    const quote = (over: { quote?: object; quoteRequest?: object } = {}) => ({
      quote: {
        amountIn: NEAR.toString(),
        amountOut: "3568328",
        amountInUsd: "3.56",
        amountOutUsd: "3.55",
        depositAddress: DEPOSIT,
        deadline: "2030-01-01T00:00:00.000Z",
        ...over.quote,
      },
      quoteRequest: {
        dry: false,
        originAsset: `nep141:${WRAP}`,
        destinationAsset: `nep141:${USDC}`,
        recipient: "alice.testnet",
        refundTo: "alice.testnet",
        appFees: [],
        ...over.quoteRequest,
      },
    });
    const deposit = (amount = NEAR) => ({
      signerId: "alice.testnet",
      receiverId: WRAP,
      actions: [
        {
          type: "FunctionCall",
          methodName: "ft_transfer",
          args: { receiver_id: DEPOSIT, amount: amount.toString() },
          gas: "30000000000000",
          deposit: "1",
        },
      ],
    });
    const runQuote = async (tx: unknown, intents: unknown) => {
      const { createPolicy } = await import("@baret/core");
      const { policyContext } = await import("@baret/chains");
      const rpc = fakeRpc();
      const base = rpc.viewAccount;
      rpc.viewAccount = async (id) =>
        id === WRAP
          ? { amount: NEAR, locked: 0n, hasCode: true, storageUsage: 9000n }
          : base(id, "blockhash");
      const a = adapter(rpc);
      return a.analyze({
        chain,
        request: a.requestSchema.parse({ kind: "transaction", tx, intents }),
        account: null,
        policy: createPolicy("balanced", policyContext(chain)),
        payment: null,
        now: 1_800_000_000,
      });
    };

    it("lets a deposit that matches a quote paying the signer through, wNEAR known", async () => {
      expect(codes(await runQuote(deposit(), quote()))).toEqual([]);
    });

    it("shows an app fee the quote adds", async () => {
      const r = await runQuote(
        deposit(),
        quote({ quoteRequest: { appFees: [{ recipient: "app.testnet", fee: 20 }] } }),
      );
      expect(r.drafts.find((d) => d.code === "INTENTS_APP_FEE")?.values).toEqual({
        amount: "0.2%",
        recipient: "app.testnet",
      });
    });

    it("blocks a quote that pays out or refunds to someone else", async () => {
      const r = await runQuote(
        deposit(),
        quote({ quoteRequest: { recipient: "attacker.testnet", refundTo: "attacker.testnet" } }),
      );
      const found = r.drafts.find((d) => d.code === "INTENTS_RECIPIENT_MISMATCH");
      expect(found?.details).toMatchObject({ fields: ["recipient", "refundTo"] });
      expect(found?.values).toEqual({ recipient: "attacker.testnet", address: "alice.testnet" });
      const refundOnly = await runQuote(
        deposit(),
        quote({ quoteRequest: { refundTo: "attacker.testnet" } }),
      );
      expect(
        refundOnly.drafts.find((d) => d.code === "INTENTS_RECIPIENT_MISMATCH")?.details,
      ).toMatchObject({ fields: ["refundTo"] });
    });

    it("blocks a deposit that does not match the quote", async () => {
      const r = await runQuote(deposit(2n * NEAR), quote());
      expect(codes(r)).toContain("INTENTS_DEPOSIT_MISMATCH");
    });

    it("fails closed on a dry or expired quote", async () => {
      // The deposit then counts as a plain transfer out, so the loss rule fails closed too.
      expect(codes(await runQuote(deposit(), quote({ quoteRequest: { dry: true } })))).toContain(
        "INTENTS_QUOTE_INVALID",
      );
      expect(
        codes(await runQuote(deposit(), quote({ quote: { deadline: "2020-01-01T00:00:00Z" } }))),
      ).toContain("INTENTS_QUOTE_INVALID");
    });

    it("measures the loss from the quote's prices, not the whole deposit", async () => {
      // Balanced allows 50 %: a fair swap passes, half the value gone does not.
      const fair = await runQuote(deposit(), quote());
      expect(codes(fair)).not.toContain("ESTIMATED_LOSS_EXCEEDS_MAX");
      const bad = await runQuote(deposit(), quote({ quote: { amountOutUsd: "1.00" } }));
      expect(codes(bad)).toContain("ESTIMATED_LOSS_EXCEEDS_MAX");
      const noPrices = await runQuote(
        deposit(),
        quote({ quote: { amountInUsd: undefined, amountOutUsd: undefined } }),
      );
      expect(codes(noPrices)).toContain("LOSS_PERCENT_UNAVAILABLE");
    });
  });

  it("reads a NEP-141 transfer, its balance, and an unknown contract", async () => {
    const r = await run({
      signerId: "alice.testnet",
      receiverId: USDC,
      actions: [
        {
          type: "FunctionCall",
          methodName: "ft_transfer",
          args: { receiver_id: "shop.testnet", amount: "5000000" },
          gas: "30000000000000",
          deposit: "1",
        },
      ],
    });
    expect(codes(r)).toEqual([]);
    expect(r.estimatedChanges).toContainEqual(
      expect.objectContaining({
        delta: "-5000000",
        asset: expect.objectContaining({ symbol: "USDC" }),
      }),
    );
    const unknown = await run({
      signerId: "alice.testnet",
      receiverId: "random-dapp.testnet",
      actions: [{ type: "FunctionCall", methodName: "do_it", args: {}, gas: "1", deposit: "0" }],
    });
    expect(codes(unknown)).toEqual(["UNKNOWN_CONTRACT_EXPOSURE"]);
  });

  it("fails a call to an account with no contract, and a transfer above the balance", async () => {
    const noCode = await run({
      signerId: "alice.testnet",
      receiverId: "shop.testnet",
      actions: [{ type: "FunctionCall", methodName: "x", args: {}, gas: "1", deposit: "0" }],
    });
    expect(noCode.drafts[0]?.details).toEqual({ reason: "E_NO_CONTRACT" });
    const tooMuch = await run({
      signerId: "alice.testnet",
      receiverId: "shop.testnet",
      actions: [{ type: "Transfer", deposit: (100n * NEAR).toString() }],
    });
    expect(tooMuch.drafts[0]?.details).toEqual({ reason: "E_INSUFFICIENT_NEAR" });
  });

  it("names a Chain Signatures request and a reported receiver", async () => {
    const sig = await run({
      signerId: "alice.testnet",
      receiverId: "v1.signer-prod.testnet",
      actions: [
        {
          type: "FunctionCall",
          methodName: "sign",
          args: { request: { payload_v2: { Ecdsa: "00" }, path: "base-1", domain_id: 0 } },
          gas: "300000000000000",
          deposit: "1",
        },
      ],
    });
    expect(sig.drafts.find((d) => d.code === "CHAIN_SIGNATURE_REQUEST")?.values).toEqual({
      path: "base-1",
      contract: "v1.signer-prod.testnet",
    });
    const bad = await run(
      {
        signerId: "alice.testnet",
        receiverId: "shop.testnet",
        actions: [{ type: "Transfer", deposit: "1" }],
      },
      { flagged: new Map([["shop.testnet", "DEMO_DRAINER"]]) },
    );
    expect(codes(bad)).toEqual(["KNOWN_MALICIOUS_ADDRESS"]);
  });

  it("checks an agent payment against the 402: wrong payee, caps", async () => {
    const payment = {
      origin: "https://shop.example",
      requirements: {
        scheme: "exact",
        network: "near:testnet",
        payTo: "shop.testnet",
        asset: `near:testnet/nep141:${USDC}`,
        amount: "5000000",
      },
      spendHistory: [],
    };
    const r = await run(
      {
        signerId: "alice.testnet",
        receiverId: USDC,
        actions: [
          {
            type: "FunctionCall",
            methodName: "ft_transfer",
            args: { receiver_id: "attacker.testnet", amount: "5000000" },
            gas: "30000000000000",
            deposit: "1",
          },
        ],
      },
      { payment },
    );
    expect(codes(r)).toContain("X402_DESTINATION_MISMATCH");
  });

  it("answers health for the configured network only", async () => {
    expect((await adapter().health(chain)).rightChain).toBe(true);
    const mainnet = getChain("near:mainnet") as ChainConfig;
    expect((await adapter().health(mainnet)).rightChain).toBe(false);
  });

  it("orders the vault's checks like the contract", () => {
    const m = { from: "vault.testnet", to: "shop.testnet", asset: "native", amount: 1n };
    expect(vaultRefusal({ ...POLICY, paused: true } as never, "agent.testnet", m, null)).toBe(
      "E_PAUSED",
    );
    expect(vaultRefusal(POLICY as never, "x.testnet", m, null)).toBe("E_NOT_AGENT");
    expect(vaultRefusal(POLICY as never, "agent.testnet", { ...m, asset: USDC }, null)).toBe(
      "E_ASSET_NOT_ALLOWED",
    );
    expect(vaultRefusal(POLICY as never, "agent.testnet", m, null)).toBeNull();
  });
});
