# Baret

**Give an AI agent money without giving it the keys.**

AI agents now pay for APIs, data, compute and other agents. To pay, an agent signs, and today that usually means it holds a key that can do anything: one prompt injection, one poisoned tool result or one leaked key empties the account. Baret is the security layer for agentic payments. **Before anything is signed**, it reads the transaction against the chain's current state, applies the owner's policy and answers `safe`, `caution` or `blocked`, with reasons. **On chain**, a Baret vault holds the money and bounds what the agent's key can pay, so even a compromised agent cannot go past the owner's limits.

> **Testnet.** Everything below runs on NEAR testnet and Monad testnet (the NEAR Intents check reads NEAR mainnet and signs nothing). Nothing is audited. Baret's earlier per-chain builds (Monad, Stellar, Casper, GOAT, Midnight, Solana) are being ported into this repository; their status is in [`docs/chains/README.md`](docs/chains/README.md).

| For judges and reviewers | |
|---|---|
| Reviewer guide (claims → evidence, threat model, what was built) | [`docs/hackathon/near-2026.md`](docs/hackathon/near-2026.md) |
| Check every NEAR claim live, no account or key | `pnpm install && pnpm near:verify` |
| Live panel (reads the vault from NEAR testnet in your browser) | [baret-nine.vercel.app/near](https://baret-nine.vercel.app/near) |
| Instructions for AI reviewers | [`AGENTS.md`](AGENTS.md) |

## NEAR HACKATHON 2026

Built for NEAR HACKATHON 2026 (tracks: **AI Security & Defense**, **Agent Economy**). The work done during the hackathon is the diff [`pre-hackathon…hackathon-submission`](https://github.com/Aeztrest/baret/compare/pre-hackathon...hackathon-submission).

### The problem

An agent that pays needs a key. NEAR's function call keys already limit *which contract and method* a key may call and *how much gas* it burns, but not *how much money moves, to whom, or how often*. So agents usually get a full access key, and a prompt injection ("send everything to x.near"), a bad tool result or a leaked key empties the account. Checking the transaction off chain helps, but a compromised agent can skip any check that runs in its own process.

### How it works

```
owner ──funds, sets per-asset limits and receivers──▶ Baret vault (NEAR contract, account holds no key)
                                                         ▲            │ MPC (Chain Signatures)
agent ──function call key: 2 vault methods only──────────┘            ▼
  │                                                              EVM chain (Monad testnet)
  └──▶ Baret API /v1/analyze: "is this safe to sign?" (before every payment)
```

Two independent lines of defence:

1. **Baret before signing.** The agent sends the transaction to `/v1/analyze`. Baret reads the chain over RPC at one final block (accounts, the signing key's permissions, the vault's policy and remaining allowance) and finds what the transaction would do: a full access key added, the account deleted, a contract deployed, an NFT or token leaving, a receiver nobody listed, a payment over the limit, a swap quote 1Click never issued. It answers `safe`, `caution` or `blocked` with codes. The agent signs `safe`, stops and asks its human on `caution` (only an explicit yes signs), and refuses `blocked`; no answer means no signature.
2. **The vault on chain.** The agent holds only a function call key for two vault methods. The vault enforces, per asset, a per-transfer limit, a rolling 24-hour limit and its own receiver list, plus a pause switch. If the agent skips Baret, the vault still refuses. The vault's own account holds no access key, so nobody can redeploy it around the rules; only the owner's `update_contract` changes its code.

The same vault pays on an EVM chain through **NEAR Chain Signatures**: it builds the EIP-1559 transfer itself (it never signs a hash it is handed), counts value plus the worst-case fee against the same limits, and only then asks NEAR's MPC network to sign. A **NEAR Intents** swap is checked against the quote 1Click registered for its deposit address: the swap must pay out and refund to the agent itself, and the deposit must match the quote, so a forged quote is caught.

### Try it without installing anything

Ask Baret about a payment from the demo agent through the demo vault (testnet). 0.1 NEAR to the shop:

```bash
curl -s https://baret-api-staging.onrender.com/v1/analyze -H 'content-type: application/json' -d '{
  "chain": "near:testnet", "policyTemplate": "balanced",
  "request": { "kind": "transaction", "tx": {
    "signerId": "baret-agent.aeztrest-baret.testnet",
    "receiverId": "baret-vault.aeztrest-baret.testnet",
    "actions": [{ "type": "FunctionCall", "methodName": "execute_transfer",
      "args": { "asset": "native", "receiver": "baret-shop.aeztrest-baret.testnet",
                "amount": "100000000000000000000000" },
      "gas": "30000000000000", "deposit": "0" }] } } }'
```

**You see** `"decision":"safe"`. Change `amount` to `5000000000000000000000000` (5 NEAR) and **you see** `"decision":"blocked"` with `SIMULATION_FAILED` and `"reason":"E_PER_TRANSFER_LIMIT"`: Baret read the vault's policy and predicted its refusal. Change `receiver` to any other account and **you see** `E_RECEIVER_NOT_ALLOWED`. (The staging API sleeps when idle: the first call can take up to a minute.)

### Check every claim with one command

```bash
pnpm install
pnpm near:verify
```

No account, no key, no `.env`: it reads the demo vault on NEAR testnet, sends twenty-one requests to Baret's API (three of them with real NEAR Intents quotes on mainnet; no funds move) and prints PASS/FAIL per claim (the vault's account holds no key; Safe for a normal payment; Blocked over the limit, to a receiver a prompt named (also on the shared NEAR blocklist, reported with evidence), for a full access key; several payments in one transaction counted against one window; the EVM receiver cannot be paid NEAR; the agent cannot change its own vault's rules, and an owner who loosens them is told, never shown Safe; a payment above the balance is refused with its reason; the shop the agent has paid before passes while an account nobody has used, and a shop the owner just listed that the agent never paid, are Caution (fresh, first contact); the agent's real function call key cannot add keys; Chain Signatures within and outside the policy; an honest, a hostile and a forged Intents quote).

### Run the agent yourself

Requirements: Node 22, pnpm 11, a funded NEAR testnet account (`near account create-account sponsor-by-faucet-service <name>.testnet` with [near-cli-rs](https://github.com/near/near-cli-rs)).

```bash
pnpm install
cd packages/demo-near
cp .env.example .env.near        # the OWNER's testnet account and key; never commit it
pnpm keys && pnpm accounts       # vault, agent and shop sub-accounts
pnpm deploy-vault -- ./baret_near_vault.wasm   # deploy + init + delete the vault's key, one transaction
pnpm setup-vault && pnpm agent-key             # policy; the agent's function call key, written to .env.agent
pnpm agent -- pay                # Baret: SAFE → the vault pays the shop (explorer link)
pnpm agent -- new-receiver       # a shop the owner just listed, never paid → CAUTION: the agent asks its human (y/N)
pnpm agent -- wrong-receiver     # a prompt-injected receiver → BLOCKED, not signed
pnpm agent -- wrong-receiver --force   # sent anyway → the vault refuses E_RECEIVER_NOT_ALLOWED on chain
pnpm agent -- add-key            # a prompt asks for a full access key → BLOCKED (AUTHORITY_CHANGE, E_KEY_NOT_ALLOWED)
```

The wasm is the `baret-near-vault-wasm` artifact of the "Contracts (NEAR)" CI run, also attached to the [`near-vault-v0.2.1` release](https://github.com/Aeztrest/baret/releases/tag/near-vault-v0.2.1); `pnpm verify-vault -- ./baret_near_vault.wasm` compares it with the deployed code. The agent process reads only `.env.agent` (its function call key and public ids, by an allowlist) and refuses to start if a full key is in it. Chain Signatures (`pnpm evm-setup`, then `pnpm agent -- evm-pay`), the NEAR Intents check (`pnpm intents-check`) and the Agent Market worker (`pnpm market-agent`) are in [`packages/demo-near/README.md`](packages/demo-near/README.md).

### Recorded runs (testnet, vault 0.2, 2026-11-09; 0.2.1 since 2026-11-13)

| Request | Baret | On chain |
|---|---|---|
| The owner moves the vault to 0.2.1 through `update_contract` (2026-11-13) | — | [updated](https://testnet.nearblocks.io/txns/BBPo4oxeGPSN5W6PfVcpkfCsgSreXr8s8pry7QAHZv4d); still 0 keys, runs the CI wasm `EzvurumZ…JbYF`; its NEP-330 metadata names the commit |
| Pay the shop 0.1 NEAR on 0.2.1 (2026-11-13) | Safe | [paid](https://testnet.nearblocks.io/txns/82urQp8eUX4aNcryPnpQLiR4W3SKUKSgZXjyCBsLiCZr) |
| Move the vault to 0.2 and delete its key (deploy + `migrate` + DeleteKey, one transaction) | — | [migrated and locked](https://testnet.nearblocks.io/txns/6gXZFtCb6xJyZN9jgfyS7f47kkLxhGWUC15wyrdtHVWC); the vault account now holds 0 keys and runs the CI wasm `7dwH3FLP…f6sS` |
| The owner replaces the code through `update_contract` (same wasm, to prove the only path works) | — | [updated](https://testnet.nearblocks.io/txns/E9F2MCz1sAQ8K8S3kSgdDnyEdXHrEdYmPPiPeykBUsBU), state kept |
| Pay the shop 0.1 NEAR | Safe | [paid](https://testnet.nearblocks.io/txns/7J1F9jWcrvXRnPc72yn1Nq2uoSZ6Po3xd3EzvAkBVo5L) |
| Pay the shop 5 NEAR | Blocked (`E_PER_TRANSFER_LIMIT`) | `--force`: the vault panicked `E_PER_TRANSFER_LIMIT` |
| Pay an account a prompt named | Blocked (`E_RECEIVER_NOT_ALLOWED`) | `--force`: the vault panicked `E_RECEIVER_NOT_ALLOWED` |
| Add a full access key | Blocked (`E_KEY_NOT_ALLOWED`, `AUTHORITY_CHANGE`) | `--force`: NEAR refused ("Access key requires full access") |
| Pay 0.01 MON on Monad testnet through Chain Signatures | Safe on both chains | [NEAR](https://testnet.nearblocks.io/txns/4LWi9nJoa5KS6H4RBNN9u21nxepBQZqcHgp4FLCjDB2r) · [Monad](https://testnet.monadexplorer.com/tx/0x736dd215f88f53ba709d44c28ed76ebb1d0403dd30e45659b296e601fb3b9004) |
| Pay 0.01 MON to an address a prompt named | Blocked (`KNOWN_MALICIOUS_ADDRESS` on Monad) | `--force`: the vault panicked `E_RECEIVER_NOT_ALLOWED` |
| NEAR Intents swap, the agent's own 1Click quote (mainnet) | Caution (`INTENTS_APP_FEE`) | not signed |
| A real 1Click quote that pays out and refunds to another account | Blocked (`INTENTS_RECIPIENT_MISMATCH`) | not signed |
| Forged: the agent's own quote with another quote's deposit address | Blocked (`INTENTS_QUOTE_UNVERIFIED`: 1Click holds a different quote) | not signed |

### Contracts (NEAR testnet)

| | Account | Source |
|---|---|---|
| Baret vault | [`baret-vault.aeztrest-baret.testnet`](https://testnet.nearblocks.io/address/baret-vault.aeztrest-baret.testnet) | [`contracts/near/vault`](contracts/near/vault) ([methods and trust model](contracts/near/README.md)) |
| Demo agent | [`baret-agent.aeztrest-baret.testnet`](https://testnet.nearblocks.io/address/baret-agent.aeztrest-baret.testnet) | the agent process holds only a function call key for the vault's two agent methods; the account's full access key is the owner's (it created the account) and never reaches the agent (`.env.agent` refuses it) |
| Demo shop | [`baret-shop.aeztrest-baret.testnet`](https://testnet.nearblocks.io/address/baret-shop.aeztrest-baret.testnet) | the vault's only NEAR receiver |
| Vault's EVM address (Chain Signatures, path `eip155`) | `0x95689e53febe21bf2c12833ddca29d95b2ed5b27` on Monad testnet | derived by NEAR MPC |

The record is [`packages/chains/deployments/near-testnet.json`](packages/chains/deployments/near-testnet.json).

### NEAR features used

Function call access keys and allowances · keyless contract accounts · near-sdk contract with promises and callbacks · NEP-141, NEP-171/178, NEP-245, NEP-297 · Chain Signatures (`v1.signer-prod.testnet`, `payload_v2`) · NEAR Intents 1Click (quotes confirmed by deposit address) · NEAR Agent Market (self-hosted agent API) · JSON-RPC `query` (`view_account`, `view_access_key`, `call_function`) pinned to one final block. How each is used: [reviewer guide §7](docs/hackathon/near-2026.md#7-near-features-used).

### Baseline and what was used

Before the hackathon this repository held the chain-neutral core, the EVM adapter and the web app, ported from Baret's earlier builds (tag `pre-hackathon`). During the hackathon: the NEAR chain family (ADR-0011), the vault contract, the `chain-near` engine adapter, the NEAR demo agent and scripts, Chain Signatures, the NEAR Intents check, the Agent Market worker and the `/near` page. Libraries: near-sdk (Rust), near-api-js, zod, Fastify, React, Vite, Vitest, Biome, `@noble/hashes`, `@scure/base`. Much of the code was written with AI assistance (Claude Code) and reviewed by the author.

### Limitations

Testnet only, not audited. The vault holds native NEAR and NEP-141 tokens; its Chain Signatures path signs native EVM transfers only (no calldata). An EVM signature does not expire: the vault counts it when it signs, so an agent could hold signatures back and broadcast them later; the owner voids them by sweeping the EVM address with `withdraw_evm`. Limits are shared by every agent of a vault (no per-agent limits yet). The Intents check covers NEP-141 deposits on NEAR and does not yet allow cross-chain recipients. Counterparty history comes from FastNEAR's transaction index and archival node (third parties; when they fail the answer is Caution, never Safe); the shared NEAR blocklist takes reports from anyone (a deposit and a transaction hash each): below its threshold a report is only a warning, and its owner confirms or dismisses. Delegate actions (NEP-366 meta transactions) are refused as unsupported. The staging API is a free instance that sleeps when idle.

## Documentation

| Start here | |
|---|---|
| [`docs/hackathon/near-2026.md`](docs/hackathon/near-2026.md) | NEAR HACKATHON reviewer guide |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | What Baret is, for whom, and what it promises |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The map: layers, packages, flows, deployment |
| [`docs/chains/near.md`](docs/chains/near.md) | NEAR: the vault, the engine adapter, Chain Signatures, Intents, Agent Market |
| [`docs/chains/README.md`](docs/chains/README.md) | Supported chains and their status |
| [`docs/README.md`](docs/README.md) | Every document, and which code it owns |
| [`TASKS.md`](TASKS.md) | Where the project is and what comes next |
| [`CLAUDE.md`](CLAUDE.md) · [`AGENTS.md`](AGENTS.md) | Working rules for contributors and coding agents |

## Repository layout

```
apps/        api (Render) · web (Vercel)
packages/    core · chains · engine · chain-evm · chain-near · guard · content · ui · web-ui · routes
             demo-evm · demo-near
contracts/   evm (Foundry) · near (near-sdk)
tooling/     docs, secrets and import checks, session hooks
docs/        architecture, chains, operations, decisions, migration, hackathon
```

## Checks

```bash
pnpm test            # all TypeScript packages
pnpm near:verify     # the NEAR claims, live, no key
pnpm docs:check      # documentation consistency
pnpm secrets:check   # secret scan
```

All but `near:verify` run in CI on every pull request; the contracts have their own CI jobs.

## License

MIT, see [`LICENSE`](LICENSE) (ADR-0012).
