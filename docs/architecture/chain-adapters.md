# Chain adapters

Status: **in progress** (interfaces built in `packages/core/src/adapters.ts`; no adapter implements them yet)
Last verified: 2026-11-07

How a chain family plugs into Baret, and the checklist for adding a chain or a family. Interfaces live in `packages/core/adapters`; implementations in `packages/chain-<family>`.

## 1. Two sides, two entry points

Each `packages/chain-<family>` exports:

| Entry | Used by | Responsibility |
|---|---|---|
| `@baret/chain-<family>/engine` | `packages/engine` (server) | Parse, pin, decode, simulate, effects, family detectors, health |
| `@baret/chain-<family>/wallet` | `wallet-core`, `agent-kit` (client) | Derive accounts, read balances, build common transactions, sign, send, sign x402 payments, provider shape for dApps |

They share only pure helpers (address normalisation, unit conversion). The wallet side must stay small enough for the extension bundle; it never imports simulation code.

## 2. Engine adapter interface (the code in `packages/core/src/adapters.ts` is the authority)

```ts
interface EngineAdapter<Req, Tx, Sim> {
  family: Family;                                   // "evm" | "stellar" | "casper"
  requestSchema: ZodType<Req>;                      // the family payload inside /v1/analyze
  normaliseAddress(addr: string): string;
  pin(chain: ChainConfig): Promise<StatePin>;
  decode(req: Req, chain: ChainConfig): Promise<Tx>;
  simulate(tx: Tx, pin: StatePin, chain: ChainConfig): Promise<Sim | NoSimulation>;
  effects(tx: Tx, sim: Sim | NoSimulation, chain: ChainConfig): Promise<Effects>;
  detectors: FamilyDetector<Tx, Sim>[];             // pure
  health(chain: ChainConfig): Promise<ChainHealth>; // rpc reachable, right chain, trace/simulation available
}
```

Family request payloads (inside `request`):

| Family | Payload |
|---|---|
| EVM | `{ kind: "transaction", tx: { from, to, value, data, gas?, … } }` · `{ kind: "raw", raw }` · `{ kind: "typed-data", typedData }` |
| Stellar | `{ kind: "xdr", transactionXdr }` · `{ kind: "auth-entry", entryXdr }` |
| Casper | `{ kind: "transaction", transactionJson }` (Transaction V1) · `{ kind: "deploy", deployJson }` (legacy) |

## 3. Wallet adapter interface (loose until T2.2 ports the first one)

```ts
interface WalletAdapter {
  family: Family;
  derivationPath(index: number): string;            // from one BIP-39 seed
  deriveAccount(seed: Uint8Array, index: number): { publicKey; address; caip10(chain) };
  balances(account, chain): Promise<BalanceRow[]>;
  build: { nativeTransfer; tokenTransfer; approve?; revoke? };
  toAnalyzeRequest(tx): FamilyPayload;              // what wallet-core sends to /v1/analyze
  sign(tx, key): Promise<Signed>;
  send(signed, chain): Promise<TxHash>;
  x402?: { signPayment(requirements, key): Promise<PaymentHeader> };
  provider: ProviderSpec;                           // what the extension injects for dApps of this family
}
```

## 4. Adding a chain to an existing family (configuration only)

1. Add `packages/chains/chains/<slug>.json`: CAIP-2 id, name, network (`mainnet`/`testnet`), native asset, explorer URL pattern, RPC env variable names, features (`trace`, `x402`, `vault`, `indexer`), canonical USDC.
2. Add `packages/chains/deployments/<caip2-slug>.json` once contracts are deployed.
3. Add the env variables to `apps/api/.env.example` and `docs/operations/environments.md`.
4. Add a row to `docs/chains/README.md` and a section in `docs/chains/<family>.md` (RPC providers, quirks, faucet).
5. Run the family's chain test suite against it (`pnpm --filter @baret/chain-<family> test:chain`) and record the result in the chain's doc.
6. Showcase: decide whether it gets scenarios (`docs/architecture/frontend.md`).

## 5. Adding a family

1. ADR: why this family, what it costs, which repo it comes from.
2. Create `packages/chain-<family>` with both entry points; implement every interface method or return an explicit "unsupported" capability. No stubs that pretend.
3. Map every family concept to `Effects`; list what does not map and the family detectors that cover it.
4. Register codes for new family detectors (`docs/architecture/engine.md` §4.2) and their words in `packages/content`.
5. Add the family section to `GuardPolicy` only if a family-only rule is needed; update templates.
6. Contracts for the spend limit (`contracts/<family>`), with a CI job.
7. Docs: `docs/chains/<family>.md`, support matrix, this file if the interfaces changed.
8. Tests: decode fixtures from real transactions (testnet and mainnet), simulation fixtures, effects snapshot tests, one end-to-end analyse per showcase scenario.

## 6. Capabilities

Not every chain supports everything. `GET /v1/chains` returns, per enabled chain:

```json
{ "chain": "eip155:10143", "family": "evm", "network": "testnet",
  "features": { "simulation": "trace", "x402": true, "spendLimit": "vault", "audit": true } }
```

`simulation` is `trace` (full call tree), `preflight` (Soroban-style), `speculative` (Casper, if confirmed) or `none` (decode-only; every verdict on that chain has `confidence: low`). Clients show the capability honestly; the web showcase hides scenarios a chain cannot demonstrate.
