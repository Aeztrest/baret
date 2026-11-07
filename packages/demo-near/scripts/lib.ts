import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { Account, JsonRpcProvider, KeyPairSigner } from "near-api-js";
import { ENV_FILE, EXPLORER, env, NETWORK, RPC_URL } from "../src/env.js";

/** Helpers the setup scripts share. Every script stops before a mainnet run. */

if (NETWORK !== "testnet") {
  console.error(`demo-near scripts run on testnet only (NEAR_NETWORK=${NETWORK}).`);
  process.exit(2);
}

export const provider = new JsonRpcProvider({ url: RPC_URL });
export const NEAR = 10n ** 24n;

/** An account signing with the key stored under `keyVar` in .env.near. */
export function accountFor(idVar: string, keyVar: string): Account {
  const signer = KeyPairSigner.fromSecretKey(env(keyVar) as `ed25519:${string}`);
  return new Account(env(idVar), provider, signer);
}

/** Adds NAME=value to .env.near unless NAME is already there. */
export function remember(name: string, value: string): void {
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  if (new RegExp(`^${name}=`, "m").test(text)) return;
  appendFileSync(ENV_FILE, `${text.endsWith("\n") || text === "" ? "" : "\n"}${name}=${value}\n`);
}

export function link(hash: string): string {
  return `${EXPLORER}/txns/${hash}`;
}
