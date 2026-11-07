# @baret/chains

The registry of chains Baret supports and of Baret's own contract deployments. Data, not code: one JSON file per chain in `chains/`, one per chain with contracts in `deployments/`. Every file is validated against `@baret/core` schemas when the module loads.

```ts
import { getChain, getDeployment, enabledChains, policyContext } from "@baret/chains";
import { createPolicy } from "@baret/core";

const monad = getChain("eip155:10143");                       // ChainConfig | null
getDeployment("eip155:10143", "PaymentGuardFactory")?.address;
enabledChains(process.env);                                   // chains whose CHAIN_<SLUG>_RPC_URL is set
createPolicy("balanced", policyContext(monad!));              // template filled for this chain
```

## Adding a chain

Follow `docs/architecture/chain-adapters.md` §4: add `chains/<slug>.json`, import it in `src/index.ts`, add its row to `docs/chains/README.md` (`docs:check` fails without it) and its variables to `docs/operations/environments.md`.

## Adding a deployment

Add the contract to `deployments/<slug>.json` in the same PR as the deploy, with the block, the transaction hash and the date its code was checked on chain. Never type an address into an app.

Tests: `pnpm --filter @baret/chains test`.
