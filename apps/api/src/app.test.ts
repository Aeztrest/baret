import { getChain } from "@baret/chains";
import {
  type AdapterResult,
  type ChainConfig,
  ChainUnavailableError,
  type EngineAdapter,
  InvalidRequestError,
} from "@baret/core";
import { createEngine } from "@baret/engine";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildApp } from "./app.js";
import { clientOf } from "./client.js";
import { loadConfig } from "./config.js";

const MONAD = getChain("eip155:10143") as ChainConfig;
const USER = "0x00000000000000000000000000000000000000a1";

/** An adapter that answers whatever the test sets, so the HTTP layer is tested alone. */
function fakeAdapter(answer: () => Promise<AdapterResult>): EngineAdapter {
  return {
    family: "evm",
    version: "test",
    requestSchema: z.object({ kind: z.literal("call") }).passthrough(),
    analyze: answer,
    health: async () => ({ reachable: true, rightChain: true, simulation: "trace" }),
  };
}
const clean: AdapterResult = {
  drafts: [],
  estimatedChanges: [],
  allowances: [],
  sources: [{ name: "rpc", status: "ok" }],
  pinnedAt: { kind: "block", value: "1" },
  simulation: "trace",
  confidence: "high",
};

let app: FastifyInstance | null = null;
afterEach(async () => {
  await app?.close();
  app = null;
});

async function start(
  answer: () => Promise<AdapterResult> = async () => clean,
  apiKeys: string[] = [],
) {
  app = await buildApp({
    config: {
      logLevel: "silent",
      apiKeys,
      corsOrigins: [],
      rateLimitPerMinute: 1000,
      proxyTrust: { directHops: null, edgeHops: null, edgeSecret: null },
    },
    engine: createEngine({
      adapters: { evm: fakeAdapter(answer) },
      chains: [MONAD],
      verdictTtlSeconds: 30,
      now: () => 1_800_000_000,
    }),
    health: async () => ({ reachable: true, rightChain: true, simulation: "trace" }),
  });
  return app;
}

const body = {
  chain: "eip155:10143",
  request: { kind: "call", tx: { from: USER } },
  policyTemplate: "balanced",
};

describe("POST /v1/analyze", () => {
  it("answers a verdict", async () => {
    const res = await (await start()).inject({ method: "POST", url: "/v1/analyze", payload: body });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ decision: "safe", chain: "eip155:10143" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("is 400 for a body off the schema, an unserved chain, and a bad request", async () => {
    const a = await start(async () => {
      throw new InvalidRequestError("the sender cannot be the zero address");
    });
    const off = await a.inject({ method: "POST", url: "/v1/analyze", payload: { chain: "x" } });
    expect(off.statusCode).toBe(400);
    expect(off.json().error.code).toBe("invalid_request");
    const chain = await a.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { ...body, chain: "eip155:8453" },
    });
    expect(chain.json().error.code).toBe("chain_unsupported");
    const bad = await a.inject({ method: "POST", url: "/v1/analyze", payload: body });
    expect(bad.json()).toEqual({
      error: { code: "invalid_request", message: "the sender cannot be the zero address" },
    });
  });

  it("is 503 and never a verdict when the chain cannot be read", async () => {
    const a = await start(async () => {
      throw new ChainUnavailableError("node down");
    });
    const res = await a.inject({ method: "POST", url: "/v1/analyze", payload: body });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("rpc_unavailable");
  });

  it("hides an unexpected error's message", async () => {
    const a = await start(async () => {
      throw new Error("secret internal detail");
    });
    const res = await a.inject({ method: "POST", url: "/v1/analyze", payload: body });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("secret");
  });

  it("asks for a key when keys are configured, but not on /health", async () => {
    const a = await start(undefined, ["k1"]);
    expect((await a.inject({ method: "POST", url: "/v1/analyze", payload: body })).statusCode).toBe(
      401,
    );
    const ok = await a.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: body,
      headers: { "x-api-key": "k1" },
    });
    expect(ok.statusCode).toBe(200);
    expect((await a.inject({ url: "/health" })).statusCode).toBe(200);
  });
});

describe("GET /health", () => {
  it("counts the X-Forwarded-For entries, and only counts them", async () => {
    const res = await (await start()).inject({
      url: "/health",
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(res.json()).toMatchObject({ status: "ok", forwardedHops: 2 });
    expect(res.body).not.toContain("1.2.3.4");
  });
});

describe("clientOf behind Render (3 proxy entries, measured)", () => {
  const trust = { directHops: 3, edgeHops: null, edgeSecret: null };
  const req = (xff: string) =>
    ({ headers: { "x-forwarded-for": xff }, ip: "x", socket: { remoteAddress: "peer" } }) as never;

  it("takes the entry three places from the right", () => {
    expect(clientOf(req("203.0.113.9, 10.0.0.1, 10.0.0.2"), trust)).toBe("203.0.113.9");
  });

  it("ignores what a caller forges on the left", () => {
    expect(clientOf(req("6.6.6.6, 203.0.113.9, 10.0.0.1, 10.0.0.2"), trust)).toBe("203.0.113.9");
    expect(clientOf(req("7.7.7.7, 6.6.6.6, 203.0.113.9, 10.0.0.1, 10.0.0.2"), trust)).toBe(
      "203.0.113.9",
    );
  });
});

describe("chains and templates", () => {
  it("lists the served chains with their features", async () => {
    const res = await (await start()).inject({ url: "/v1/chains" });
    expect(res.json().chains).toEqual([
      expect.objectContaining({ chain: "eip155:10143", family: "evm", network: "testnet" }),
    ]);
  });

  it("fills the templates for a served chain", async () => {
    const a = await start();
    const res = await a.inject({ url: "/v1/policy/templates?chain=eip155:10143" });
    expect(Object.keys(res.json().templates)).toEqual(["strict", "balanced", "permissive"]);
    expect(res.json().templates.balanced.core.x402.allowedAssets).toEqual([MONAD.usdc?.id]);
    expect((await a.inject({ url: "/v1/policy/templates?chain=eip155:1" })).statusCode).toBe(400);
  });

  it("is ready when every served chain answers", async () => {
    const res = await (await start()).inject({ url: "/health/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json().chains[0]).toMatchObject({ chain: "eip155:10143", reachable: true });
  });
});

describe("loadConfig", () => {
  it("enables a chain only with its RPC URL and defaults the trace node to it", () => {
    const c = loadConfig({ CHAIN_MONAD_TESTNET_RPC_URL: "https://rpc.example" });
    expect(c.chains).toEqual([
      { chain: MONAD, rpcUrl: "https://rpc.example", traceRpcUrl: "https://rpc.example" },
    ]);
    expect(loadConfig({}).chains).toEqual([]);
  });

  it("refuses a bad value and production without API keys", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadConfig({ BARET_ENV: "production" })).toThrow(/BARET_API_KEYS/);
    expect(loadConfig({ BARET_API_KEYS: "a, b" }).apiKeys).toEqual(["a", "b"]);
  });
});
