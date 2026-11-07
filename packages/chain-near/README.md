# @baret/chain-near

The NEAR family adapter (ADR-0011), engine side (`./engine`). Design: `docs/chains/near.md`.

- `request.ts`: the `/v1/analyze` payload — `{ kind: "transaction", tx: { signerId, receiverId, actions } }` or `{ kind: "borsh", base64 }` (signed or unsigned).
- `decode.ts`: borsh → the JSON form, with near-api-js 7 (the only package that may import it).
- `rpc.ts`: the preflight reads over JSON-RPC (`block`, `view_account`, `call_function`, `status`), all pinned to one final block; a failed read is 503, never a guess.
- `pipeline.ts`: effects (NEAR and NEP-141 movements, a Baret vault paying instead of the signer), detectors (access keys, DeleteAccount, DeployContract, Chain Signatures, unknown contracts, reported accounts), the vault's own checks predicted before signing (`vaultRefusal`, same order as `contracts/near/vault`), loss and floor rules, x402 payment checks.

No transaction simulation exists on NEAR: verdicts say `simulation: "preflight"` and `confidence: "medium"`. `apps/api` serves a NEAR chain when `CHAIN_NEAR_TESTNET_RPC_URL` / `CHAIN_NEAR_MAINNET_RPC_URL` is set.
