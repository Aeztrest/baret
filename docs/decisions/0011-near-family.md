# 0011 — NEAR is a chain family, built first for the NEAR HACKATHON

Status: Accepted
Date: 2026-11-08
Deciders: Ezgin (owner, 2026-11-08: "NEAR becomes a chain family now"; the repository goes public for the hackathon)

## Context
Baret enters NEAR HACKATHON 2026 (deadline 2026-11-14 23:59 UTC; tracks AI Security & Defense and Agent Economy). The security track's brief is Baret's product: spending limits, policy engines, sandboxed wallets for agents. Only NEAR work done in the hackathon window is judged, and the repository must be public with a licence by the deadline.

NEAR differs from the families Baret has: human-readable account ids, access keys per account (full access or function call keys limited to one contract and a gas allowance), actions (Transfer, FunctionCall, AddKey, DeleteKey, DeleteAccount, DeployContract, Stake, CreateAccount) instead of opcodes, asynchronous receipts, and no public transaction simulation. NEP-141 is the fungible token standard; Chain Signatures lets a NEAR contract request an MPC signature for another chain; NEAR Intents settles cross-chain swaps.

## Decision
1. NEAR is the fourth family: `near` in `FAMILIES`, CAIP-2 namespace `near` (`near:testnet`, `near:mainnet`). CAIP-10 accounts are `near:<network>:<account-id>`; an `_` in an account id is written `%5F` because CAIP-10 does not allow it raw. Assets: native `slip44:397`, NEP-141 `nep141:<token-contract>`.
2. `packages/chain-near` is the adapter (`./engine` now, `./wallet` with the extension). It decodes a transaction (JSON actions or a borsh-serialized transaction) into Effects. Simulation is **preflight**: account and key state, contract code presence and NEP-141 balances read over RPC; the verdict carries `simulation: "preflight"` and never claims a trace.
3. GuardPolicy gains a `near` section (`blockDeleteAccount`, `blockContractDeploy`), present in every policy like the other family sections. A full access key added or removed is `AUTHORITY_CHANGE` (`signer-added` / `signer-removed`), the universal code. NEAR-only codes: `ACCOUNT_DELETE_DETECTED`, `CONTRACT_DEPLOY_DETECTED`, `FUNCTION_CALL_KEY_ADDED`, `CHAIN_SIGNATURE_REQUEST`.
4. `contracts/near` holds the spend-limit vault (Rust, near-sdk): the owner funds it and sets per-transfer and rolling daily limits, receiver and token allowlists and a pause; an agent holding a function call key to the vault can only call `execute_transfer`. The vault can forward an approved request to the Chain Signatures MPC contract, so one NEAR policy limits an agent's spending on other chains.
5. The repository becomes public before the deadline (owner decision K1). The root licence stays as decided in D3 (superseded by ADR-0012: the whole repository is MIT); work done for the hackathon is separated by the `pre-hackathon` tag (the commit before the first NEAR change) and the `hackathon-submission` tag.

## Consequences
- Phase 2 (frontend, extension) pauses for the hackathon week; Phase 3 (Stellar) and Phase 4 (Casper) are unchanged.
- The policy schema, content, templates and parity tests change in one PR so the `near` section is never missing.
- NEAR verdicts are preflight, like Stellar's without simulation: lower confidence than an EVM trace, said in the verdict and the UI.
- Publishing the repository exposes all history; a full secrets scan of the history runs before it is made public.
