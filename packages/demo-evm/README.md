# @baret/demo-evm

The EVM side of the web app's demo sites (ADR-0010): the addresses they use, the honest and attack transaction of each site, the x402 payments of Scrybe and the agents playground, and the `POST /v1/analyze` bodies for them (`callRequest`, `paymentRequest`). Consumed as TypeScript source, never built or published.

- Addresses come from the chain registry: the `showcase` section of `packages/chains/deployments/monad-testnet.json`. Nothing here writes an address.
- The only package besides `packages/chain-evm` that may import viem (and wagmi, for the sites' wallet connection, when it lands with the demo kit).
- `src/scenarios.ts` holds every scenario with the decision and finding codes its site expects; `pnpm --filter @baret/demo-evm verify -- --api <url> --from <funded testnet wallet>` sends them to an API and exits 1 on any disagreement. 2026-11-08 against staging: 16 of 18 before `DemoUsdc` was listed (both NovaSwap scenarios showed an extra unknown-contract finding); re-run after this change is deployed.
- Ported from the Metropolis demo package, moved to the v2 request (CAIP-2 chain, `kind: "call" | "typed-data"`, CAIP-19 assets in x402 requirements and spend history). The Cleanverse builders stay behind until the compliance provider is ported (TASKS.md T1.7).

Docs: `docs/decisions/0010-demo-packages-per-family.md`, `docs/architecture/frontend.md`, `docs/architecture/contracts.md` §2.
