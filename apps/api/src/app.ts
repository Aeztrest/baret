import { policyContext } from "@baret/chains";
import {
  type ChainConfig,
  type ChainHealth,
  ChainUnavailableError,
  ChainUnsupportedError,
  createPolicy,
  InvalidRequestError,
  POLICY_TEMPLATE_NAMES,
} from "@baret/core";
import type { Engine } from "@baret/engine";
import { ENGINE_VERSION } from "@baret/engine";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { clientOf, viaEdge } from "./client.js";
import type { ApiConfig } from "./config.js";
import { MARKET_WEBHOOK_PATH, type MarketWebhookDeps, registerMarketWebhook } from "./market.js";

export interface ApiDeps {
  config: Pick<
    ApiConfig,
    "logLevel" | "apiKeys" | "corsOrigins" | "rateLimitPerMinute" | "proxyTrust"
  >;
  engine: Engine;
  /** Health of one served chain (the family adapter's `health`). */
  health: (chain: ChainConfig) => Promise<ChainHealth>;
  /** The commit this build came from, when the host says (Render: RENDER_GIT_COMMIT). */
  commit?: string | null;
  /** NEAR Agent Market webhook (TN.13); absent: the route does not exist. */
  market?: MarketWebhookDeps | null;
}

/** The API's one error envelope (docs/architecture/api.md §3). */
export function sendError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

function forwardedHops(header: string | string[] | undefined): number {
  const value = Array.isArray(header) ? header.join(",") : (header ?? "");
  return value.split(",").filter((part) => part.trim() !== "").length;
}

export async function buildApp(deps: ApiDeps): Promise<FastifyInstance> {
  const { config, engine } = deps;
  const app = Fastify({
    logger: { level: config.logLevel },
    bodyLimit: 256 * 1024,
    // The API sits behind its host's proxy and the sites' rewrites: without this every
    // visitor shares one rate-limit bucket (Metropolis G-01). Which X-Forwarded-For entry
    // is trusted is decided in client.ts from the configured proxy hops.
    trustProxy: true,
  });

  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? [...config.corsOrigins] : true,
    exposedHeaders: ["x-payment-response"],
  });
  await app.register(rateLimit, {
    max: config.rateLimitPerMinute,
    timeWindow: "1 minute",
    keyGenerator: (req) => clientOf(req, config.proxyTrust),
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      error: { code: "rate_limited", message: `more than ${ctx.max} requests a minute` },
    }),
  });

  app.setErrorHandler((err, req, reply) => {
    const code = (err as { code?: string }).code;
    if (code === "FST_ERR_CTP_INVALID_JSON_BODY" || code === "FST_ERR_CTP_EMPTY_JSON_BODY") {
      return sendError(reply, 400, "invalid_request", "the body is not JSON");
    }
    if (code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return sendError(reply, 413, "payload_too_large", "the body is over 256 KiB");
    }
    if ((err as { statusCode?: number }).statusCode === 429) return reply.send(err);
    req.log.error({ err }, "unhandled error");
    // Never forward an internal message to a client.
    return sendError(reply, 500, "internal_error", "the request could not be completed");
  });

  // Every answer is data, never a page.
  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
    reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  });

  // API keys: required when configured. Health stays open for uptime checks; the market's
  // webhook carries no key but is signed, and is checked by its signature instead.
  app.addHook("onRequest", async (req, reply) => {
    if (config.apiKeys.length === 0 || req.url.startsWith("/health")) return;
    if (deps.market && req.url === MARKET_WEBHOOK_PATH) return;
    const key = req.headers["x-api-key"];
    if (typeof key !== "string" || !config.apiKeys.includes(key)) {
      return sendError(reply, 401, "unauthorized", "missing or unknown x-api-key");
    }
  });

  /**
   * `forwardedHops`: how many addresses this request's X-Forwarded-For carried — a count,
   * nothing else. It tells an operator how many proxies stand in front of the API on each
   * path, which is what BARET_PROXY_DIRECT_HOPS / _EDGE_HOPS must be set to (T2.11).
   */
  app.get("/health", async (req) => ({
    status: "ok",
    engineVersion: ENGINE_VERSION,
    commit: deps.commit ?? null,
    forwardedHops: forwardedHops(req.headers["x-forwarded-for"]),
    viaEdge: viaEdge(req, config.proxyTrust),
  }));

  /** Ready when every served chain answers as the chain it should be. */
  app.get("/health/ready", async (_req, reply) => {
    const chains = await Promise.all(
      engine.chains.map(async (chain) => ({ chain: chain.id, ...(await deps.health(chain)) })),
    );
    const ready = chains.length > 0 && chains.every((c) => c.reachable && c.rightChain);
    return reply.code(ready ? 200 : 503).send({ status: ready ? "ready" : "not_ready", chains });
  });

  /** The chains this deployment serves and what each can do (chain-adapters.md §6). */
  app.get("/v1/chains", async () => ({
    chains: engine.chains.map((c) => ({
      chain: c.id,
      family: c.family,
      name: c.name,
      network: c.network,
      nativeAsset: c.nativeAsset,
      usdc: c.usdc,
      features: c.features,
    })),
  }));

  /** The three templates, filled for one served chain. */
  app.get<{ Querystring: { chain?: string } }>("/v1/policy/templates", async (req, reply) => {
    const chain = engine.chains.find((c) => c.id === req.query.chain);
    if (!chain) {
      return sendError(reply, 400, "chain_unsupported", "`chain` must be a chain this API serves");
    }
    return {
      chain: chain.id,
      templates: Object.fromEntries(
        POLICY_TEMPLATE_NAMES.map((name) => [name, createPolicy(name, policyContext(chain))]),
      ),
    };
  });

  if (deps.market) await registerMarketWebhook(app, deps.market, sendError);

  app.post("/v1/analyze", async (req, reply) => {
    try {
      return await engine.analyze(req.body);
    } catch (err) {
      if (err instanceof InvalidRequestError) {
        return sendError(reply, 400, "invalid_request", err.message);
      }
      if (err instanceof ChainUnsupportedError) {
        return sendError(reply, 400, "chain_unsupported", err.message);
      }
      if (err instanceof ChainUnavailableError) {
        // Fail closed: no verdict. Clients show "Can't reach Baret" (Blocked).
        req.log.warn({ err }, "chain unavailable");
        return sendError(reply, 503, "rpc_unavailable", "the chain could not be read");
      }
      throw err;
    }
  });

  return app;
}
