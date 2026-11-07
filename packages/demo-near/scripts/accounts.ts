/**
 * Step 2: the owner creates the vault, agent and shop as its sub-accounts, each with the
 * public key from step 1. Needs a funded testnet owner (NEAR_OWNER_ID, NEAR_OWNER_KEY).
 */
import { KeyPair } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link, NEAR } from "./lib.js";

const owner = accountFor("NEAR_OWNER_ID", "NEAR_OWNER_KEY");
const funding = { VAULT: 3n * NEAR, AGENT: NEAR / 2n, SHOP: NEAR / 10n } as const;

for (const role of ["VAULT", "AGENT", "SHOP"] as const) {
  const id = env(`NEAR_${role}_ID`);
  const prefix = id.slice(0, id.length - env("NEAR_OWNER_ID").length - 1);
  const publicKey = KeyPair.fromString(
    env(`NEAR_${role}_KEY`) as `ed25519:${string}`,
  ).getPublicKey();
  try {
    const out = await owner.createSubAccount({
      accountOrPrefix: prefix,
      publicKey,
      nearToTransfer: funding[role],
    });
    console.log(`${id} created: ${link(out.transaction.hash)}`);
  } catch (e) {
    console.log(`${id}: ${(e as Error).message.slice(0, 160)}`);
  }
}
console.log(
  "Next: download the vault wasm from CI (artifact baret-near-vault-wasm), then pnpm deploy <file.wasm>",
);
