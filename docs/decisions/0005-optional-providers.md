# 0005 — External providers are optional and ported selectively

Status: Accepted
Date: 2026-11-07
Deciders: Ezgin (owner), planning session

## Context
Metropolis integrated many hackathon sponsors (Nansen, Cleanverse, Envio, Chainlink CRE, KIMI, Qwen, Mera, Dynamic, MetaMask Agent Wallet, SealedStore), several of them Monad-only.

## Decision
All external sources sit behind interfaces in `packages/providers` (`docs/architecture/providers.md`). The first multichain release ports only those that add product value independent of a hackathon: on-chain reputation registry, threat feeds, Nansen (optional), indexer, LLM explain/policy draft. The rest (Qwen review demo, SealedStore, MetaMask plugin, Mera, Dynamic, CRE oracle) go to the backlog.

## Consequences
Smaller first port; the product works with every provider off (lower coverage, fail-closed rules). Each provider adds env variables, a daily budget if paid, and a `/health/ready` entry.

## Alternatives considered
Port all as they are (much Monad-only code to generalise); port none (loses real value such as reputation).
