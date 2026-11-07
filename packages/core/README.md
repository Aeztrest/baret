# @baret/core

The shared contract of Baret: every type that crosses a package or network boundary. No chain library inside (zod only), so a dApp, a wallet, an agent or the server can all depend on it. Published to npm (MIT) as a dependency of `@baret/guard`.

| Module | What it holds |
|---|---|
| `ids` | CAIP-2 / CAIP-10 / CAIP-19 schemas and helpers, `Family`, `familyOf()` |
| `units` | Base-unit amounts; `toBaseUnits()` / `fromBaseUnits()` |
| `policy` | `GuardPolicy` v2 schema (`core` + `evm` + `stellar` + `casper`), `POLICY_FIELDS` |
| `policy-templates` | `strict` / `balanced` / `permissive`; `createPolicy(name, chain)` fills a chain's payment assets, x402 caps and native floor |
| `migrate` | `migratePolicyV1()` — Metropolis (`@baret/guard` 0.1.x) policies to v2 |
| `findings` | Every finding code, how the policy decides it (`FINDING_SPECS`), which families emit it, the v1 → v2 code map |
| `effects` | `Effects`: what a transaction would do, chain-agnostic |
| `analyze` | `/v1/analyze` request envelope and the `Verdict` |
| `chain-config` | Schema of a chain registry entry (data lives in `@baret/chains`) |
| `adapters` | `EngineAdapter` and `WalletAdapter` interfaces every chain family implements |

Design and rationale: `docs/architecture/engine.md` (repository root) and ADRs 0002, 0003, 0006.

```ts
import { createPolicy, analyzeRequestSchema } from "@baret/core";

const policy = createPolicy("balanced", {
  paymentAssets: [{ id: "eip155:10143/erc20:0x534b…43A3", decimals: 6 }],
});
analyzeRequestSchema.parse({ chain: "eip155:10143", request: { kind: "raw", raw: "0x…" }, policy });
```

Tests: `pnpm --filter @baret/core test`. They include a parity test: each Metropolis v1 template, migrated, equals the v2 template of the same name.
