# External providers

Status: **planned**
Last verified: 2026-11-07

External data and model services, all **optional** and behind interfaces in `packages/providers` (ADR-0005). The rule: a provider that is not configured is `skipped`; one that fails is `unavailable`; either way only the policy rules that needed it fail (closed). The product must work, with lower coverage, with every provider off.

## 1. Interfaces

| Interface | Answers | Keyed by |
|---|---|---|
| `ReputationSource` | `malicious` / trust level (`new`, `known`, `trusted`) / labels | CAIP-10 |
| `ComplianceSource` | credential present, expiry, tier, country | CAIP-10 |
| `PriceSource` | USD price of an asset (for loss % across assets) | CAIP-19 |
| `IndexerSource` | vault / payment / reputation history | CAIP-10 |
| `LlmClient` | schema-checked JSON answers; tool-using agent loop | — |

## 2. Implementations and their fate

| Provider | Interface | Chains | Legacy | v1? |
|---|---|---|---|---|
| Baret `ReputationRegistry` (on chain) | Reputation | EVM | Metropolis | yes (EVM) |
| Public threat feeds (e.g. ScamSniffer list) | Reputation | EVM | Metropolis (via CRE) | yes, read directly by the API; CRE oracle in backlog |
| Nansen | Reputation | EVM (Nansen-covered chains) | Metropolis | yes, optional, daily budget |
| Stellar expert / community lists | Reputation | Stellar | Baret-Stellar | research |
| Cleanverse | Compliance | EVM (Monad) | Metropolis | optional |
| Envio HyperIndex | Indexer | EVM | Metropolis | yes (Monad first) |
| KIMI (Moonshot) / Qwen / Claude | LLM | — | Metropolis (KIMI explain, Qwen reviewer) | explain + policy draft in Phase 2; model choice open |
| Dynamic (MPC server wallet) | agent signer | EVM | Metropolis | backlog |
| Mera (passkey smart account) | wallet | Monad | Metropolis | backlog |

Every provider's env variables are listed in `docs/operations/environments.md`; every paid one has a daily budget variable and appears in `/health/ready`.
