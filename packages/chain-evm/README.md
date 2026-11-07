# @baret/chain-evm

The EVM chain family adapter (ADR-0003): everything Baret knows about EVM chains (Monad first, then Arc and Base) and nothing the other families need. The only package that may import `viem`.

| Entry | Used by | Status |
|---|---|---|
| `@baret/chain-evm/engine` | `packages/engine` (server) | **in progress**: simulation layer ported (below); effects, EVM detectors and the `EngineAdapter` object are next (TASKS.md T1.5) |
| `@baret/chain-evm/wallet` | `wallet-core`, `agent-kit` | not started (T2.2) |

## Engine side, ported so far (from `Baret-Metropolis/apps/server/src`)

| Module | What it does | Legacy file |
|---|---|---|
| `engine/request.ts` | The EVM payload of `/v1/analyze`: `{ kind: "call" \| "raw" \| "typed-data", … }` | `@baret/guard` analyze.ts |
| `engine/rpc.ts` | `EvmRpc` interface + `ViemEvmRpc`: pinned-block reads, `eth_call`, `debug_traceCall` (separate trace node allowed), retries with backoff, chain-id check, optional JSON-RPC batching | `infra/rpc.ts` |
| `engine/simulation/decode.ts` | Call request or serialized tx → `NormalizedTx`; recovers the signer; refuses other-chain and chain-id-less (replayable) transactions; carries EIP-7702 delegations | `simulation/decode.ts` |
| `engine/simulation/trace.ts` | Flattens a `callTracer` tree: frames, logs of non-reverted frames, contract depth (delegatecalls add no level), read-only and forwarded frames | `simulation/trace.ts` |
| `engine/simulation/abi.ts` | Known calls/events, the uint96 "unlimited" threshold (Metropolis D-049), EIP-1967 / ZOS proxy slots | `simulation/abi.ts` |
| `engine/simulation/reverts.ts` | Names a revert from its error selector (vault errors, OpenZeppelin v5) | `simulation/reverts.ts` |

Tests: `pnpm --filter @baret/chain-evm test` (18; the RPC tests run against a local fake node, no network).

Known follow-up: `reverts.ts` returns English sentences; they move to `@baret/content` keyed by error name when the content package is ported (T2.1).
