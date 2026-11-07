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
  receivers: ["shop.testnet"],
  limits: [["native", { per_transfer: NEAR.toString(), per_day: (3n * NEAR).toString() }]],
};

function fakeRpc(over: Partial<{ remaining: string; paused: boolean }> = {}): NearRpc {
  return {
    pin: async () => ({ height: 1234n, hash: "blockhash" }),
    viewAccount: async (id) => ACCOUNTS[id] ?? null,
    callView: async (contract, method, args) => {
      if (contract === "vault.testnet" && method === "get_policy")
        return { ...POLICY, paused: over.paused ?? false };
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
