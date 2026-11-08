# @baret/demo-near

The NEAR demo for NEAR HACKATHON 2026 (ADR-0011; a demo package per ADR-0010, so it may use near-api-js). An AI agent gets money without getting the keys: the owner funds a Baret vault, the agent holds only a function call key that reaches the vault's `execute_transfer`, and the agent asks Baret before every payment.

## Run it on testnet

You need a funded NEAR testnet account (the owner) and its full access key.

```bash
cd packages/demo-near
cp .env.example .env.near          # fill NEAR_OWNER_ID and NEAR_OWNER_KEY (never commit .env.near)
pnpm keys                          # key pairs for the vault, the agent, the shop, the agent's function call key
pnpm accounts                      # the owner creates them as sub-accounts and funds them
# download baret_near_vault.wasm from the "Contracts (NEAR)" CI run (artifact baret-near-vault-wasm)
pnpm deploy-vault -- ./baret_near_vault.wasm
pnpm setup-vault                   # NEAR: 1 per transfer, 3 per day; the shop is the only receiver; 2 NEAR in
pnpm agent-key                     # the agent's key: execute_transfer and request_evm_signature on the vault only, 1 NEAR of fees
```

## The four scenarios

```bash
pnpm agent -- pay                  # Baret: Safe → the vault pays the shop (explorer link)
pnpm agent -- over-limit           # Baret predicts the vault's E_PER_TRANSFER_LIMIT → not signed
pnpm agent -- wrong-receiver       # a prompt names another account → Baret predicts E_RECEIVER_NOT_ALLOWED
pnpm agent -- add-key              # a prompt asks for a full access key → AUTHORITY_CHANGE, Blocked
pnpm agent -- wrong-receiver --force   # sent anyway: the vault refuses it on chain
pnpm agent -- add-key --force          # sent anyway: the function call key cannot add keys
```

The API is staging by default (`BARET_API_URL`); it must serve `near:testnet` (`CHAIN_NEAR_TESTNET_RPC_URL` set on the API).

## Chain Signatures: pay on Monad testnet under the same policy

The vault also signs EVM payments through NEAR's MPC network, from an address derived from its own account (path `eip155`). The agent sends the transfer's fields; the vault builds the EIP-1559 transaction itself and signs only what its policy allows, counting value plus the worst-case fee.

```bash
pnpm evm-setup                     # MON on eip155:10143: 0.05 per transfer, 0.1 per day; the shop's EVM address; prints the vault's EVM address
# fund that address with testnet MON (https://faucet.monad.xyz)
pnpm agent -- evm-pay              # Baret checks the NEAR call and the Monad transfer → the vault signs → sent on Monad
pnpm agent -- evm-wrong-receiver   # an address on Baret's reported list → Blocked on both chains, not signed
pnpm agent -- evm-wrong-receiver --force   # sent anyway: the vault refuses E_RECEIVER_NOT_ALLOWED
```

A vault deployed before Chain Signatures is upgraded in place, keeping its state: `pnpm upgrade-vault -- ./baret_near_vault.wasm`, then `pnpm evm-setup` and `pnpm agent-key`.
