/**
 * The owner replaces the vault's code (0.2+): `update_contract` takes the wasm as the
 * call's raw input, deploys it on the vault's account and runs `migrate`. The vault's
 * account holds no key, so this owner-signed call is the only way its code changes.
 *
 *   pnpm --filter @baret/demo-near update-vault -- path/to/baret_near_vault.wasm
 *   pnpm --filter @baret/demo-near update-vault -- path/to/baret_near_blocklist.wasm --blocklist
 *
 * `--blocklist`: the same owner path for the shared blocklist (`baret-blocklist.<owner>`).
 */
import { readFileSync } from "node:fs";
import { actions } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link } from "./lib.js";

const file = process.argv.slice(2).find((a) => a.endsWith(".wasm"));
if (!file) {
  console.error("usage: update-vault <baret_near_vault.wasm>");
  process.exit(2);
}
const owner = accountFor("NEAR_OWNER_ID", "NEAR_OWNER_KEY");
const target = process.argv.includes("--blocklist")
  ? `baret-blocklist.${env("NEAR_OWNER_ID")}`
  : env("NEAR_VAULT_ID");
const out = await owner.signAndSendTransaction({
  receiverId: target,
  actions: [
    actions.functionCall(
      "update_contract",
      new Uint8Array(readFileSync(file)),
      300_000_000_000_000n,
      0n,
    ),
  ],
  throwOnFailure: true,
});
console.log(`${target}: code replaced by the owner: ${link(out.transaction.hash)}`);
