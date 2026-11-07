# @baret/engine

Baret's analysis entry point: one call from an `/v1/analyze` body to a schema-checked `Verdict`, for any chain this deployment serves.

```ts
import { createEngine } from "@baret/engine";
import { createEvmAdapter } from "@baret/chain-evm/engine";
import { enabledChains } from "@baret/chains";

const engine = createEngine({
  adapters: { evm: createEvmAdapter((chain) => evmDepsFor(chain)) },
  chains: enabledChains(process.env),
  verdictTtlSeconds: 30,
});
const verdict = await engine.analyze(body); // throws InvalidRequestError / ChainUnsupportedError / ChainUnavailableError
```

| Module | What it does |
|---|---|
| `engine.ts` | Validates the request, resolves the chain and its family adapter, fills the policy (template + `policyContext(chain)`), runs the adapter, decides, adds suggestions and confidence, validates the verdict |
| `decide.ts` | The policy decision (Metropolis D-014): toggle / threshold / failClosed / warning. Fixed while porting: a fail-closed finding with no rule (`SIGNATURE_NOT_UNDERSTOOD`, `X402_SHAPE_INVALID`) blocks under every policy, with `rule: null` |

Today the detectors live in the family adapters (D9); they move here with the second family (TASKS.md T3.7).

## Metropolis parity (`test/parity/`)

Baret-Metropolis's end-to-end analysis tests, run against this engine and the EVM adapter through a v1 ↔ v2 translation layer (`metropolis-v1.ts`). Metropolis's own assertions; every change is marked `PARITY:` in the test file:

- the `/v1/explain` test is skipped until that route is ported (T2.7);
- `userWallet` is `account` in v2, and the gas-limit error names the chain from the registry.

87 scenarios pass, and the suite still checks that every v1 finding code is produced by at least one scenario. The layer documents every name translated (codes, rule paths, source names, trust levels).

Tests: `pnpm --filter @baret/engine test`.
