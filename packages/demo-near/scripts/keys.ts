/**
 * Step 1: key pairs for the demo's accounts, written to .env.near (gitignored). Existing
 * keys are kept. Account ids are sub-accounts of NEAR_OWNER_ID.
 */
import { KeyPair } from "near-api-js";
import { env } from "../src/env.js";
import { remember } from "./lib.js";

const owner = env("NEAR_OWNER_ID");
for (const [role, prefix] of [
  ["VAULT", "baret-vault"],
  ["AGENT", "baret-agent"],
  ["SHOP", "baret-shop"],
] as const) {
  remember(`NEAR_${role}_ID`, `${prefix}.${owner}`);
  remember(`NEAR_${role}_KEY`, KeyPair.fromRandom("ed25519").toString());
}
// The agent's function call key: the only key the agent process ever holds.
remember("NEAR_AGENT_FC_KEY", KeyPair.fromRandom("ed25519").toString());
console.log("Keys written to packages/demo-near/.env.near (never commit it). Next: pnpm accounts");
