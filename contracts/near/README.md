# contracts/near

Baret's NEAR contracts (ADR-0011). Rust, near-sdk 5.30, built with cargo-near 0.23. Design: `docs/chains/near.md` §3, `docs/architecture/contracts.md`.

| Contract | What it is |
|---|---|
| `vault` (`baret-near-vault`) | An owner's spend-limit vault for AI agents. Per asset (NEAR or a NEP-141 token): a limit per transfer and a limit per rolling 24 hours. A receiver allowlist, registered agents, a pause. An agent's function call key reaches only `execute_transfer`, so a leaked key spends at most what the policy allows. Refusals panic with `E_…` codes; transfers emit NEP-297 events (`baret_vault`). |

```bash
cd contracts/near
cargo fmt --check && cargo test                     # unit tests (near-sdk unit-testing)
cd vault && cargo near build non-reproducible-wasm   # target/near/baret_near_vault/*.wasm
```

On Windows the unit-testing feature compiles `aws-lc-sys`, which needs NASM (or CMake); CI runs the tests on Linux (`.github/workflows/contracts-near.yml`), with Rust 1.95 (near-sdk 5.30's minimum); cargo-near chooses the wasm target. A local wasm build on Windows hits the same NASM need through cargo-near's own dependencies, so the wasm comes from CI's artifact (`baret-near-vault-wasm`).

Refusal codes: `E_NOT_OWNER`, `E_NOT_AGENT`, `E_PAUSED`, `E_AMOUNT_ZERO`, `E_ASSET_NOT_ALLOWED`, `E_RECEIVER_NOT_ALLOWED`, `E_PER_TRANSFER_LIMIT`, `E_DAILY_LIMIT`, `E_BAD_LIMIT`. The checks run in that order, so a code names the first rule that refused.

Not deployed yet: a testnet deploy needs the owner's yes (CLAUDE.md), and its address then goes into a new `near-testnet` deployments file in `packages/chains`.
