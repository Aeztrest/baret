# Casper family

Status: **planned** (source: `CasperBaret`; x402 and contracts are real on testnet, transaction simulation was not)
Last verified: 2026-11-07

Package: `packages/chain-casper` (`casper-js-sdk`, behind an ESM interop shim as in `CasperBaret/packages/casper-core/src/sdk.ts`). Chains: `casper:casper-test`, `casper:casper`.

## 1. Engine side

| Step | How | Legacy |
|---|---|---|
| decode | Transaction V1 (Casper 2.x) and legacy Deploy JSON → intent: entry points, contract packages, transfers, session code | `apps/server/src/analyze/intent.ts` |
| simulate | **Open.** Legacy used heuristics only; `speculative_exec` was optional and degraded confidence. Phase 4 research: which Casper 2.x node endpoint gives speculative execution, whether public providers expose it, or whether we run our own node | `analyze.ts` comment |
| effects | CEP-18 transfers / approvals, native transfers, associated-key and threshold changes | `detectors.ts` |
| family detectors | session code execution, CEP-18 unlimited allowance, risky/unknown contract package | `detectors.ts` |

Until simulation is solved, every Casper verdict carries `confidence: low` and the capability `simulation: "none"`; the UI says so.

## 2. Spend limit and x402

`PaymentGuard` (Odra vault) and `Cep18x402` (CEP-18 with `transfer_with_authorization`, EIP-712-style digest, compatible with `make-software/casper-x402`). The contract re-derives the digest and signer itself; it does not trust the server's verification. Package hashes: `CasperBaret/README.md`; re-verify in Phase 4.

## 3. Wallet side

Derivation and key type must match Casper Wallet for seed import (verify). Provider: Casper Wallet-compatible API and/or CSPR.click (research).
