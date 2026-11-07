import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The demo's settings, from the environment or a local `.env.near` file next to this
 * package (gitignored: it holds testnet private keys). `.env.example` lists every name.
 * Nothing here has a default key: a missing value stops the script with its name.
 */

const FILE = resolve(import.meta.dirname, "..", ".env.near");

function fileValues(): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(FILE, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m?.[1]) out[m[1]] = (m[2] ?? "").replace(/^"(.*)"$/, "$1");
    }
    return out;
  } catch {
    return {};
  }
}

const values = { ...fileValues(), ...process.env } as Record<string, string | undefined>;

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
