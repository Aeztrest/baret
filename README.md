# Baret

**Give an AI agent money without giving it the keys.**

Before anything is signed, Baret reads the transaction, checks what it would actually do against the chain's current state, applies the owner's policy and answers `safe`, `caution` or `blocked`, with reasons. For agents, an on-chain vault bounds what the agent's key can pay, so even a compromised or prompt-injected agent cannot go past the owner's limits.

> **Testnet.** Everything below runs on NEAR testnet and Monad testnet (the NEAR Intents check reads NEAR mainnet and signs nothing). Nothing is audited. Baret's earlier per-chain builds (Monad, Stellar, Casper, GOAT, Midnight, Solana) are being ported into this repository; their status is in [`docs/chains/README.md`](docs/chains/README.md).

**Live demo:** [baret-nine.vercel.app/near](https://baret-nine.vercel.app/near) reads the demo vault on NEAR testnet and asks Baret's API about four agent requests.

## NEAR HACKATHON 2026

Built for NEAR HACKATHON 2026 (tracks: security, agents). The work done during the hackathon is the diff [`pre-hackathon…hackathon-submission`](https://github.com/Aeztrest/baret/compare/pre-hackathon...hackathon-submission).

### The problem

An agent that pays needs a key. Today it usually gets a full access key, so a prompt injection ("send everything to x.near"), a bad tool result or a leaked key empties the account. Checking the transaction off chain helps, but nothing stops a compromised agent from skipping the check.

### How it works

```
owner ──funds, sets limits──▶ Baret vault (NEAR contract)
                                  ▲            │ MPC (Chain Signatures)
agent ──function call key─────────┘            ▼
  │                                        EVM chain (Monad testnet)
  └──▶ Baret API /v1/analyze: "is this safe to sign?" (before every payment)
```

Two lines of defence:

1. **Baret before signing.** The agent sends the transaction to `/v1/analyze`. Baret reads the chain over RPC (accounts, keys, the vault's policy and remaining allowance) and finds what the transaction would do: a full access key added, the account deleted, a contract deployed, a receiver nobody listed, a payment over the limit. It answers `safe`, `caution` or `blocked` with codes. The agent signs only `safe`.
2. **The vault on chain.** The agent holds only a function call key that can call two methods of the vault. The vault enforces the owner's per-transfer and 24-hour limits per asset, the receiver list and a pause switch. If the agent skips Baret, the vault still refuses.

The same vault pays on an EVM chain through **NEAR Chain Signatures**: it builds the EIP-1559 transfer itself, counts value plus the worst-case fee against the same limits, and only then asks NEAR's MPC network to sign. A **NEAR Intents** swap is checked against its 1Click quote: whoever the quote pays out or refunds to must be the agent itself, and the deposit must match the quote.

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

### Run the agent yourself

Requirements: Node 22, pnpm 11, a funded NEAR testnet account (`near account create-account sponsor-by-faucet-service <name>.testnet` with [near-cli-rs](https://github.com/near/near-cli-rs)).

```bash
pnpm install
cd packages/demo-near
cp .env.example .env.near        # your testnet account and key; never commit .env.near
pnpm keys && pnpm accounts       # vault, agent and shop sub-accounts
pnpm deploy-vault -- ./baret_near_vault.wasm   # the wasm from the "Contracts (NEAR)" CI run
pnpm setup-vault && pnpm agent-key
pnpm agent -- pay                # Baret: SAFE → the vault pays the shop (explorer link)
pnpm agent -- wrong-receiver     # a prompt-injected receiver → BLOCKED, not signed
pnpm agent -- wrong-receiver --force   # sent anyway → the vault refuses E_RECEIVER_NOT_ALLOWED on chain
pnpm agent -- add-key            # a prompt asks for a full access key → BLOCKED (AUTHORITY_CHANGE)
```

Chain Signatures (`pnpm evm-setup`, then `pnpm agent -- evm-pay`), the NEAR Intents check (`pnpm intents-check`) and the Agent Market worker (`pnpm market-agent`) are in [`packages/demo-near/README.md`](packages/demo-near/README.md).

### Recorded runs (testnet)

| Request | Baret | On chain |
|---|---|---|
| Pay the shop 0.1 NEAR | Safe | [paid](https://testnet.nearblocks.io/txns/AoFv4uUaRNo3k5VDRPPPevwwNFZrvuXpaEpg4fhMdbvr) |
| Pay the shop 5 NEAR | Blocked (`E_PER_TRANSFER_LIMIT`) | `--force`: refused by the vault |
| Pay an account a prompt named | Blocked (`E_RECEIVER_NOT_ALLOWED`) | `--force`: refused by the vault |
| Add a full access key | Blocked (`AUTHORITY_CHANGE`) | `--force`: refused by NEAR (the key cannot add keys) |
| Pay 0.01 MON on Monad testnet through Chain Signatures | Safe on both chains | [NEAR](https://testnet.nearblocks.io/txns/AYeXGS4GUexwcYE9X3BBWm2FsFvizkm7Dw5AsbJYLHPv) · [Monad](https://testnet.monadexplorer.com/tx/0x2796a4ad2edb515dde729c1d6c51475fd15b3884883c991ddcf4a6c94253afb8) |
| Pay 0.01 MON to an address a prompt named | Blocked on both | `--force`: refused by the vault |
| NEAR Intents swap, quote as given (mainnet) | Caution (app fee) | not signed |
| The same quote paying out to another account | Blocked (`INTENTS_RECIPIENT_MISMATCH`) | not signed |

### Contracts (NEAR testnet)

| | Account | Source |
|---|---|---|
| Baret vault | [`baret-vault.aeztrest-baret.testnet`](https://testnet.nearblocks.io/address/baret-vault.aeztrest-baret.testnet) | [`contracts/near/vault`](contracts/near/vault) |
| Demo agent | [`baret-agent.aeztrest-baret.testnet`](https://testnet.nearblocks.io/address/baret-agent.aeztrest-baret.testnet) | function call key only |
| Demo shop | [`baret-shop.aeztrest-baret.testnet`](https://testnet.nearblocks.io/address/baret-shop.aeztrest-baret.testnet) | the vault's only NEAR receiver |
| Vault's EVM address (Chain Signatures, path `eip155`) | `0x95689e53febe21bf2c12833ddca29d95b2ed5b27` on Monad testnet | derived by NEAR MPC |

The record is [`packages/chains/deployments/near-testnet.json`](packages/chains/deployments/near-testnet.json).

### NEAR features used

Function call access keys and allowances · NEP-141 tokens · near-sdk contract with promises and callbacks · Chain Signatures (`v1.signer-prod.testnet`, `payload_v2`) · NEAR Intents 1Click quotes · NEAR Agent Market (self-hosted agent API) · JSON-RPC `query` / `call_function` reads.

### Baseline and what was used

Before the hackathon this repository held the chain-neutral core, the EVM adapter and the web app, ported from Baret's earlier builds (tag `pre-hackathon`). During the hackathon: the NEAR chain family (ADR-0011), the vault contract, the `chain-near` engine adapter, the NEAR demo agent and scripts, Chain Signatures, the NEAR Intents check, the Agent Market worker and the `/near` page. Libraries: near-sdk (Rust), near-api-js, zod, Fastify, React, Vite, Vitest, Biome, `@noble/hashes`, `@scure/base`. Much of the code was written with AI assistance (Claude Code) and reviewed by the author.

### Limitations

Testnet only, not audited. The vault holds native NEAR and NEP-141 tokens; its Chain Signatures path signs native EVM transfers only (no calldata). The Intents check does not verify the 1Click quote's signature (no public key is published) and does not yet allow cross-chain recipients. The staging API is a free instance that sleeps when idle.

## Documentation

| Start here | |
|---|---|
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | What Baret is, for whom, and what it promises |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The map: layers, packages, flows, deployment |
| [`docs/chains/near.md`](docs/chains/near.md) | NEAR: the vault, the engine adapter, Chain Signatures, Intents, Agent Market |
| [`docs/chains/README.md`](docs/chains/README.md) | Supported chains and their status |
| [`docs/README.md`](docs/README.md) | Every document, and which code it owns |
| [`TASKS.md`](TASKS.md) | Where the project is and what comes next |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for contributors and coding agents |

## Repository layout

```
apps/        api (Render) · web (Vercel)
packages/    core · chains · engine · chain-evm · chain-near · guard · content · ui · web-ui · routes
             demo-evm · demo-near
contracts/   evm (Foundry) · near (near-sdk)
tooling/     docs, secrets and import checks, session hooks
docs/        architecture, chains, operations, decisions, migration
```

## Checks

```bash
pnpm test            # all packages
pnpm docs:check      # documentation consistency
pnpm secrets:check   # secret scan
```

All run in CI on every pull request.

## License

See [`LICENSE`](LICENSE).
