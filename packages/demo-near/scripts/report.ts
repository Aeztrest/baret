/**
 * Reports an account on the shared blocklist (TN.14), signed by the owner, with the hash of
 * the transaction that shows why. `--confirm` also confirms it (owner only), so it is
 * flagged at once instead of waiting for the threshold.
 *
 *   pnpm --filter @baret/demo-near report -- drain-it-all.testnet PROMPT_INJECTION_PAYEE <tx> --confirm
 */
import { actions } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link, NEAR } from "./lib.js";

const [account, reason, evidence] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!account || !reason || !evidence) {
  console.error("usage: report <account> <REASON_CODE> <tx-hash> [--confirm]");
  process.exit(2);
}
const owner = accountFor("NEAR_OWNER_ID", "NEAR_OWNER_KEY");
const list = `baret-blocklist.${env("NEAR_OWNER_ID")}`;
const GAS = 30_000_000_000_000n;
const out = await owner.signAndSendTransaction({
  receiverId: list,
  actions: [
    actions.functionCall("report", { account, reason, evidence }, GAS, NEAR / 100n),
    ...(process.argv.includes("--confirm")
      ? [actions.functionCall("confirm", { account }, GAS, 0n)]
      : []),
  ],
  throwOnFailure: true,
});
console.log(`Reported ${account} (${reason}, evidence ${evidence}): ${link(out.transaction.hash)}`);
