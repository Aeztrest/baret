# Stellar family

Status: **planned** (source: `Baret-Stellar`, which runs on testnet and has a mainnet `MerchantSpendPolicy` with real agent payments)
Last verified: 2026-11-07

Package: `packages/chain-stellar` (`@stellar/stellar-sdk`). Chains: `stellar:testnet`, `stellar:pubnet`.

## 1. Engine side

| Step | How | Legacy file (in `Baret-Stellar/apps/server/src`) |
|---|---|---|
| pin | latest ledger sequence | — |
| decode | transaction XDR (fee-bump unwrapped); network passphrase checked; operations decoded to a readable summary | `decodeStellarTransactionXdr`, `decodeTransactionOperations` |
| simulate | Horizon / RPC account state for every account touched + Soroban `simulateTransaction` for invoke operations (auth entries stripped first so unsigned address auth runs in recording mode) | `StellarSimulator` |
| effects | native / asset / trustline / allowance deltas; Soroban auth tree → counterparties and depth | `extractEstimatedChanges`, `parseSorobanAuthTree` |
| family detectors | SetOptions (signers, thresholds, master weight), account merge, trustline changes, unsigned auth entries, contract age | 8 detectors (`account`, `simulation`, `programs`, `cpi`, `reputation`, `compute`, `deltas`, `x402`) |

Legacy behaviour to change: an empty policy `{}` blocked only a few things, and a finding blocked only when its flag was on. In the unified engine the Stellar adapter uses the same policy templates and registry kinds as every family.

## 2. Spend limit: `MerchantSpendPolicy`

Policy signer for passkey-kit smart wallets: per merchant, a per-tx cap, a rolling 24 h cap and a mandate lifetime, bound to one Ed25519 sub-key; deny by default; multi-tenant. Full description: `Baret-Stellar/contracts/README.md` (ported to `contracts/stellar/README.md`). Testnet contract id in the legacy README: `CCL7DJY2VQAECASTCNG6JLFZRUG4B3BMCMEMNWFOWC47Y5UXIYS7MPNH`; mainnet deployment recorded in the hub repo's technical proof brief. Both are to be re-verified and written to `packages/chains/deployments/` in Phase 3.

## 3. Wallet side

ed25519 SLIP-10 `m/44'/148'/i'`. Classic G-accounts for the person's account; a passkey-kit smart wallet (C-account) for x402 and agent mandates (as in the legacy extension). dApp provider shape: research task (SEP-43 / Stellar Wallets Kit).

## 4. Watch

- The mainnet agent authority used for the investor proof expired on 2026-11-06 (hub README task); renew it before the next demo.
- Legacy names to drop: `@stellar-thorn/*`, `swig-guard`, `DELTAG_*`.
