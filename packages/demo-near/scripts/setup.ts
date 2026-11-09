/**
 * Step 4: the owner sets the vault's policy and funds it. NEAR: at most 1 per transfer
 * and 3 per rolling day; the shop is the only receiver; the agent is the only agent.
 */
import { actions } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link, NEAR } from "./lib.js";

const owner = accountFor("NEAR_OWNER_ID", "NEAR_OWNER_KEY");
const vault = env("NEAR_VAULT_ID");
const GAS = 30_000_000_000_000n;
const call = (method: string, args: object, deposit = 0n) =>
  actions.functionCall(method, args, GAS, deposit);

const out = await owner.signAndSendTransaction({
  receiverId: vault,
  actions: [
    call("set_limit", {
      asset: "native",
      per_transfer: NEAR.toString(),
      per_day: (3n * NEAR).toString(),
    }),
    call("add_receiver", { asset: "native", receiver: env("NEAR_SHOP_ID") }),
    call("add_agent", { agent: env("NEAR_AGENT_ID") }),
    call("deposit", {}, 2n * NEAR),
  ],
  throwOnFailure: true,
});
console.log(`Policy set and 2 NEAR deposited: ${link(out.transaction.hash)}`);
console.log("Next: pnpm agent-key");
