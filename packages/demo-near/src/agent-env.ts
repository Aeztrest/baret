import { resolve } from "node:path";
import { readEnvFile } from "./env-file.js";

/**
 * The agent process's settings, from `.env.agent` (written by `pnpm agent-key`) and the
 * environment, **by an allowlist**. The agent never sees the owner's key, the vault's
 * key or the full access key of its own account: only its function call key, which can
 * call two methods of the vault and nothing else. If a full key shows up here anyway,
 * the agent refuses to start rather than run with more power than the demo claims.
 *
 * The owner's setup scripts use `env.ts` (`.env.near`) instead.
 */

export const AGENT_ENV_FILE = resolve(import.meta.dirname, "..", ".env.agent");

/** What the agent may read. Anything else in the file or the environment is ignored. */
export const AGENT_NAMES = [
  "NEAR_NETWORK",
  "NEAR_RPC_URL",
  "BARET_API_URL",
  "NEAR_AGENT_ID",
  "NEAR_AGENT_FC_KEY",
  "NEAR_VAULT_ID",
  "NEAR_SHOP_ID",
  "NEAR_ATTACKER_ID",
  "NEAR_MARKET_TOKEN",
  "NEAR_MARKET_API",
] as const;
type AgentName = (typeof AGENT_NAMES)[number];

/** Keys that would let the agent go around the vault. */
export const FORBIDDEN_NAMES = ["NEAR_OWNER_KEY", "NEAR_VAULT_KEY", "NEAR_AGENT_KEY"] as const;

/** The allowed values; throws when a forbidden key is present in the file. */
export function agentValues(
  file: Record<string, string>,
  environment: Record<string, string | undefined>,
): Partial<Record<AgentName, string>> {
  const found = FORBIDDEN_NAMES.filter((n) => file[n]);
  if (found.length > 0) {
    throw new Error(
      `demo-near agent: ${found.join(", ")} must not be in .env.agent. The agent holds only its function call key; run pnpm agent-key to rewrite the file.`,
    );
  }
  const out: Partial<Record<AgentName, string>> = {};
  for (const name of AGENT_NAMES) {
    const v = (environment[name] ?? file[name])?.trim();
    if (v) out[name] = v;
  }
  return out;
}

const values = agentValues(readEnvFile(AGENT_ENV_FILE), process.env);

export function agentEnv(name: AgentName): string {
  const v = values[name];
  if (!v) throw new Error(`demo-near agent: set ${name} in packages/demo-near/.env.agent`);
  return v;
}

export function agentEnvOr(name: AgentName, fallback: string): string {
  return values[name] ?? fallback;
}

export const NETWORK = agentEnvOr("NEAR_NETWORK", "testnet");
export const CHAIN = `near:${NETWORK}`;
// FastNEAR (listed on docs.near.org/api/rpc/providers): rpc.<network>.near.org is rate
// limited and took about 3 s per call on 2026-11-09.
export const RPC_URL = agentEnvOr(
  "NEAR_RPC_URL",
  NETWORK === "mainnet" ? "https://free.rpc.fastnear.com" : "https://test.rpc.fastnear.com",
);
export const BARET_API = agentEnvOr("BARET_API_URL", "https://baret-api-staging.onrender.com");
export const EXPLORER =
  NETWORK === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
