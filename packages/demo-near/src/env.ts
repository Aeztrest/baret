import { resolve } from "node:path";
import { readEnvFile } from "./env-file.js";

/**
 * The owner's settings for the setup scripts, from the environment or a local
 * `.env.near` file next to this package (gitignored: it holds testnet private keys,
 * including the owner's). `.env.example` lists every name. Nothing here has a default
 * key: a missing value stops the script with its name. The agent process never reads
 * this file: it reads `.env.agent` through `agent-env.ts`.
 */

const FILE = resolve(import.meta.dirname, "..", ".env.near");

const values = { ...readEnvFile(FILE), ...process.env } as Record<string, string | undefined>;

export function env(name: string): string {
  const v = values[name]?.trim();
  if (!v)
    throw new Error(`demo-near: set ${name} in packages/demo-near/.env.near (see .env.example)`);
  return v;
}

export function envOr(name: string, fallback: string): string {
  return values[name]?.trim() || fallback;
}

export const ENV_FILE = FILE;

/** The network the demo runs on: testnet only (a mainnet run is never the default). */
export const NETWORK = envOr("NEAR_NETWORK", "testnet");
export const CHAIN = `near:${NETWORK}`;
export const RPC_URL = envOr("NEAR_RPC_URL", `https://rpc.${NETWORK}.near.org`);
/** Baret's API: staging by default, or a local apps/api. */
export const BARET_API = envOr("BARET_API_URL", "https://baret-api-staging.onrender.com");
export const EXPLORER =
  NETWORK === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
