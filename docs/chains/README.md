# Supported chains

Status: **in progress** (registry built in `packages/chains`: Monad testnet and Monad; no adapter serves them yet)
Last verified: 2026-11-07

The support matrix. Every chain that has a file in `packages/chains/chains/` must have a row here (`pnpm docs:check`). Status values: `planned`, `in progress`, `live (testnet)`, `live (mainnet)`.

| Chain | CAIP-2 | Family | Network | Simulation | Spend limit | x402 | Status | Phase |
|---|---|---|---|---|---|---|---|---|
| Monad testnet | `eip155:10143` | EVM | testnet | trace | PaymentGuard | yes | registry entry + deployments (factory, registry) checked on chain 2026-11-07; 19 showcase entries checked 2026-11-08 | 1 |
| Monad | `eip155:143` | EVM | mainnet | trace | PaymentGuard | yes | registry entry (USDC and trace RPC to confirm; x402 off until then) | 6 |
| Arc testnet | to confirm | EVM | testnet | trace (RPC provider to choose) | PaymentGuard | yes | planned | 5 |
| Arc | `eip155:5042` (from hub README; confirm) | EVM | mainnet | trace (RPC provider to choose) | PaymentGuard | yes | planned | 6 |
| Base Sepolia | `eip155:84532` | EVM | testnet | trace | PaymentGuard | yes | planned | 5 |
| Base | `eip155:8453` | EVM | mainnet | trace | PaymentGuard | yes | planned | 6 |
| Stellar testnet | `stellar:testnet` | Stellar | testnet | preflight | MerchantSpendPolicy | yes | planned (live in legacy repo) | 3 |
| Stellar | `stellar:pubnet` | Stellar | mainnet | preflight | MerchantSpendPolicy | yes | planned (deployed by legacy repo) | 3/6 |
| Casper testnet | `casper:casper-test` | Casper | testnet | to research | PaymentGuard | yes | planned (live in legacy repo) | 4 |
| Casper | `casper:casper` | Casper | mainnet | to research | PaymentGuard | yes | planned | 6 |
| NEAR testnet | `near:testnet` | NEAR | testnet | preflight | vault (`contracts/near`) | planned | registry entry (USDC `3e2210…b8af` checked with `ft_metadata` 2026-11-08); adapter in progress (ADR-0011) | N |
| NEAR | `near:mainnet` | NEAR | mainnet | preflight | vault | — | registry entry (USDC `172086…33a1` checked 2026-11-08); Intents quotes only for the hackathon | N/6 |
| GOAT testnet3 | `eip155:48816` | EVM | testnet | trace (batching off) | PaymentGuard | — | backlog | later |

Family docs: `docs/chains/evm.md`, `docs/chains/stellar.md`, `docs/chains/casper.md`, `docs/chains/near.md`. Later families (Solana from BLACKTHORN, Midnight) get a doc when an ADR adds them.
