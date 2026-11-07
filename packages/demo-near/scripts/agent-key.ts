/**
 * Step 5 (TN.4): the agent account gets a function call key that can call only the
 * vault's `execute_transfer`, with 0.25 NEAR of fee allowance. The agent process holds
 * this key and nothing else, so a leaked key can do no more than the vault allows.
 */
import { KeyPair } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link, NEAR } from "./lib.js";

const agent = accountFor("NEAR_AGENT_ID", "NEAR_AGENT_KEY");
const publicKey = KeyPair.fromString(
  env("NEAR_AGENT_FC_KEY") as `ed25519:${string}`,
).getPublicKey();
const out = await agent.addFunctionCallAccessKey({
  publicKey,
  contractId: env("NEAR_VAULT_ID"),
  methodNames: ["execute_transfer"],
  allowance: NEAR / 4n,
});
console.log(`Function call key ${publicKey.toString()} added: ${link(out.transaction.hash)}`);
console.log("Next: pnpm agent -- pay");
