# Security

Status: **planned**
Last verified: 2026-11-07

Baret is a security product; its own weaknesses are product defects.

## 1. Threat model (summary)

| Asset | Threat | Defence |
|---|---|---|
| User keys (extension) | malicious page, XSS in extension pages, malware | keys only in the background worker while unlocked; passphrase-encrypted storage; strict CSP; origin from the browser; no remote code |
| The verdict | spoofed / replayed / stale answer | HTTPS; schema-checked answer; `expiresAt` + chain checked by the signer; optional signed attestation |
| The decision | a bug or outage makes risky look safe | fail-closed everywhere; unreachable = Blocked; on-chain spend limit as last line |
| Agent funds | leaked agent key, prompt injection | on-chain caps per merchant/tx/day; agent-kit refuses non-Safe; LLMs never decide |
| API | abuse, cost drain (paid providers, LLM) | per-IP and per-key limits, daily budgets, keys in production |
| Contracts | logic bugs, admin key compromise | tests + fuzzing, external audit before mainnet, multisig owner, hardware deployer |
| Supply chain | malicious dependency | lockfile, `minimumReleaseAge` for new versions (as in Metropolis), pinned actions, few dependencies in `core`/`guard` |

## 2. Rules

- No secret in the repo, logs, docs or error messages (`pnpm secrets:check` in CI).
- Testnet relayer and demo keys hold testnet funds only and are never reused on mainnet.
- Every mainnet contract: audit report linked in `docs/architecture/contracts.md` before its address is enabled in the registry.
- Responsible disclosure: `SECURITY.md` at the repo root (Phase 0 task).

## 3. Audit plan

Budget line exists in the investor plan (security/audit ~17% of spend). Order: EVM contracts (`PaymentGuard`, factory, registry) → Stellar `MerchantSpendPolicy` → Casper contracts → extension key handling review → engine fail-closed review.
