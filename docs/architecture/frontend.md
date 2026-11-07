# Frontend: extension, web app, shared UI

Status: **in progress** — `packages/ui`, `packages/web-ui`, `packages/routes` and the shared part of `packages/content` ported (2026-11-07); `apps/web` landing ported (2026-11-08), other pages and the extension next
Last verified: 2026-11-08

Owns `apps/extension`, `apps/web`, `packages/wallet-core`, `packages/ui`, `packages/web-ui`, `packages/content`.

## 1. Principle

The Metropolis frontend (extension, showcase, design system, content) is the most finished part of all Baret versions and is taken over almost entirely. What changes is **underneath the screens**: every place that assumes Monad (chain id, `MON`, USDC address, viem calls, explorer links) is replaced by data from `packages/chains` and calls to `wallet-core`, which delegates to the family adapters. The look and copy stay; the brand system (`Baret-Metropolis/docs/BRAND.md`) is ported as `packages/ui` + a brand section in this doc.

Measured Monad coupling in Metropolis (files mentioning Monad / importing viem): showcase 57 / 34, extension 41 / 6, content 45 / 1, web wallet 18 / 0, wallet-ui 15 / 0, ui 0 / 0. The design system ports as is; the others need a pass.

## 2. `apps/extension` — multichain wallet

Ported from `Baret-Metropolis/apps/extension` (WXT, React, MV3; Chrome + Firefox builds).

### 2.1 Keys and accounts (ADR-0004)

- One BIP-39 seed, encrypted in IndexedDB with the passphrase (existing keystore).
- Accounts derived per family from the same seed:

| Family | Curve | Path (index `i`) | Compatibility target |
|---|---|---|---|
| EVM | secp256k1 | `m/44'/60'/0'/0/i` | MetaMask |
| Stellar | ed25519 (SLIP-10) | `m/44'/148'/i'` | SEP-0005, Freighter |
| Casper | secp256k1 or ed25519 | `m/44'/506'/0'/0/i` | Casper Wallet (to be verified, Phase 4) |

- A family's accounts appear only when that family is enabled in the build (feature flag from `packages/chains`), so EVM can ship before Stellar and Casper are ready.
- Keys live only in the background service worker's memory while unlocked; auto-lock on idle.

### 2.2 Providers injected for dApps

| Family | Provider | Status |
|---|---|---|
| EVM | EIP-1193 `window.ethereum` + EIP-6963 announcement; `wallet_switchEthereumChain` among enabled EVM chains | ported (Metropolis) |
| Stellar | Interface compatible with what Stellar dApps call (SEP-43 / Stellar Wallets Kit module; Freighter-like `signTransaction`, `signAuthEntry`) | research, Phase 3 (legacy: `window.baretStellar` wallet-standard in Baret-Stellar) |
| Casper | Casper Wallet-compatible provider and/or CSPR.click integration | research, Phase 4 (legacy: `window.baret` in CasperBaret) |

### 2.3 Signing flow

Every request (transaction, message, auth entry, x402 payment) goes through one queue → approval window → `wallet-core.check()` → verdict card → Sign / Reject. Blocked needs a deliberate hold to override; an unreachable server is Blocked. The origin is taken from the browser, not from the page.

### 2.4 Screens that change for multichain

Home (balances grouped by chain), account switcher (per family), network selector, Send/Receive (address format per family), Connect (which family the site asked for), Activity (per chain explorer links), Allowances/revoke (EVM first; Stellar/Casper equivalents per adapter), Settings → per-chain policy.

## 3. `apps/web` — public site

Ported from `Baret-Metropolis/apps/showcase` (Vite + React), page by page. **Ported:** the landing, the not-found page and the showcase hub (`/showcase`: the scenario cards live in `web/hub.content.ts`, one per site with its CAIP-2 chain, ready for the chain filter), with the build pipeline (prerender, per-route heads, sitemap), the Vercel middleware and `vercel.json`. The landing copy (`packages/content/src/web/home.content.ts`) is rewritten for multichain: Monad testnet named as the only live chain, Stellar and Casper as next, no provider named, numbers from the code; it is a draft the owner reviews before production. The demo sites' chain code lives in `packages/demo-evm` (ADR-0010: addresses from the registry's `showcase` section, transaction and x402 builders, analyze bodies, the wallet connection); `apps/web` keeps their screens. The demo kit (`apps/web/src/sites/kit`: Baret panel, site frame, wallet picker, sign block) is ported and reads the v2 verdict; its copy is `web/demo.content.ts` and `web/panel.content.ts`. The Metropolis "Baret web wallet" window (a passkey wallet in a popup) is not carried over; the picker lists the browser's wallets, the Baret extension first-class among them. Links to pages not yet ported are listed in `PENDING_PATHS` (`apps/web/src/routes.ts`), and the route test accepts no other dead link. Contents when complete:

- Landing + install page (links to the latest extension build).
- **Threat showcase**: one scenario catalogue, filterable by chain. Each scenario = a fake dApp with a safe and a dangerous variant, running against real testnet contracts. Sources: Metropolis (SCRYBE, NOVASWAP, PIXELDROP, ORBITYIELD, CLAIMHUB, LAUNCHPAD on Monad), Baret-Stellar (7 demo dApps), CasperBaret (6 demo dApps). A scenario is shown only for chains whose capabilities can demonstrate it.
- `/agents`: agent-kit playground (spend limit, x402, guarded submit).
- Developer portal: API reference generated from the route schemas (not hand-written), SDK quickstarts.

Deployed on Vercel; `/api/*` rewrites to the API of the environment (`docs/operations/deployment.md`).

## 4. Shared packages

| Package | Role | Change from Metropolis |
|---|---|---|
| `wallet-core` | Keyring, sessions, `check(request)` → verdict, `sign(request, verdict)`, per-account policy store | Rewritten around `WalletAdapter`s; Mera passkey account dropped for now |
| `ui` | Tokens + components (light and dark) | none — **ported**; the network colour becomes per chain (T2.12) |
| `web-ui` | Type, motion, layout, fonts and the check-result blocks (`CheckBlocks`) for the web app | **ported**; `CheckBlocks` reads the new chain-neutral `shared/check` content instead of showcase and wallet page strings; the `/v1/explain` client waits for its route (T2.7) |
| `routes` | Route registry type, `buildHref`, registry and link checks (shared by the web app, the extension options page, a web wallet) | **ported** unchanged |
| `content` | Every word: findings, policy fields, check results, screens (English; explanations can be asked in `tr`/`zh`) | **shared strings ported**: codes unified (ADR-0006), rules keyed by v2 paths, chain-neutral wording; which codes a rule decides comes from `FINDING_SPECS`, not from content |

## 5. Not taken over (now)

- Metropolis `Baret-Metropolis/apps/wallet` (Mera passkey web wallet) and its `wallet-ui` package: Monad/Mera-specific. Backlog: a passkey wallet per family (Stellar passkey-kit smart wallets are the natural second one).
- Metropolis `metamask-plugin`, `demo` and `routes` packages: re-evaluated when needed.

## 6. Testing

Component tests with Vitest + Testing Library (ported). Browser end-to-end tests (Playwright) for the extension signing flow and the showcase scenarios are a Phase 2 task (Metropolis G-20: none existed).
