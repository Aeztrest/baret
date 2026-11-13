/**
 * Anyone can check that the demo vault runs the code in this repository and that its
 * account is locked. NEAR stores base58(sha256(wasm)) as an account's code hash: give
 * this script the wasm CI built (the GitHub release asset or the contracts-near.yml
 * artifact) and it compares. No key and no .env file: it reads the registry and NEAR
 * testnet RPC only.
 *
 *   pnpm --filter @baret/demo-near verify-vault                      # hash and keys
 *   pnpm --filter @baret/demo-near verify-vault -- baret_near_vault.wasm
 *   pnpm --filter @baret/demo-near verify-vault -- baret_near_blocklist.wasm --blocklist
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { getDeployment } from "@baret/chains";
import { base58 } from "@scure/base";
import { demoAccounts, demoRpcUrl } from "../src/view.js";

async function query(params: object): Promise<Record<string, unknown> | undefined> {
  const res = await fetch(demoRpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "query",
      params: { finality: "final", ...params },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  return ((await res.json()) as { result?: Record<string, unknown> }).result;
}

// `--blocklist`: the shared blocklist (registry BaretBlocklist) instead of the vault.
const vault = process.argv.includes("--blocklist")
  ? (getDeployment("near:testnet", "BaretBlocklist")?.address ?? "")
  : demoAccounts().vault;
const account = await query({ request_type: "view_account", account_id: vault });
const keys = await query({ request_type: "view_access_key_list", account_id: vault });
const onChain = account?.code_hash as string | undefined;
const keyCount = Array.isArray(keys?.keys) ? keys.keys.length : undefined;

console.log(`Contract:           ${vault}`);
console.log(`Code hash on chain: ${onChain ?? "(not read)"}`);
console.log(
  `Keys on the vault:  ${keyCount ?? "(not read)"}${keyCount === 0 ? " (locked: only the owner's update_contract can change the code)" : ""}`,
);
const file = process.argv.slice(2).find((a) => a.endsWith(".wasm"));
if (file) {
  const local = base58.encode(createHash("sha256").update(readFileSync(file)).digest());
  console.log(`Code hash of wasm:  ${local}`);
  console.log(local === onChain ? "MATCH: the contract runs this wasm." : "NO MATCH.");
  process.exit(local === onChain ? 0 : 1);
}
