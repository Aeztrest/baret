import { createHmac } from "node:crypto";
import { MarketClient } from "@baret/agent-market";
import { getChain } from "@baret/chains";
import type { ChainConfig, EngineAdapter } from "@baret/core";
import { createEngine } from "@baret/engine";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { MarketWebhookDeps } from "./market.js";

const SECRET = "whsec_0123456789abcdef0123456789abcdef";
const NOW = 1_800_000_000;
const MONAD = getChain("eip155:10143") as ChainConfig;

const adapter: EngineAdapter = {
  family: "evm",
  version: "test",
  requestSchema: z.object({ kind: z.literal("call") }).passthrough(),
  analyze: async () => ({
    drafts: [],
    estimatedChanges: [],
    allowances: [],
    sources: [{ name: "rpc", status: "ok" }],
    pinnedAt: { kind: "block", value: "1" },
    simulation: "trace",
    confidence: "high",
  }),
  health: async () => ({ reachable: true, rightChain: true, simulation: "trace" }),
};

/** A market that records the agent's calls. */
function fakeMarket() {
  const calls: { path: string; body: unknown }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({
      path: new URL(url).pathname,
      body: init.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  return { client: new MarketClient("aat_test", "https://market.test", f), calls };
}

let app: FastifyInstance | null = null;
afterEach(async () => {
  await app?.close();
  app = null;
});

async function start(apiKeys: string[] = []) {
  const market = fakeMarket();
  const work: Promise<void>[] = [];
  const engine = createEngine({
    adapters: { evm: adapter },
    chains: [MONAD],
    verdictTtlSeconds: 30,
    now: () => NOW,
  });
  const deps: MarketWebhookDeps = {
    secret: SECRET,
    client: market.client,
    analyze: async (body) => (await engine.analyze(body)) as never,
    onWork: (w) => work.push(w),
    now: () => NOW,
  };
  app = await buildApp({
    config: {
      logLevel: "silent",
      apiKeys,
      corsOrigins: [],
      rateLimitPerMinute: 1000,
      proxyTrust: { directHops: null, edgeHops: null, edgeSecret: null },
    },
    engine,
    health: async () => ({ reachable: true, rightChain: true, simulation: "trace" }),
    market: deps,
  });
  return { app, calls: market.calls, settled: () => Promise.all(work) };
}

const BRIEF = [
  "```json",
  JSON.stringify({ chain: "eip155:10143", request: { kind: "call", tx: {} } }),
  "```",
].join("\n");

function delivery(
  payload: object,
  over: Partial<{ event: string; id: string; ts: number; secret: string }> = {},
) {
  const raw = JSON.stringify(payload);
  const ts = String(over.ts ?? NOW);
  const sig = createHmac("sha256", over.secret ?? SECRET)
    .update(`${ts}.${raw}`)
    .digest("hex");
  return {
    method: "POST" as const,
    url: "/v1/market/webhook",
    payload: raw,
    headers: {
      "content-type": "application/json",
      "x-market-event": over.event ?? "hire.created",
      "x-market-delivery": over.id ?? "d-1",
      "x-market-timestamp": ts,
      "x-market-signature": `sha256=${sig}`,
    },
  };
}
const hire = { event: "hire.created", assignment_id: "a1", description: BRIEF };

describe("POST /v1/market/webhook", () => {
  it("accepts a signed hire at once, then delivers Baret's verdict", async () => {
    const s = await start();
    const res = await s.app.inject(delivery(hire));
    expect(res.statusCode).toBe(202);
    await s.settled();
    expect(s.calls.map((c) => c.path)).toEqual([
      "/v1/assignments/a1/messages",
      "/v1/assignments/a1/submit",
    ]);
    const md = (s.calls[1]?.body as { deliverableMarkdown: string } | undefined)
      ?.deliverableMarkdown;
    expect(md).toMatch(/safe/i);
  });

  it("refuses an unsigned, mis-signed or replayed delivery and does no work", async () => {
    const s = await start();
    const unsigned = delivery(hire);
    delete (unsigned.headers as Record<string, string>)["x-market-signature"];
    for (const req of [
      unsigned,
      delivery(hire, { secret: "whsec_not-the-secret-0123456789abcdef" }),
      delivery(hire, { ts: NOW - 3600 }),
    ]) {
      const res = await s.app.inject(req);
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: expect.objectContaining({ code: "unauthorized" }) });
    }
    await s.settled();
    expect(s.calls).toEqual([]);
  });

  it("handles a retried delivery once", async () => {
    const s = await start();
    expect((await s.app.inject(delivery(hire, { id: "same" }))).statusCode).toBe(202);
    const again = await s.app.inject(delivery(hire, { id: "same" }));
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ status: "duplicate" });
    await s.settled();
    expect(s.calls.filter((c) => c.path.endsWith("/submit"))).toHaveLength(1);
  });

  it("acknowledges other events without work, and refuses a hire with no assignment", async () => {
    const s = await start();
    const ping = await s.app.inject(delivery({ event: "webhook.ping" }, { event: "webhook.ping" }));
    expect(ping.statusCode).toBe(200);
    expect(ping.json()).toMatchObject({ status: "ignored" });
    const bad = await s.app.inject(delivery({ event: "hire.created" }, { id: "d-2" }));
    expect(bad.statusCode).toBe(400);
    await s.settled();
    expect(s.calls).toEqual([]);
  });

  it("needs no API key (it is signed) while /v1/analyze still does", async () => {
    const s = await start(["k1"]);
    expect((await s.app.inject(delivery(hire))).statusCode).toBe(202);
    const analyze = await s.app.inject({ method: "POST", url: "/v1/analyze", payload: {} });
    expect(analyze.statusCode).toBe(401);
    await s.settled();
  });

  it("does not exist when the market is not configured", async () => {
    app = await buildApp({
      config: {
        logLevel: "silent",
        apiKeys: [],
        corsOrigins: [],
        rateLimitPerMinute: 1000,
        proxyTrust: { directHops: null, edgeHops: null, edgeSecret: null },
      },
      engine: createEngine({ adapters: { evm: adapter }, chains: [MONAD], verdictTtlSeconds: 30 }),
      health: async () => ({ reachable: true, rightChain: true, simulation: "trace" }),
    });
    expect((await app.inject(delivery(hire))).statusCode).toBe(404);
  });
});

describe("loadConfig: Agent Market", () => {
  it("turns the webhook on only with both the token and a real signing secret", () => {
    expect(loadConfig({}).market).toBeNull();
    expect(
      loadConfig({ NEAR_MARKET_TOKEN: "aat_x", NEAR_MARKET_WEBHOOK_SECRET: SECRET }).market,
    ).toEqual({ token: "aat_x", webhookSecret: SECRET, apiUrl: "https://market.near.ai" });
    expect(() => loadConfig({ NEAR_MARKET_TOKEN: "aat_x" })).toThrow(/together/);
    expect(() => loadConfig({ NEAR_MARKET_WEBHOOK_SECRET: SECRET })).toThrow(/together/);
    expect(() =>
      loadConfig({ NEAR_MARKET_TOKEN: "aat_x", NEAR_MARKET_WEBHOOK_SECRET: "short" }),
    ).toThrow(/NEAR_MARKET_WEBHOOK_SECRET/);
  });
});
