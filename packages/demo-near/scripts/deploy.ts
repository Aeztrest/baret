/**
 * Step 3: deploys the vault wasm to NEAR_VAULT_ID and initialises it with the owner, in
 * one transaction. The wasm comes from CI (contracts-near.yml artifact).
 *
 *   pnpm --filter @baret/demo-near deploy-vault -- path/to/baret_near_vault.wasm
 */
import { readFileSync } from "node:fs";
import { actions } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link } from "./lib.js";

const file = process.argv.slice(2).find((a) => a.endsWith(".wasm"));
if (!file) {
  console.error("usage: deploy <baret_near_vault.wasm>");
  process.exit(2);
}
const vault = accountFor("NEAR_VAULT_ID", "NEAR_VAULT_KEY");
const out = await vault.signAndSendTransaction({
  receiverId: env("NEAR_VAULT_ID"),
  actions: [
    actions.deployContract(readFileSync(file)),
    actions.functionCall("new", { owner: env("NEAR_OWNER_ID") }, 30_000_000_000_000n, 0n),
  ],
  throwOnFailure: true,
});
console.log(`Vault deployed to ${env("NEAR_VAULT_ID")}: ${link(out.transaction.hash)}`);
console.log("Next: pnpm setup-vault");
