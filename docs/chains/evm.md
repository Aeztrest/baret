# EVM family

Status: **planned** (source: `Baret-Metropolis`, the most mature Baret; `Baret-GOAT` for chain-configurable EVM lessons)
Last verified: 2026-11-07

Package: `packages/chain-evm` (viem). Chains: `docs/chains/README.md`.

## 1. Engine side

| Step | How | Legacy file |
|---|---|---|
| pin | `eth_blockNumber`; every read at that block | `apps/server/src/application/analyze.ts` |
| decode | call request or signed raw tx (sender recovered; chain id checked; legacy tx without chain id refused); EIP-712 typed data | `simulation/decode.ts`, `simulation/abi.ts` |
| simulate | `eth_call` + `eth_estimateGas` + `debug_traceCall` (`callTracer`, `withLog`) | `simulation/trace.ts`, `simulation/reverts.ts` |
| effects | approvals / transfers / ownership from trace logs; from calldata when no trace or revert; from the message for typed data; EIP-1967 implementation slot for delegatecall sources | `analysis/effects.ts`, `analysis/context.ts` |
| family detectors | approvals detail (Permit2, Seaport, NFT operator), evm-danger (delegatecall, selfdestruct, EIP-7702), call to address without code | `risk/detectors/*.ts` |

Rules carried over from Metropolis decisions: "unlimited" starts at the largest uint96 (D-049); a delegatecall from a standard EIP-1967 proxy to its implementation is not reported; an exchange with a listed contract is not a loss (D-021); an unread signed message is never Safe (D-043/44).

## 2. Per-chain notes

| Chain | Notes |
|---|---|
| Monad | 400 ms blocks; 30M gas limit per tx. Alchemy free tier has no `debug_traceCall` → separate trace RPC (`https://testnet-rpc.monad.xyz` on testnet). Contracts deployed on testnet by Metropolis (`Baret-Metropolis/docs/CONTRACTS.md`). |
| Arc | Circle's chain; USDC is the gas token (fees in USDC, affects loss and floor maths). Needs a trace-capable RPC provider (open task). Chain ids to confirm. |
| Base | Mature RPC market with trace support; canonical USDC. |
| GOAT | Lesson from Baret-GOAT: some RPCs reject `debug_traceCall` inside a JSON-RPC batch → batching must be configurable per chain (`features.rpcBatch`). |

Per-chain RPC variables: `docs/operations/environments.md`.

## 3. Wallet side

secp256k1 `m/44'/60'/0'/0/i`; EIP-1193 + EIP-6963 provider; viem for building, signing, sending; EIP-3009 for x402.

## 4. Contracts

`contracts/evm` — see `docs/architecture/contracts.md`.
