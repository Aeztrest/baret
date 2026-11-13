import { getChain, policyContext } from "@baret/chains";
import { type ChainConfig, createPolicy } from "@baret/core";
import { describe, expect, it } from "vitest";
import {
  type AccountHistory,
  CODE_WINDOW_BLOCKS,
  createNearAdapter,
  FastNearHistory,
  HISTORY_SCAN_LIMIT,
  HistoryUnavailableError,
  type NearAccountState,
  type NearHistory,
  type NearRpc,
} from "./index.js";

/** TN.14: account age, past contacts and code changes of the request's counterparties. */

const chain = getChain("near:testnet") as ChainConfig;
const NEAR = 10n ** 24n;
const NO_CODE = "11111111111111111111111111111111";
const NOW_S = 1_800_000_000;
const DAY_MS = 24 * 3600 * 1000;
const HEIGHT = 2_000_000n;

const acct = (code = NO_CODE): NearAccountState => ({
  amount: 10n * NEAR,
  locked: 0n,
  hasCode: code !== NO_CODE,
  codeHash: code,
  storageUsage: 500n,
});

const ACCOUNTS: Record<string, NearAccountState> = {
  "alice.testnet": acct(),
  "old-shop.testnet": acct(),
  "new-shop.testnet": acct(),
  "dapp.testnet": acct("code-v2"),
  "steady.testnet": acct("code-v1"),
  "vault.testnet": acct("vault-code"),
};

function rpc(accounts = ACCOUNTS): NearRpc {
  return {
    pin: async () => ({ height: HEIGHT, hash: "final" }),
    viewAccount: async (id) => accounts[id] ?? null,
    callView: async () => null,
    viewAccessKey: async () => null,
    chainId: async () => "testnet",
  };
}

/** The archive: dapp ran other code before; steady the same; fresh-dapp did not exist. */
function archive(reads: (string | bigint)[] = []): NearRpc {
  return {
    ...rpc(),
    viewAccount: async (id, block) => {
      reads.push(block);
      if (id === "dapp.testnet") return acct("code-v1");
      if (id === "steady.testnet") return acct("code-v1");
      return null;
    },
  };
}

const HISTORY: Record<string, AccountHistory> = {
  "old-shop.testnet": { transactions: 40, firstSeenMs: NOW_S * 1000 - 30 * DAY_MS },
  "new-shop.testnet": { transactions: 2, firstSeenMs: NOW_S * 1000 - DAY_MS },
  "never-used.testnet": { transactions: 0, firstSeenMs: null },
};

function history(paid: string[] = ["old-shop.testnet"]): NearHistory {
  return {
    account: async (id) => HISTORY[id] ?? { transactions: 5, firstSeenMs: 0 },
    dealtWith: async (_a, b) => paid.includes(b),
  };
}

const failing: NearHistory = {
  account: async () => {
    throw new HistoryUnavailableError("down");
  },
  dealtWith: async () => false,
};

async function run(tx: unknown, deps: { history?: NearHistory; archive?: NearRpc }) {
  const adapter = createNearAdapter(() => ({
    rpc: rpc(),
    knownContracts: ["vault.testnet"],
    flagged: new Map(),
    mpcContracts: [],
    ...deps,
  }));
  return adapter.analyze({
    chain,
    request: adapter.requestSchema.parse({ kind: "transaction", tx }),
    account: null,
    policy: createPolicy("balanced", policyContext(chain)),
    payment: null,
    now: NOW_S,
  });
}

const pay = (to: string) => ({
  signerId: "alice.testnet",
  receiverId: to,
  actions: [{ type: "Transfer", deposit: (NEAR / 10n).toString() }],
});
const call = (contract: string) => ({
  signerId: "alice.testnet",
  receiverId: contract,
  actions: [
    { type: "FunctionCall", methodName: "go", args: {}, gas: "30000000000000", deposit: "0" },
  ],
});
const codes = (r: { drafts: { code: string }[] }) => r.drafts.map((d) => d.code).sort();

