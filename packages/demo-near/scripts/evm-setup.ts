/**
 * Step 6 (TN.7): the owner lets the vault sign Monad testnet payments. MON on
 * eip155:10143: at most 0.05 per transfer and 0.1 per rolling day, counted as value plus
 * the worst-case fee; the shop's EVM address is the only EVM receiver. Then fund the
 * vault's EVM address (printed below) with testnet MON from the faucet.
 */
import { actions } from "near-api-js";
import { env, RPC_URL } from "../src/env.js";
import { EVM_CHAIN, evmAccounts, vaultEvmAddress } from "../src/evm.js";
import { accountFor, link } from "./lib.js";

const MON = 10n ** 18n;
const owner = accountFor("NEAR_OWNER_ID", "NEAR_OWNER_KEY");
const vault = env("NEAR_VAULT_ID");
const GAS = 30_000_000_000_000n;
const { shop } = evmAccounts();

const out = await owner.signAndSendTransaction({
  receiverId: vault,
  actions: [
    actions.functionCall(
      "set_limit",
      { asset: EVM_CHAIN, per_transfer: (MON / 20n).toString(), per_day: (MON / 10n).toString() },
      GAS,
      0n,
    ),
    actions.functionCall("add_receiver", { receiver: shop.toLowerCase() }, GAS, 0n),
  ],
  throwOnFailure: true,
});
console.log(`${EVM_CHAIN} limits set and ${shop} allowed: ${link(out.transaction.hash)}`);
console.log(`The vault's EVM address: ${await vaultEvmAddress(RPC_URL, vault)}`);
console.log("Fund it with testnet MON (https://faucet.monad.xyz), then: pnpm agent -- evm-pay");
