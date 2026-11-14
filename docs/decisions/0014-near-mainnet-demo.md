# ADR-0014: The NEAR demo also runs on mainnet, with tiny limits

Status: Accepted (owner, 2026-11-14)

## Context

Everything on NEAR ran on testnet. The owner asked for mainnet before the NEAR HACKATHON 2026 submission and funded it (6.3 NEAR). The contracts are not audited, so mainnet must hold little; and Baret's own counterparty rules (`REPUTATION_FRESH_ACCOUNT` under 72 hours, `COUNTERPARTY_FIRST_PAYMENT`) answer Caution for any shop opened the same day, so a mainnet demo cannot show "a normal payment is Safe" until its shop is three days old and has been paid once.

## Decision

- The same code as testnet goes to mainnet: the vault is release `near-vault-v0.2.1` (code hash `EzvurumZ…JbYF`), the blocklist the main CI build of #67 (`7n1ZnuQv…MrFy`). Each contract account is created, deployed and initialised in one transaction by `baret.near`, so it never holds an access key (`packages/demo-near/scripts/mainnet.ts`).
- Accounts: `baret.near` (owner), `vault.baret.near`, `blocklist.baret.near` (threshold 2), `agent.baret.near` (the owner's full access key; the agent process holds only a function call key for the vault's two agent methods), `shop.baret.near`, `newshop.baret.near`. The prompt-injection payee is `drain-it-all.baret.near`, a name only `baret.near` could create, so the blocklist names no stranger.
- Limits: 0.05 NEAR a payment, 0.2 NEAR a rolling day; about 0.55 NEAR to spend. The demo pays 0.02 NEAR (`DEMO_AMOUNTS`).
- The live panel (`/near`) and `pnpm near:verify` stay on testnet until the mainnet shop is older than 72 hours and has been paid (from 2026-11-17), so a Safe check means Safe. Mainnet is recorded as runs with their transactions; switching `DEMO_CHAIN` is then one line.
- Chain Signatures stay on testnet: a mainnet EVM payment needs real gas on the EVM side, and the MPC fee on mainnet is not verified.

## Consequences

- Real money is at stake, bounded by the limits and the vault balance; the owner can `withdraw` or `set_paused` at any time.
- The registry has `deployments/near-mainnet.json`, so the API treats the vault and blocklist as Baret's own and reads the blocklist on mainnet.
- The owner key for mainnet lives only in `packages/demo-near/.env.near` (gitignored); it must be backed up.
