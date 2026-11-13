import { chainEnvName, enabledChains } from "@baret/chains";
import type { ChainConfig } from "@baret/core";
import { z } from "zod";

/**
 * Every variable the API reads, validated at start-up: a bad value stops the boot instead
 * of serving with a guessed default. The list and its meaning: docs/operations/environments.md.
 * Chains are enabled by their CHAIN_<SLUG>_RPC_URL (packages/chains `enabledChains`).
 */

const list = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
  );
const optionalInt = (min: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? null : Number(v)))
    .pipe(z.number().int().min(min).nullable());
const int = (fallback: number, min = 1) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? fallback : Number(v)))
    .pipe(z.number().int().min(min));

const envSchema = z.object({
  PORT: int(8080),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  BARET_ENV: z.enum(["local", "staging", "production"]).default("local"),
  BARET_API_KEYS: list,
  BARET_CORS_ORIGINS: list,
  BARET_RATE_LIMIT_PER_MINUTE: int(120),
  BARET_REQUEST_TIMEOUT_MS: int(8000),
  BARET_VERDICT_TTL_SECONDS: int(30),
  /** X-Forwarded-For entries the host's proxy adds on a direct request (Render: 1). */
  BARET_PROXY_DIRECT_HOPS: optionalInt(0),
  /** Entries on a request through a site's rewrite (Vercel → Render). */
  BARET_PROXY_EDGE_HOPS: optionalInt(0),
  /** Shared secret the sites' edge sends in x-baret-edge. */
  BARET_EDGE_SECRET: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  /**
   * NEAR Agent Market (TN.13): the agent's token (`aat_…`) and the webhook signing secret
   * (`whsec_…`, the agent's Edit page). Both set: POST /v1/market/webhook answers hires.
   */
  NEAR_MARKET_TOKEN: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  NEAR_MARKET_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .pipe(z.string().min(32, "must be the market's signing secret (32+ characters)").nullable()),
  NEAR_MARKET_API: z.string().url().default("https://market.near.ai"),
});

export interface ChainEndpoints {
  chain: ChainConfig;
  rpcUrl: string;
  /** The node for debug_traceCall; the main RPC when unset. */
  traceRpcUrl: string;
}

export interface ApiConfig {
  port: number;
  host: string;
  logLevel: z.infer<typeof envSchema>["LOG_LEVEL"];
  env: z.infer<typeof envSchema>["BARET_ENV"];
  apiKeys: string[];
  corsOrigins: string[];
  rateLimitPerMinute: number;
  requestTimeoutMs: number;
  verdictTtlSeconds: number;
  proxyTrust: { directHops: number | null; edgeHops: number | null; edgeSecret: string | null };
  chains: ChainEndpoints[];
  /** Agent Market webhook settings; null when the webhook is off. */
  market: { token: string; webhookSecret: string; apiUrl: string } | null;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`invalid environment:\n  ${issues.join("\n  ")}`);
  }
  const e = parsed.data;
  if (e.BARET_ENV === "production" && e.BARET_API_KEYS.length === 0) {
    throw new Error("BARET_API_KEYS must be set in production");
  }
  // Half a market setup is a mistake, not a choice: a secret with no token cannot deliver,
  // a token with no secret cannot tell the market's calls from anyone's.
  if ((e.NEAR_MARKET_TOKEN === null) !== (e.NEAR_MARKET_WEBHOOK_SECRET === null)) {
    throw new Error(
      "NEAR_MARKET_TOKEN and NEAR_MARKET_WEBHOOK_SECRET are set together or not at all",
    );
  }
  return {
    port: e.PORT,
    host: e.HOST,
    logLevel: e.LOG_LEVEL,
    env: e.BARET_ENV,
    apiKeys: e.BARET_API_KEYS,
    corsOrigins: e.BARET_CORS_ORIGINS,
    rateLimitPerMinute: e.BARET_RATE_LIMIT_PER_MINUTE,
    requestTimeoutMs: e.BARET_REQUEST_TIMEOUT_MS,
    verdictTtlSeconds: e.BARET_VERDICT_TTL_SECONDS,
    proxyTrust: {
      directHops: e.BARET_PROXY_DIRECT_HOPS,
      edgeHops: e.BARET_PROXY_EDGE_HOPS,
      edgeSecret: e.BARET_EDGE_SECRET,
    },
    chains: enabledChains(env).map((chain) => {
      const rpcUrl = (env[chainEnvName(chain, "RPC_URL")] ?? "").trim();
      const trace = (env[chainEnvName(chain, "TRACE_RPC_URL")] ?? "").trim();
      return { chain, rpcUrl, traceRpcUrl: trace === "" ? rpcUrl : trace };
    }),
    market:
      e.NEAR_MARKET_TOKEN && e.NEAR_MARKET_WEBHOOK_SECRET
        ? {
            token: e.NEAR_MARKET_TOKEN,
            webhookSecret: e.NEAR_MARKET_WEBHOOK_SECRET,
            apiUrl: e.NEAR_MARKET_API,
          }
        : null,
  };
}
