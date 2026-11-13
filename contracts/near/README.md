# contracts/near

Baret's NEAR contracts (ADR-0011). Rust, near-sdk 5.30, built with cargo-near (reproducible: NEP-330, see Build). Design: `docs/chains/near.md` §3, `docs/architecture/contracts.md`.

| Contract | Version | What it is |
|---|---|---|
| `vault` (`baret-near-vault`) | 0.2.1 | An owner's spend-limit vault for AI agents. Per asset (NEAR, a NEP-141 token, or an EVM chain's native coin through Chain Signatures): a limit per transfer, a limit per rolling 24 hours and the receivers that asset may pay. Registered agents, a pause, two-step owner rotation, owner-only code updates. An agent's function call key reaches only `execute_transfer` and `request_evm_signature`, so a leaked or prompt-injected agent spends at most what the policy allows. Refusals panic with `E_…` codes; every state change emits a NEP-297 event (`baret_vault`). |
| `blocklist` (`baret-near-blocklist`) | 0.1.0 | Baret's shared blocklist (TN.14). Anyone reports an account with a reason code and the hash of the transaction that shows it, once per reporter, paying a 0.01 NEAR storage deposit (at most 20 reports per account). Flagged when the owner confirms it or `threshold` reporters agree. Baret reads `get_flags(accounts)` (up to 50) before an agent signs: flagged → `KNOWN_MALICIOUS_ADDRESS` (Blocked), reported → `COUNTERPARTY_REPORTED` (Caution). The owner can `dismiss` false reports and `set_threshold`; keyless, code changes only through `update_contract`. Events `baret_blocklist`. Refusals: `E_DEPOSIT_TOO_LOW`, `E_BAD_REASON`, `E_BAD_EVIDENCE`, `E_SELF_REPORT`, `E_ALREADY_REPORTED`, `E_TOO_MANY_REPORTS`, `E_NOT_FOUND`, `E_BAD_THRESHOLD`, `E_TOO_MANY_ACCOUNTS`, `E_NOT_OWNER`. |

Deployed on NEAR testnet: `baret-vault.aeztrest-baret.testnet`, and since 2026-11-13 `baret-blocklist.aeztrest-baret.testnet` (threshold 2, no access key, code hash `Cjo5qWGb…Le5o` = the CI build; record: `packages/chains/deployments/near-testnet.json`).

## Methods

| Who | Method | What |
|---|---|---|
| owner | `set_limit(asset, per_transfer, per_day)`, `remove_asset(asset)` | An asset with limits is allowed; removing it drops its receivers too |
| owner | `add_receiver(asset, receiver)`, `remove_receiver(asset, receiver)` | Receivers are per asset: an EVM address listed for `eip155:10143` cannot be paid NEAR |
| owner | `add_agent`, `remove_agent`, `set_paused` | Who may spend; the kill switch |
| owner | `withdraw(asset, amount)` | Takes NEAR or a NEP-141 token back, no limits |
| owner | `withdraw_evm(tx)` (0.2.1) | Signs an EVM transfer of the vault's own funds: no limits, any address, even while paused. Takes EVM funds back, and voids EVM signatures already given to an agent (see Trust model) |
| owner → new owner | `propose_owner(new_owner)`, `accept_owner()` | Two steps, so a typo cannot lock the vault |
| owner | `update_contract()` (raw wasm as input) | Deploys new code and runs `migrate`; the only way the code changes |
| agent | `execute_transfer(asset, receiver, amount, memo?)` | Pays NEAR or a NEP-141 token when every rule allows it |
| agent | `request_evm_signature(tx)` | Builds an EIP-1559 native transfer itself, counts value + worst-case fee, asks NEAR's MPC network to sign it |
| anyone | `get_policy`, `get_spent_today(asset)`, `get_remaining(asset)`, `get_evm_payload(tx)`, `get_version` | Views (Baret's preflight reads them) |

Checks run in this order, so a code names the first rule that refused: `E_PAUSED`, `E_NOT_AGENT`, `E_AMOUNT_ZERO`, `E_ASSET_NOT_ALLOWED`, `E_RECEIVER_NOT_ALLOWED`, `E_PER_TRANSFER_LIMIT`, `E_DAILY_LIMIT`. Others: `E_NOT_OWNER`, `E_NOT_PENDING_OWNER`, `E_BAD_LIMIT`, `E_BAD_EVM_TX`, `E_NO_CODE`, `E_BAD_STATE`.

## Trust model

- **The agent** holds a function call key for two vault methods, with a fee allowance. It cannot transfer from its own account, add keys or call anything else. Through the vault it can spend at most `per_transfer` per call and `per_day` per 24 hours per asset, only to listed receivers.
- **The vault's account holds no access key.** The deploy script deletes the deploy key in the deploy transaction (`packages/demo-near/scripts/deploy.ts`; a 0.1 vault is moved and locked by `upgrade.ts`). Nobody can redeploy it with a key; its code changes only through the owner's `update_contract`. `pnpm verify-vault` shows the key count and compares the on-chain code hash with a wasm file.
- **The owner** can change the policy, withdraw and update the code: the owner is the party the vault protects, not one it protects against.
- **EVM signatures do not expire.** The vault counts a Chain Signatures payment when it signs it, not when it is broadcast, and pausing the vault cannot recall a signature already given. An agent could therefore collect signatures (each within the limits on the day it got it, for later nonces) and broadcast them together later. The owner voids them with `withdraw_evm`: a sweep of the vault's EVM balance with the address's next nonce leaves every collected transfer nothing to spend. Baret's preflight sees each request, not what the agent holds back.
- The rolling window is counted by the hour: a spend leaves it 24 to 25 hours after it was made, never earlier. At most 25 hourly buckets are kept per asset, so a flood of small transfers cannot grow the state or the gas of a check.

## Build and test

```bash
cd contracts/near
cargo fmt --check && cargo test                     # 38 unit tests (near-sdk unit-testing)
cd vault && cargo near build reproducible-wasm       # Docker: the image pinned in vault/Cargo.toml
```

**Reproducible build (NEP-330).** `vault/Cargo.toml` pins the build image by digest (`[package.metadata.near.reproducible_build]`), so the same commit gives the same wasm bytes, hence the same NEAR code hash, on any machine with Docker; the wasm also carries its source (repository and commit) in `contract_source_metadata`. To check the deployed vault yourself: check out the commit its release names, run the build above, and `pnpm --filter @baret/demo-near verify-vault -- <the wasm>` (MATCH or not). On Windows the unit-testing feature compiles `aws-lc-sys`, which needs NASM (or CMake); CI runs fmt, clippy and the tests on Linux (`.github/workflows/contracts-near.yml`) with Rust 1.95 (near-sdk 5.30's minimum), builds the wasm reproducibly and prints its NEAR code hash (base58 of its sha256). The wasm is the CI artifact `baret-near-vault-wasm`; tagged releases attach it.
