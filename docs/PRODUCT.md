# Baret — Product

Status: **planned**
Last verified: 2026-11-07

The single answer to "what are we building, for whom, and why". Architecture is in `docs/ARCHITECTURE.md`.

## 1. Problem

At the moment of signing, a person or an AI agent cannot see what a transaction will actually do: which contract runs, which allowance it grants, which signer it adds, how much leaves the account. Drainers, look-alike addresses, unlimited approvals, account-takeover operations and blind x402 payments exploit exactly that gap. An agent given a key has no bound on what that key can do. The faster and cheaper chains get, the less any of this can be undone.

The gap exists on every chain, in a different shape on each: EVM approvals and delegatecalls, Stellar signer and trustline operations and Soroban auth entries, Casper session code and associated keys.

## 2. Solution

Baret is one engine that runs **before the signature** on every supported chain:

1. Decodes and simulates the transaction against current chain state.
2. Turns the result into one common model of effects (balance changes, allowances, authority changes, counterparties).
3. Runs risk detectors and reputation/compliance lookups over it.
4. Applies the owner's own policy and returns `safe / caution / blocked` with reasons and the exact balance changes.

For agents, Baret adds an **on-chain spend limit** (per merchant, per transaction, per day) that holds even if the agent or its key is compromised, and checks every x402 payment before it is signed.

## 3. Users and surfaces

| User | Need | Surface |
|---|---|---|
| Person with a wallet | "What happens if I sign this?" | `apps/extension` — multichain wallet with the check before every signature |
| dApp / wallet developer | Protect users before they sign | `@baret/guard` SDK + `/v1/analyze` API |
| Agent developer | Let an agent transact and pay without unlimited authority | `@baret/agent-kit` (guarded signer, x402, CLI) + on-chain spend limit + MCP tools |
| Wallet / infrastructure provider | Ship a security layer to their users | API plans, enterprise integration |

## 4. Business model

Revised 2026-11-07. Numbers are base-case targets from the investor model, not facts. Source of truth for the numbers: the hub repo (`../investor-source/model.py`, summary in `../README.md`); if they change there, update this section.

**Principle: businesses pay; people get protection free.** In wallet security the end user does not pay; wallets and platforms do, and they buy a licence. The extension and the on-chain spend limits are free: they are the showcase, the distribution and the source of threat data.

| Line | Buyer | Price | Role |
|---|---|---|---|
| Wallet & platform licence | Wallets, exchanges, custodians, agent platforms, stablecoin issuers, PSPs | $25k–150k/year flat (fair-use checks, SLA, custom rules/detectors, identity checks, reporting) | **Main revenue.** A wallet runs millions of checks; per-check pricing does not fit it |
| Developer plans | Small wallets, dApps, agent developers | Free 10k checks/month · Builder $99 · Growth $499 · Scale $1,500+ | Funnel toward licences |
| Pay per check | AI agents | $0.005 per verdict over x402, no account | Growth line; scales with agent transactions |
| Ecosystem grants | Chain foundations (Stellar, Casper, Monad, Arc) | per programme | **Not revenue**: non-dilutive cash that funds each chain integration |

Not done on purpose: fees on users' transactions or swaps (conflicts with a neutral security layer); a percentage of agent payment volume.

Base case (24 months from the round, M1 = Jan 2027): free pilots M7–9 with one wallet and one agent platform; first paid licence M10; seven $40k licences by M24; agent checks from M7. ARR M12 $87k · M18 $337k · M24 $607k; monthly break-even M19; M18 revenue mix 47% licences / 42% developer plans / 10% agent checks. Grants assumed: $170k, excluded from ARR.

**What this asks of the product:**
- Usage metering and API keys early (before the first pilot, not at mainnet), so a pilot shows who used what. → `TASKS.md` T2.10.
- Licence features: per-customer rules and detectors, SLA-grade monitoring, usage reports. → Phase 6.
- x402 pay-per-check on `/v1/analyze`. → Phase 6.

Investor-facing milestones: Q1 2027 one repo / one core; Q2 2027 audited EVM mainnet (Monad, Arc, Base) + Stellar in the core + paid checks; H2 2027 pilots and first paid licence; H1 2028 four licences and the seed round.

## 5. Scope

**First target (this codebase, phases in `TASKS.md`):**
- Engine + API serving EVM (Monad first), Stellar and Casper.
- Multichain extension wallet (EVM first, then Stellar, then Casper).
- Web app: landing, threat showcase per chain, `/agents`, developer portal.
- `@baret/guard` and `@baret/agent-kit` on npm, multichain.
- On-chain spend limit on each family.
- x402: policy check on the buyer side; Baret's own API sold over x402.

**Not now (backlog, see `TASKS.md` → Later):** standalone passkey web wallet, MetaMask Agent Wallet plugin, Qwen agent reviewer demo, sealed on-chain settings, Chainlink CRE oracle, Solana and Midnight families.

## 6. Non-goals

- Not a DEX, bridge or trading interface.
- Not a custodian: Baret never holds a user's keys or funds (the EVM/Casper vaults are owned by the user's account).
- Not "works on any chain by pasting an RPC": every chain is listed, tested and documented before it is enabled.

## 7. Success criterion (the "magic moment")

A person with no technical knowledge tries a risky scenario in the showcase on any supported chain and within 30 seconds feels: "I almost lost my money; Baret stopped it, and I understand why."

## 8. Glossary

| Term | Meaning |
|---|---|
| **Family** | A group of chains sharing one transaction model and one adapter (EVM, Stellar, Casper) |
| **Adapter** | The package that teaches the engine one family: decode, simulate, effects, family detectors, wallet operations |
| **Effects** | The chain-agnostic description of what a transaction does (balance changes, allowances, authority changes, counterparties) |
| **Finding** | One detector result: a code, values, severity, and whether it blocks under the policy |
| **Verdict** | The engine's answer: decision + findings + effects + confidence + expiry |
| **GuardPolicy** | The owner's rules, as JSON; templates `strict`, `balanced`, `permissive` |
| **Spend limit** | The on-chain bound on what an agent may pay (vault or policy signer) |
| **x402** | HTTP 402-based payments for agents and APIs |
| **CAIP-2 / -10 / -19** | Chain-agnostic identifiers for chains, accounts and assets |
