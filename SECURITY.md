# Security Policy

Baret decides whether a transaction should be signed. A flaw in Baret can turn a "Blocked" into a "Safe", so security reports are the most important issues we get. Threat model and rules: `docs/operations/security.md`.

## Status

- **Testnet only.** No contract of this repository holds mainnet value yet. Mainnet deployments will be listed in `docs/architecture/contracts.md` with their audit reports.
- **No paid bug bounty yet.** Reporters are credited in the fix's release notes unless they ask not to be.

## How to report

Use GitHub's private vulnerability reporting on this repository (Security → Report a vulnerability). Do not open a public issue or pull request for a vulnerability, and do not disclose it publicly before a fix is released.

Include: the affected component (API route, package version, contract address, extension version), the impact in one sentence, exact steps to reproduce (request body, transaction, typed data, policy template), expected vs. actual result, and any testnet transaction hash.

Never send a private key, seed phrase or API key. Use a fresh test key for anything you sign.

## Response targets

| Step | Target |
|---|---|
| Acknowledge | 72 hours |
| Triage (confirmed or not, severity) | 7 days |
| Fix | by severity; a bypass of a Blocked verdict or a loss of funds comes first |

## Scope

In scope: `apps/api`, `apps/extension`, `apps/web`, every package in `packages/`, every contract in `contracts/`.
Out of scope: third-party RPC providers and data providers, the legacy per-chain Baret repositories, denial of service by volume against the free staging API.
