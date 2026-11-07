# SDKs: `@baret/guard` and `@baret/agent-kit`

Status: **in progress** — `@baret/guard` 0.2.0 built and packed (not published yet: T2.6, T0.8); `@baret/agent-kit` not ported (T2.8)
Last verified: 2026-11-07

## 1. `@baret/guard` — for dApps and wallets

- `new TransactionGuard({ baseUrl, apiKey? }).evaluate({ chain, request, policy | policyTemplate, account? })` → `Verdict` (schema-checked).
- No answer, non-2xx, or an answer off the schema → `GuardUnreachableError`; the caller treats it as Blocked.
- Helpers: `isSafe`, `isSignable` (not Blocked), `verdictRefusal(verdict, { chain, now })` (expired or another chain; `now` in Unix seconds).
- `policyTemplate(name, chain)`, `migratePolicyV1(v1, chain)`.
- **Depends only on `@baret/core`** (types + zod). No chain library: a dApp on any chain can install it.
- **Never signs or submits.**

## 2. `@baret/agent-kit` — for agents

- `AgentWallet({ chain, signer, baretUrl, policy | policyTemplate, allowCaution? })`: `evaluate(call)`, `guardedSign(call)`, `guardedSubmit(call)`, `pay(...)` (the family's spend-limit payment), `payX402(url)`.
- Safe is signed; Blocked, unreachable or off-contract throws (`GuardBlockedError`, `GuardUnreachableError`); Caution is refused unless `allowCaution`.
- Signers: `localSigner(key)` per family; MPC/server wallets (Dynamic in Metropolis) behind the same `AgentSigner` interface.
- Optional reviewer hook (`AgentWallet({ reviewer })`): a second check that can only veto. The Qwen agent reviewer from Metropolis is in the backlog.
- CLI `baret`: `address`, `analyze`, `submit`, `pay`, `x402`, `policy list`. Exit codes `0` cleared, `1` not cleared (nothing signed), `2` error.
- Imports `chain-<family>/wallet` for signing; per-family subpath exports so an EVM agent does not install the Stellar SDK (optional peer dependencies).

## 3. Versioning and publishing

- Changesets. `@baret/core`, `@baret/guard`, `@baret/agent-kit` are published; everything else is private.
- The multichain line starts at **0.2.0** (breaking: `chain` field, policy v2, unified codes). 0.1.x stays documented as Monad-only.
- Published from CI on a release tag only, with npm provenance. Who owns the `@baret` npm scope: to confirm (`TASKS.md`).
- Each published package has a README with a quickstart that is run in CI against the staging API (Phase 2).
- Checked 2026-11-07: `pnpm pack` of `@baret/core` and `@baret/guard` gives tarballs with built `dist/` only and `workspace:*` rewritten to `0.2.0`; installed with npm in an empty project, the README call ran against `apps/api` on Monad testnet with the expected answers.
