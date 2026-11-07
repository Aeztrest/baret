# contracts/evm

Baret's EVM contracts, ported from `Baret-Metropolis/contracts` (Foundry, solc 0.8.28, `prague`). Design and the deployment registry: `docs/architecture/contracts.md`.

| Contract | What it is |
|---|---|
| `src/PaymentGuard.sol` | One owner's vault for one token: per-merchant cap per payment, per hour and per day (rolling), pause, revoke, a payment reference. An agent key can only `pay()` within the caps. |
| `src/PaymentGuardFactory.sol` | Opens vaults for their owners and answers `isVault(address)`, which the API uses to treat a user's own vault as a known contract. |
| `src/ReputationRegistry.sol` | Flagged addresses with severity and reason code, written by one authorised writer; read by the API on every analysis. |

```bash
cd contracts/evm
git submodule update --init       # lib/forge-std (v1.17.0)
forge fmt --check && forge build --sizes && forge test
```

29 tests (fuzzing included) — CI: `.github/workflows/contracts-evm.yml`, on changes under `contracts/evm/` only.

**Same code as on Monad testnet.** The runtime size of the compiled `PaymentGuardFactory` (7,164 bytes) and `ReputationRegistry` (3,704 bytes) equals the size of the code at their Monad testnet addresses (`packages/chains/deployments/monad-testnet.json`), read with `eth_getCode` on 2026-11-07.

**Deploying** (`script/Deploy.s.sol`): the factory and the registry, on any chain; the key on the command line only; record the addresses in `packages/chains/deployments/` in the same PR. Deploying is an owner decision (CLAUDE.md) and mainnet needs an audit first.

Not ported (backlog): `ReputationOracleReceiver` (Chainlink CRE), `CompliantPaymentGuard` (Cleanverse), `SealedStore`; the showcase's demo contracts come with T2.4.
