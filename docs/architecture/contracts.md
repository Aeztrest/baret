# Contracts and deployments

Status: **in progress** — EVM ported (`contracts/evm`: PaymentGuard, PaymentGuardFactory, ReputationRegistry, 29 tests, own CI job); Stellar and Casper not yet; NEAR vault built (ADR-0011)
Last verified: 2026-11-07

## 1. Per family

| Family | Path | Toolchain | Contracts | Model | Source |
|---|---|---|---|---|---|
| EVM | `contracts/evm` | Foundry | `PaymentGuard` (one token, per-merchant per-tx cap, rolling 24 h cap, pause, payment reference), `PaymentGuardFactory`, `ReputationRegistry`; later `ReputationOracleReceiver`, `CompliantPaymentGuard` | Vault owned by the user's account; the agent key can only `pay()` within caps | `Baret-Metropolis/contracts` |
| Stellar | `contracts/stellar` | Soroban SDK (Rust) | `merchant-spend-policy` | **Non-custodial**: a policy signer on the user's passkey-kit smart wallet; funds never leave the wallet; multi-tenant, one deployment for all wallets | `Baret-Stellar/contracts/contracts/merchant-spend-policy` |
| Casper | `contracts/casper` | Odra (Rust) | `PaymentGuard`, `Cep18x402` | Vault + CEP-18 token with `transfer_with_authorization` | `CasperBaret/contracts` |
| NEAR | `contracts/near` | near-sdk 5.30 (Rust), cargo-near | `vault` (built 2026-11-08, not deployed) | Vault owned by the user; per-asset limits per transfer and per rolling day, receiver allowlist, pause; the agent's function call key reaches only `execute_transfer`; later forwards approved requests to Chain Signatures | new (ADR-0011) |

Not ported: Metropolis `SealedStore`, demo contracts (`contracts/src/demo/*` are ported only with the showcase scenarios that use them), Stellar legacy `payment-guard` (superseded).

Open design question (Phase 5+): should EVM move from a custodial vault toward the Stellar model (a scoped session key / ERC-7579 module on a smart account) so every family is non-custodial? Track in `TASKS.md`.

## 2. Deployment registry

Addresses are data in `packages/chains/deployments/<chain-slug>.json`:

```json
{
  "chain": "eip155:10143",
  "contracts": {
    "PaymentGuardFactory": {
      "address": "0x…", "block": 68468744, "txHash": null,
      "source": "Baret-Metropolis contracts/src/PaymentGuardFactory.sol",
      "sourceVerified": true, "checkedOnChain": "2026-11-07"
    }
  }
}
```

Schema: `deploymentsSchema` in `packages/chains/src/index.ts`. Recorded so far: Monad testnet `PaymentGuardFactory` and `ReputationRegistry` (deployed by Metropolis; code checked on chain 2026-11-07). The source in `contracts/evm` compiles to the same runtime size as the code at both addresses (7,164 and 3,704 bytes), so they are reused, not redeployed.

A testnet file may also carry a `showcase` section: the contracts and wallets the web app's demo sites use (ADR-0010), each with `kind` (`contract` or `account`), `listed` (Baret vouches for it: it joins the chain's known contracts, `knownAddresses()` in `packages/chains`, which the API passes to the engine) and its `role`. Monad testnet has 19 entries (ported from the Metropolis contracts doc, §7, deployed by Metropolis 2026-10-03 and 2026-10-05; every contract's code checked on chain with `eth_getCode` 2026-11-08, the three wallets have no code). Listed: `DemoUsdc` (dUSDC; without it NovaSwap's attack also shows an unknown-contract finding, measured against the live API 2026-11-08), `NovaSwapRouter`, `NightShift`, `OrbitPool`, `OrbitReceipt`, `ClaimHubDistributor`, `ClaimHubToken`, `LaunchSale`, `LaunchToken`. Never listed (a test enforces it for the attack contracts): `NovaSwapDrainer`, `DemoDrainer`, `OrbitPoolSilent`, `LaunchSaleProxy`/`Logic`, `FakeUsdc`, the wallets.

- Written by the deploy script output, reviewed in a PR, never typed by hand into an app.
- Mainnet deployments require: audit report linked here, deployer key from a hardware wallet, owner = multisig.

## 3. CI

Each family has its own job (path-filtered): EVM `forge fmt --check`, `forge build --sizes`, `forge test` (`.github/workflows/contracts-evm.yml`, built); Stellar `cargo fmt --check`, `clippy -D warnings`, `cargo test`, wasm build; Casper `cargo odra test` (toolchain pinned in `rust-toolchain`); NEAR `cargo fmt --check`, `cargo test`, `cargo near build` on Rust 1.95 (`.github/workflows/contracts-near.yml`, built).

## 4. Current legacy deployments (reference only, not ours until re-verified)

Kept in the legacy repos' docs: `Baret-Metropolis/docs/CONTRACTS.md` (Monad testnet), `Baret-Stellar/contracts/DEPLOYMENT.md` (Stellar testnet + mainnet), `CasperBaret/README.md` (Casper testnet). Phase 1–4 tasks decide per contract whether to reuse a deployment (record it in the registry) or redeploy.
