/**
 * The Caution demo (TN.14): the owner opens a new shop account and lists it on the vault.
 * The vault would pay it, so nothing is Blocked; but the account is new and the agent has
 * never dealt with it, so Baret answers Caution and the agent asks its human
 * (`pnpm agent -- new-receiver`). Run once; the account id goes to the registry
 * (`packages/chains/deployments/near-testnet.json`, `DemoNewShop`).
 *
 *   pnpm --filter @baret/demo-near new-shop
 */
import { actions, KeyPair } from "near-api-js";
import { env } from "../src/env.js";
import { accountFor, link, NEAR } from "./lib.js";

const owner = accountFor("NEAR_OWNER_ID", "NEAR_OWNER_KEY");
const shop = `baret-newshop.${env("NEAR_OWNER_ID")}`;
const ownerKey = KeyPair.fromString(env("NEAR_OWNER_KEY") as `ed25519:${string}`).getPublicKey();

const created = await owner.signAndSendTransaction({
  receiverId: shop,
  actions: [
    actions.createAccount(),
    actions.transfer(NEAR / 10n),
    actions.addFullAccessKey(ownerKey),
  ],
  throwOnFailure: true,
});
console.log(`Opened ${shop}: ${link(created.transaction.hash)}`);

const listed = await owner.signAndSendTransaction({
  receiverId: env("NEAR_VAULT_ID"),
  actions: [
    actions.functionCall(
      "add_receiver",
      { asset: "native", receiver: shop },
      30_000_000_000_000n,
      0n,
    ),
  ],
  throwOnFailure: true,
});
console.log(`Listed on the vault as a NEAR receiver: ${link(listed.transaction.hash)}`);