describe("NEAR counterparties", () => {
  it("passes a payment to an old receiver the signer has paid before", async () => {
    const r = await run(pay("old-shop.testnet"), { history: history() });
    expect(codes(r)).toEqual([]);
    expect(r.sources).toContainEqual({ name: "near-history", status: "ok" });
  });

  it("names a receiver first used a day ago, and the first payment to it", async () => {
    const r = await run(pay("new-shop.testnet"), { history: history() });
    expect(codes(r)).toEqual(["COUNTERPARTY_FIRST_PAYMENT", "REPUTATION_FRESH_ACCOUNT"]);
    const fresh = r.drafts.find((d) => d.code === "REPUTATION_FRESH_ACCOUNT");
    expect(fresh?.values).toEqual({ address: "new-shop.testnet" });
    expect(fresh?.details).toEqual({
      transactions: 2,
      firstSeenAt: new Date(NOW_S * 1000 - DAY_MS).toISOString(),
    });
  });

  it("calls an account with no transaction at all fresh", async () => {
    const accounts = { ...ACCOUNTS, "never-used.testnet": acct() };
    const adapter = createNearAdapter(() => ({
      rpc: rpc(accounts),
      knownContracts: [],
      flagged: new Map(),
      mpcContracts: [],
      history: history(),
    }));
    const r = await adapter.analyze({
      chain,
      request: adapter.requestSchema.parse({ kind: "transaction", tx: pay("never-used.testnet") }),
      account: null,
      policy: createPolicy("balanced", policyContext(chain)),
      payment: null,
      now: NOW_S,
    });
    expect(codes(r)).toContain("REPUTATION_FRESH_ACCOUNT");
  });

  it("does not treat Baret's own contracts or the signer as counterparties", async () => {
    const r = await run(pay("vault.testnet"), { history: failing, archive: archive() });
    expect(codes(r)).not.toContain("COUNTERPARTY_HISTORY_UNAVAILABLE");
    expect(r.sources.map((s) => s.name)).not.toContain("near-history");
  });

  it("is a Caution, never a pass, when the history does not load", async () => {
    const r = await run(pay("old-shop.testnet"), { history: failing });
    expect(codes(r)).toEqual(["COUNTERPARTY_HISTORY_UNAVAILABLE"]);
    expect(r.sources).toContainEqual({ name: "near-history", status: "unavailable" });
  });

  it("says the history was skipped when the network has no index", async () => {
    const r = await run(pay("old-shop.testnet"), {});
    expect(codes(r)).toEqual([]);
    expect(r.sources).toContainEqual({ name: "near-history", status: "skipped" });
  });

  it("names a contract whose code changed in the window, at least 72 hours back", async () => {
    const reads: (string | bigint)[] = [];
    const r = await run(call("dapp.testnet"), { archive: archive(reads) });
    expect(codes(r)).toContain("CONTRACT_CODE_CHANGED_RECENTLY");
    expect(reads).toEqual([HEIGHT - CODE_WINDOW_BLOCKS]);
    expect(r.sources).toContainEqual({ name: "near-archival-rpc", status: "ok" });
  });

  it("leaves a contract with the same code alone", async () => {
    const r = await run(call("steady.testnet"), { archive: archive() });
    expect(codes(r)).not.toContain("CONTRACT_CODE_CHANGED_RECENTLY");
  });

  it("tries the next lower height when the node has no block at one", async () => {
    const reads: (string | bigint)[] = [];
    const flaky: NearRpc = {
      ...archive(reads),
      viewAccount: async (id, block) => {
        reads.push(block);
        if (block === HEIGHT - CODE_WINDOW_BLOCKS) throw new Error("UNKNOWN_BLOCK");
        return id === "dapp.testnet" ? acct("code-v1") : null;
      },
    };
    const r = await run(call("dapp.testnet"), { archive: flaky });
    expect(reads).toEqual([HEIGHT - CODE_WINDOW_BLOCKS, HEIGHT - CODE_WINDOW_BLOCKS - 1n]);
    expect(codes(r)).toContain("CONTRACT_CODE_CHANGED_RECENTLY");
  });

  it("is a Caution when the archival node does not answer", async () => {
    const down: NearRpc = {
      ...rpc(),
      viewAccount: async () => {
        throw new Error("down");
      },
    };
    const r = await run(call("steady.testnet"), { archive: down });
    expect(codes(r)).toContain("COUNTERPARTY_HISTORY_UNAVAILABLE");
  });
});

describe("FastNearHistory", () => {
  type Body = { account_id: string; desc?: boolean; limit?: number; resume_token?: string };
  const tx = (h: string, ns = "1700000000000000000") => ({
    transaction_hash: h,
    tx_block_timestamp: ns,
  });

  function fake(pages: Record<string, { hashes: string[]; total: number }>, calls: Body[] = []) {
    return (async (_url: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body)) as Body;
      calls.push(b);
      const all = pages[b.account_id] ?? { hashes: [], total: 0 };
      const start = b.resume_token ? Number(b.resume_token) : 0;
      const limit = b.limit ?? 200;
      const list = (b.desc === false ? [...all.hashes].reverse() : all.hashes).slice(
        start,
        start + limit,
      );
      return new Response(
        JSON.stringify({
          account_txs: list.map((h) => tx(h)),
          txs_count: all.total,
          resume_token: String(start + limit),
        }),
      );
    }) as typeof fetch;
  }

  it("reads an account's count and its first transaction", async () => {
    const calls: Body[] = [];
    const h = new FastNearHistory(
      "https://tx",
      1000,
      fake({ "a.testnet": { hashes: ["new", "old"], total: 2 } }, calls),
    );
    expect(await h.account("a.testnet")).toEqual({
      transactions: 2,
      firstSeenMs: 1_700_000_000_000,
    });
    expect(calls[0]).toEqual({ account_id: "a.testnet", desc: false, limit: 1 });
    expect(await h.account("none.testnet")).toEqual({ transactions: 0, firstSeenMs: null });
  });

  it("finds a transaction both accounts share, across pages, up to the scan limit", async () => {
    const many = Array.from({ length: 450 }, (_, i) => `t${i}`);
    const calls: Body[] = [];
    const h = new FastNearHistory(
      "https://tx",
      1000,
      fake(
        {
          "agent.testnet": { hashes: many, total: 450 },
          "shop.testnet": { hashes: ["x", "t420"], total: 2 },
          "stranger.testnet": { hashes: ["y"], total: 1 },
        },
        calls,
      ),
    );
    expect(await h.dealtWith("agent.testnet", "shop.testnet")).toBe(true);
    expect(calls.filter((c) => c.account_id === "agent.testnet")).toHaveLength(3);
    expect(await h.dealtWith("agent.testnet", "stranger.testnet")).toBe(false);
    expect(HISTORY_SCAN_LIMIT).toBe(1000);
  });

  it("throws HistoryUnavailableError on an HTTP error or a strange answer", async () => {
    const bad = new FastNearHistory(
      "https://tx",
      1000,
      (async () => new Response("no", { status: 503 })) as typeof fetch,
    );
    await expect(bad.account("a.testnet")).rejects.toBeInstanceOf(HistoryUnavailableError);
    const odd = new FastNearHistory(
      "https://tx",
      1000,
      (async () => new Response("{}")) as typeof fetch,
    );
    await expect(odd.account("a.testnet")).rejects.toBeInstanceOf(HistoryUnavailableError);
  });
});
