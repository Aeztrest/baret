/**
 * The shared blocklist (TN.14): the owner creates `baret-blocklist.<owner>`, funds it for
 * its storage, deploys the CI wasm and initialises it, in one transaction. The account is
 * never given a key: its code changes only through the owner's `update_contract`.
 *
 *   pnpm --filter @baret/demo-near deploy-blocklist -- path/to/baret_near_blocklist.wasm
 */
import { readFileSync } from "node:fs";
import { actions } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link, NEAR } from "./lib.js";

const file = process.argv.slice(2).find((a) => a.endsWith(".wasm"));
if (!file) {
  console.error("usage: deploy-blocklist <baret_near_blocklist.wasm>");
  process.exit(2);
}
const owner = accountFor("NEAR_OWNER_ID", "NEAR_OWNER_KEY");
const id = `baret-blocklist.${env("NEAR_OWNER_ID")}`;
const wasm = readFileSync(file);
// Storage costs 10^19 yoctoNEAR a byte: the code plus room for a few hundred reports.
const funding = (BigInt(wasm.length) * 10n ** 19n * 12n) / 10n + NEAR / 2n;

const out = await owner.signAndSendTransaction({
  receiverId: id,
  actions: [
    actions.createAccount(),
    actions.transfer(funding),
    actions.deployContract(wasm),
    actions.functionCall(
      "new",
      { owner: env("NEAR_OWNER_ID"), threshold: 2 },
      30_000_000_000_000n,
      0n,
    ),
  ],
  throwOnFailure: true,
});
console.log(`Blocklist ${id} deployed, no key on it: ${link(out.transaction.hash)}`);
