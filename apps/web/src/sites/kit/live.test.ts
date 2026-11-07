import { findings } from "@baret/content";
import { FINDING_CODES, type Verdict } from "@baret/core";
import { FAILED } from "@baret/web-ui/lib/check";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyze,
  changeOf,
  displayAmount,
  fromVerdict,
  orderFindings,
  shortAddress,
} from "./live.js";

const CHAIN = "eip155:10143";
const WALLET = "0x7a3f9e21c84b5d06f13a2e9b7c40d58e6f21c21e";
const OTHER = "0xac9517a70c88480c9fA7E9a280DA485F7f552C29";
const SPENDER = "0xeB9EBB97BcD146FF1a4424490cbE8e19b7983888";
const DUSDC = {
  id: `${CHAIN}/erc20:${OTHER}`,
  kind: "fungible",
  symbol: "dUSDC",
  decimals: 6,
} as const;

afterEach(() => vi.unstubAllGlobals());

function verdict(over: Partial<Verdict> = {}): Verdict {
  return {
    decision: "blocked",
    findings: [
      {
        code: "APPROVAL_UNLIMITED",
        severity: "high",
        values: { spender: SPENDER, asset: "dUSDC", amount: "20" },
        blocking: true,
      },
    ],
    firedRules: [],
    suggestions: [],
    confidence: "high",
    estimatedChanges: [
      {
        account: `${CHAIN}:${WALLET.toUpperCase().replace("0X", "0x")}`,
        asset: { id: `${CHAIN}/slip44:60`, kind: "native", symbol: "MON", decimals: 18 },
        before: null,
        after: null,
        delta: "-2500000000000000000",
      },
      { account: `${CHAIN}:${WALLET}`, asset: DUSDC, before: null, after: null, delta: "8000000" },
      { account: `${CHAIN}:${OTHER}`, asset: DUSDC, before: null, after: null, delta: "-8000000" },
    ],
    allowances: [
      {
        owner: `${CHAIN}:${WALLET}`,
        spender: `${CHAIN}:${SPENDER}`,
        asset: DUSDC,
        amount: null,
        unlimited: true,
        scope: "token",
        via: "transaction",
        expiresAt: null,
      },
    ],
    sources: [],
    chain: CHAIN,
    pinnedAt: null,
    expiresAt: 1_800_000_000,
    meta: {
      requestId: "r1",
      engineVersion: "0.2.0",
      adapterVersion: "0.2.0",
      simulation: "trace",
      analyzedAt: "2026-11-08T00:00:00Z",
    },
    ...over,
  };
}

describe("live answer (v2 verdict)", () => {
  it("shows amounts short: up to four decimals, no trailing zeros, BigInt maths only", () => {
    expect(displayAmount(2_500_000_000_000_000_000n, 18)).toBe("2.5");
    expect(displayAmount(123_456_789n, 6)).toBe("123.4567");
    expect(displayAmount(10n ** 30n, 18)).toBe("1000000000000");
    expect(shortAddress(OTHER)).toBe("0xac95...2C29");
  });

  it("names a token by symbol, else by its shortened contract; a piece by its id", () => {
    expect(changeOf(5_000_000n, { ...DUSDC, symbol: null })).toEqual({
      value: "5",
      unit: "0xac95...2C29",
    });
    expect(
      changeOf(1n, {
        id: `${CHAIN}/erc721:${OTHER}`,
        kind: "nft",
        symbol: "NIGHT",
        decimals: 0,
        tokenId: "7",
      }),
    ).toEqual({ value: "1", unit: "NIGHT #7" });
    expect(changeOf(1n, { kind: "mystery" })).toEqual({ value: "1", unit: "" });
  });

  it("keeps the visitor's own changes and allowances, whatever the address case", () => {
    const result = fromVerdict(verdict(), WALLET);
    expect(result.changes).toEqual([
      { direction: "out", value: "2.5", unit: "MON" },
      { direction: "in", value: "8", unit: "dUSDC" },
    ]);
    expect(result.approvals).toEqual([
      { unit: "dUSDC", spender: SPENDER, unlimited: true, amount: null },
    ]);
    expect(result.requestId).toBe("r1");
    expect(result.verdict).toBe("blocked");
  });

  it("puts the blocking finding first, then the most severe, else keeps the order", () => {
    const list = [
      { code: "a", severity: "low", blocking: false },
      { code: "b", severity: "high", blocking: false },
      { code: "c", severity: "low", blocking: true },
    ];
    expect(orderFindings(list).map((f) => f.code)).toEqual(["c", "b", "a"]);
  });

  it("posts the body to /api/v1/analyze as given and maps a valid answer", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(verdict()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = { chain: CHAIN, request: { kind: "call", tx: { from: WALLET } } } as const;
    const result = await analyze(body, WALLET, new AbortController().signal);
    expect(result.source).toBe("live");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/analyze");
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it("treats an error status or an answer off the contract as Blocked", async () => {
    const body = { chain: CHAIN, request: {} } as const;
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
    expect(await analyze(body, WALLET, new AbortController().signal)).toBe(FAILED);
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ decision: "safe" }), { status: 200 }),
    );
    expect(await analyze(body, WALLET, new AbortController().signal)).toBe(FAILED);
  });

  it("has words for every finding code the server can send", () => {
    for (const code of FINDING_CODES) expect(findings[code].title, code).toBeTruthy();
  });
});
