# Contracts and deployments

Status: **in progress** — EVM ported (`contracts/evm`: PaymentGuard, PaymentGuardFactory, ReputationRegistry, 29 tests, own CI job); Stellar and Casper not yet
Last verified: 2026-11-07

## 1. Per family

| Family | Path | Toolchain | Contracts | Model | Source |
|---|---|---|---|---|---|
| EVM | `contracts/evm` | Foundry | `PaymentGuard` (one token, per-merchant per-tx cap, rolling 24 h cap, pause, payment reference), `PaymentGuardFactory`, `ReputationRegistry`; later `ReputationOracleReceiver`, `CompliantPaymentGuard` | Vault owned by the user's account; the agent key can only `pay()` within caps | `Baret-Metropolis/contracts` |
| Stellar | `contracts/stellar` | Soroban SDK (Rust) | `merchant-spend-policy` | **Non-custodial**: a policy signer on the user's passkey-kit smart wallet; funds never leave the wallet; multi-tenant, one deployment for all wallets | `Baret-Stellar/contracts/contracts/merchant-spend-policy` |
| Casper | `contracts/casper` | Odra (Rust) | `PaymentGuard`, `Cep18x402` | Vault + CEP-18 token with `transfer_with_authorization` | `CasperBaret/contracts` |

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

- Written by the deploy script output, reviewed in a PR, never typed by hand into an app.
- Mainnet deployments require: audit report linked here, deployer key from a hardware wallet, owner = multisig.

## 3. CI

Each family has its own job (path-filtered): EVM `forge fmt --check`, `forge build --sizes`, `forge test` (`.github/workflows/contracts-evm.yml`, built); Stellar `cargo fmt --check`, `clippy -D warnings`, `cargo test`, wasm build; Casper `cargo odra test` (toolchain pinned in `rust-toolchain`).

## 4. Current legacy deployments (reference only, not ours until re-verified)

Kept in the legacy repos' docs: `Baret-Metropolis/docs/CONTRACTS.md` (Monad testnet), `Baret-Stellar/contracts/DEPLOYMENT.md` (Stellar testnet + mainnet), `CasperBaret/README.md` (Casper testnet). Phase 1–4 tasks decide per contract whether to reuse a deployment (record it in the registry) or redeploy.
