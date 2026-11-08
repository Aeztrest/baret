/**
 * Replaces the vault's code with a newer build, keeping its state (policy, spending).
 * The new code must read the same state layout: TN.7 added methods and no state field
 * for this reason. Signed by the vault account's own key.
 *
 *   pnpm --filter @baret/demo-near upgrade-vault -- path/to/baret_near_vault.wasm
 */
import { readFileSync } from "node:fs";
import { actions } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link } from "./lib.js";

const file = process.argv.slice(2).find((a) => a.endsWith(".wasm"));
if (!file) {
  console.error("usage: upgrade-vault <baret_near_vault.wasm>");
  process.exit(2);
}
const vault = accountFor("NEAR_VAULT_ID", "NEAR_VAULT_KEY");
const out = await vault.signAndSendTransaction({
  receiverId: env("NEAR_VAULT_ID"),
  actions: [actions.deployContract(readFileSync(file))],
  throwOnFailure: true,
});
// The state must still read: a view over it fails if the layout changed.
const policy = await vault.provider.callFunction({
  contractId: env("NEAR_VAULT_ID"),
  method: "get_policy",
  args: {},
});
console.log(`Vault code replaced: ${link(out.transaction.hash)}`);
console.log(`State still reads: ${JSON.stringify(policy).slice(0, 160)}`);
console.log("Next: pnpm evm-setup, then pnpm agent-key");
