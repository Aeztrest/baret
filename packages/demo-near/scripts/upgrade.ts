/**
 * Moves a vault deployed before 0.2 (whose account still holds its deploy key) to the
 * new code and locks it, in one transaction signed by that key: deploy the new wasm,
 * run `migrate` (0.1's shared receiver list becomes per-asset lists and its spends become
 * hourly buckets, so no limit resets) and delete the key. If `migrate` fails, nothing
 * changes. Afterwards only the owner can change the code (`pnpm update-vault`).
 *
 *   pnpm --filter @baret/demo-near upgrade-vault -- path/to/baret_near_vault.wasm
 */
import { readFileSync } from "node:fs";
import { actions, KeyPair } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link } from "./lib.js";

const file = process.argv.slice(2).find((a) => a.endsWith(".wasm"));
if (!file) {
  console.error("usage: upgrade-vault <baret_near_vault.wasm>");
  process.exit(2);
}
const vault = accountFor("NEAR_VAULT_ID", "NEAR_VAULT_KEY");
const vaultKey = KeyPair.fromString(env("NEAR_VAULT_KEY") as `ed25519:${string}`).getPublicKey();
const out = await vault.signAndSendTransaction({
  receiverId: env("NEAR_VAULT_ID"),
  actions: [
    actions.deployContract(readFileSync(file)),
    actions.functionCall("migrate", {}, 100_000_000_000_000n, 0n),
    actions.deleteKey(vaultKey),
  ],
  throwOnFailure: true,
});
const policy = await vault.provider.callFunction({
  contractId: env("NEAR_VAULT_ID"),
  method: "get_policy",
  args: {},
});
console.log(`Vault migrated and locked: ${link(out.transaction.hash)}`);
console.log(`Policy now: ${JSON.stringify(policy).slice(0, 300)}`);
console.log("Next: pnpm agent-key (rewrites .env.agent), then pnpm agent -- pay");
