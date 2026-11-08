/**
 * Step 5 (TN.4, TN.7): the agent account gets a function call key that can call only the
 * vault's `execute_transfer` and `request_evm_signature`, with 0.25 NEAR of fee
 * allowance. The agent process holds this key and nothing else, so a leaked key can do
 * no more than the vault allows. Run again after an upgrade: an existing key is replaced
 * in the same transaction, so the method list follows the vault.
 */
import { actions, KeyPair } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link, NEAR } from "./lib.js";

const METHODS = ["execute_transfer", "request_evm_signature"];

const agent = accountFor("NEAR_AGENT_ID", "NEAR_AGENT_KEY");
const publicKey = KeyPair.fromString(
  env("NEAR_AGENT_FC_KEY") as `ed25519:${string}`,
).getPublicKey();
const keys = await agent.getAccessKeyList();
const exists = keys.keys.some((k) => k.public_key === publicKey.toString());
const out = await agent.signAndSendTransaction({
  receiverId: env("NEAR_AGENT_ID"),
  actions: [
    ...(exists ? [actions.deleteKey(publicKey)] : []),
    actions.addFunctionCallAccessKey(publicKey, env("NEAR_VAULT_ID"), METHODS, NEAR / 4n),
  ],
  throwOnFailure: true,
});
console.log(
  `Function call key ${publicKey.toString()} ${exists ? "replaced" : "added"} (${METHODS.join(", ")}): ${link(out.transaction.hash)}`,
);
console.log("Next: pnpm agent -- pay");
