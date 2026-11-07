# @baret/chain-evm

The EVM chain family adapter (ADR-0003): everything Baret knows about EVM chains (Monad first, then Arc and Base) and nothing the other families need. The only package that may import `viem`.

| Entry | Used by | Status |
|---|---|---|
| `@baret/chain-evm/engine` | `packages/engine`, `apps/api` | **built**: the whole Metropolis analysis (below), `createEvmAdapter`, passes Metropolis parity (T1.5, T1.6) |
| `@baret/chain-evm/wallet` | `wallet-core`, `agent-kit` | not started (T2.2) |

## Engine side (ported from `Baret-Metropolis/apps/server/src`)

| Module | What it does | Legacy file |
|---|---|---|
| `engine/request.ts` | The EVM payload of `/v1/analyze`: `{ kind: "call" \| "raw" \| "typed-data", … }` | `@baret/guard` analyze.ts |
| `engine/rpc.ts` | `EvmRpc` interface + `ViemEvmRpc`: pinned-block reads, `eth_call`, `debug_traceCall` (separate trace node allowed), retries with backoff, chain-id check, optional JSON-RPC batching | `infra/rpc.ts` |
| `engine/simulation/decode.ts` | Call request or serialized tx → `NormalizedTx`; recovers the signer; refuses other-chain and chain-id-less (replayable) transactions; carries EIP-7702 delegations | `simulation/decode.ts` |
| `engine/simulation/trace.ts` | Flattens a `callTracer` tree: frames, logs of non-reverted frames, contract depth (delegatecalls add no level), read-only and forwarded frames | `simulation/trace.ts` |
| `engine/simulation/abi.ts` | Known calls/events, the uint96 "unlimited" threshold (Metropolis D-049), EIP-1967 / ZOS proxy slots | `simulation/abi.ts` |
| `engine/simulation/reverts.ts` | Names a revert from its error selector (vault errors, OpenZeppelin v5) | `simulation/reverts.ts` |
| `engine/analysis/effects.ts` | `EvmEffects` from a trace, from calldata, or from EIP-712 typed data (permits, Permit2, EIP-3009, Seaport orders, carried calls) | `analysis/effects.ts` |
| `engine/analysis/context.ts` | `EvmContext`: everything detectors read; `EvmNetwork` from the chain registry | `analysis/context.ts` |
| `engine/analysis/format.ts` | Token labels (native coin from the registry), `assetAddress()` CAIP-19 → address | `analysis/format.ts` |
| `engine/pipeline.ts`, `engine/adapter.ts` | The analysis (Metropolis `application/analyze.ts`) and the `EngineAdapter`; `MAX_TX_GAS` per chain | `application/analyze.ts` |
| `engine/sources/registry.ts` | Reads Baret's on-chain ReputationRegistry | `sources/registry.ts` |
| `engine/detectors/*` | All ten Metropolis detectors + the policy rules (loss, floors, x402 caps and merchants), emitting v2 codes and v2 rule paths | `risk/detectors/*`, `policy/evaluate.ts` (`policyFindings`) |

**Where the detectors live (D9).** They are ported here as they are, working on `EvmContext`, so Metropolis parity can be checked first. The universal ones move to `packages/engine` with the Stellar adapter (T3.7). Changes from Metropolis, all deliberate: v2 codes (`APPROVAL_*`, `AUTHORITY_CHANGE`, `REPUTATION_*`, `EXCESSIVE_FEE`); floors and x402 caps per CAIP-19 asset in base units; a payment asset with no cap entry has no caps; new `X402_NETWORK_MISMATCH`, `X402_SHAPE_INVALID` and `X402_AMOUNT_MISMATCH` (overpayment only); `core.maxFee` beside `evm.maxGas`.

Tests: `pnpm --filter @baret/chain-evm test` (42; the RPC tests run against a local fake node, no network).

Known follow-up: `reverts.ts` returns English sentences; they move to `@baret/content` keyed by error name when the content package is ported (T2.1).
