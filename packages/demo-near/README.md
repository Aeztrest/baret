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
pnpm deploy -- ./baret_near_vault.wasm
pnpm setup                         # NEAR: 1 per transfer, 3 per day; the shop is the only receiver; 2 NEAR in
pnpm agent-key                     # the agent's key: execute_transfer on the vault only, 0.25 NEAR of fees
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
