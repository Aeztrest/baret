# 0004 — One multichain wallet from one seed

Status: Accepted
Date: 2026-11-07
Deciders: Ezgin (owner), planning session

## Context
Metropolis's extension is a real wallet (own seed, injected provider, check before every signature). The Stellar and Casper legacy extensions were separate wallets.

## Decision
`apps/extension` is one wallet for all families: one BIP-39 seed, accounts derived per family (EVM `m/44'/60'/0'/0/i`, Stellar `m/44'/148'/i'`, Casper per Casper Wallet compatibility), one approval flow, per-account per-chain policy. Families are switched on per build as their adapters are ready (EVM first).

## Consequences
One product for users and investors; one security review. The extension must implement each family's dApp provider convention (research for Stellar and Casper). Key-handling code becomes the most security-critical part of the repo.

## Alternatives considered
- A firewall in front of existing wallets: no key custody, but needs per-wallet interception and breaks often.
- API + SDK first, wallet later: aligned with revenue but loses the consumer demo.
