# NEAR family

Status: **live (testnet)** — core family, registry, vault contract and the engine adapter built 2026-11-08; the demo vault is deployed on NEAR testnet (`baret-vault.aeztrest-baret.testnet`, `packages/chains/deployments/near-testnet.json`), staging serves `near:testnet`, and the web panel `/near` reads it live. Not on mainnet, not audited (ADR-0011; NEAR HACKATHON 2026, deadline 2026-11-14)
Last verified: 2026-11-08

Package: `packages/chain-near`. Contract: `contracts/near`. Chains: `near:testnet`, `near:mainnet`.

## 1. Identifiers

| What | Form | Example |
|---|---|---|
| chain | `near:<network>` | `near:testnet` |
| account | `near:<network>:<account-id>`, `_` written `%5F` | `near:testnet:baret-vault.testnet` |
| native asset | `near:<network>/slip44:397` | 1 NEAR = 10^24 yoctoNEAR |
| fungible token | `near:<network>/nep141:<token-contract>` | `near:testnet/nep141:usdc.fakes.testnet` |

## 2. Engine side

| Step | How |
|---|---|
| decode | A transaction as JSON (`signerId`, `receiverId`, `actions`) or base64 borsh. Actions: Transfer, FunctionCall (method, args, deposit, gas), AddKey (full access or function call key with receiver, methods, allowance), DeleteKey, DeleteAccount (beneficiary), DeployContract, CreateAccount, Stake. Known methods are decoded from their JSON args: NEP-141 `ft_transfer`, `ft_transfer_call`, `storage_deposit`; the vault's `execute_transfer` and `request_evm_signature`; Chain Signatures `sign`. |
| simulate | **Preflight only**: NEAR has no public transaction simulation. RPC reads pinned to one final block: signer and receiver accounts (exist, balance, code), NEP-141 `ft_balance_of`, and for a call to a Baret vault its `get_policy` and `get_remaining`, from which the vault's own refusal (`E_…`) is predicted before signing (`SIMULATION_FAILED` with `details.reason`). The verdict says `simulation: "preflight"`, `confidence: "medium"`. |
| effects | Native and NEP-141 balance changes the actions state; deposits attached to calls; access key changes as authority changes; account deletion; contract deployment. |
| family detectors | full access key added (AUTHORITY_CHANGE), function call key added (FUNCTION_CALL_KEY_ADDED), DeleteAccount (ACCOUNT_DELETE_DETECTED), DeployContract (CONTRACT_DEPLOY_DETECTED), a Chain Signatures request (CHAIN_SIGNATURE_REQUEST, with the derivation path and target chain when readable), deposit to an account with no contract or an unknown one (universal codes). |

## 2b. NEAR Intents (TN.8)

An agent swapping through NEAR Intents gets a 1Click quote (`POST /v0/quote`, mainnet) and signs a deposit to the quote's deposit address. The request to `/v1/analyze` may carry that quote as `request.intents` (the 1Click answer as it came). Baret then checks what the transaction cannot show: the quote's `recipient` and `refundTo` must be the signer (`INTENTS_RECIPIENT_MISMATCH`), the transaction must send exactly the quote's `amountIn` of its origin token to its `depositAddress` (`INTENTS_DEPOSIT_MISMATCH`; both toggled by `near.blockIntentsMismatch`, on in every template), a dry, expired or address-less quote fails closed (`INTENTS_QUOTE_INVALID`), and an app fee is shown (`INTENTS_APP_FEE`; a quote asked for without an API key carries one, 20 bps on 2026-11-09). The deposit counts as an exchange, not a loss: the loss rule reads the quote's `amountInUsd` / `amountOutUsd` instead (no prices: `LOSS_PERCENT_UNAVAILABLE`). The quote's signature is not verified: 1Click publishes no key for it. Cross-chain recipients (a swap paying the agent on another chain) need an allowlist and are not handled yet. Demo: `pnpm intents-check` (`packages/demo-near`), which asks for a real quote and signs nothing. The registry gains `wrappedNative` (wNEAR) so its contract counts as known.

## 3. Spend limit: the vault (`contracts/near`)

Rust, near-sdk. The owner deposits NEAR and NEP-141 tokens and sets the policy: per-transfer limit and rolling 24-hour limit per asset, receiver allowlist, token allowlist, pause. One or more agents are registered; an agent's function call key reaches only `execute_transfer` on the vault, so a leaked agent key cannot touch the owner's account. Every refusal is a panic with a stable error code (rule 4 in CLAUDE.md: codes, not sentences). **Chain Signatures (TN.7).** `request_evm_signature(tx)` lets an agent pay on an EVM chain from an address the vault controls through NEAR's MPC network (`v1.signer-prod.testnet` on testnet, `v1.signer` on mainnet; the vault picks one from its own account id, so the state layout did not change). The agent sends the fields of an EIP-1559 native transfer, never a hash: the vault checks them against the same policy (asset = the chain's CAIP-2 id such as `eip155:10143`; receiver = a lowercase 0x address on the receiver list), counts **value + gas limit x max fee** against the limits (a high fee cannot drain the address around the policy), builds the transaction itself (`vault/src/evm.rs`, no calldata, no access list), and asks the MPC contract to sign its keccak256 with path `eip155` and `payload_v2` / `domain_id: 0` (checked against `v1.signer-prod.testnet` 3.18.0 on 2026-11-09). The callback returns the signature (`big_r`, `s`, `recovery_id`) or, when the MPC network fails, gives the spend back to the window. `get_evm_payload(tx)` is the view that says what would be signed (hash, asset, receiver, worst-case cost).

Baret's preflight reads `get_evm_payload` and the policy and predicts the vault's refusal the same way as for `execute_transfer` (E_ codes; `E_BAD_EVM_TX` for a malformed transfer or a vault without the method). It raises no `CHAIN_SIGNATURE_REQUEST` for this call: the vault bounds the signature, and the EVM transfer is checked on its own chain by a second `/v1/analyze`. A direct `sign` call on the MPC contract keeps the finding.

## 3b. Demo (`packages/demo-near`)

Testnet scripts set up the owner's vault, the shop and the agent, and give the agent a function call key that reaches only `execute_transfer` (TN.4). The agent CLI runs four scenarios: a normal payment (Safe, paid), over the per-transfer limit and a prompt-injected receiver (Baret predicts the vault's refusal; not signed), and a prompt-injected full access key (`AUTHORITY_CHANGE`, Blocked). `--force` shows the second line of defence: the vault, or NEAR's key permissions, refuse on chain. Two Chain Signatures scenarios (`evm-pay`, `evm-wrong-receiver`) ask Baret twice, about the NEAR call and about the EVM transfer on `eip155:10143` from the vault's derived address; on two Safe verdicts the agent calls the vault, assembles the MPC signature into the raw transaction (`src/evm.ts`, tested against viem's serialisation) and sends it to Monad testnet. `upgrade-vault` replaces the code and keeps the state, `evm-setup` sets the MON limits (0.05 per transfer, 0.1 per day) and the EVM receiver, and `agent-key` replaces the agent key with one that reaches both vault methods.

## 4. Wallet side

Not in the hackathon scope. Derivation for the multichain wallet: ed25519, `m/44'/397'/0'` (to verify against NEAR wallets), with the extension (T2.3).

## 5. Hackathon scope (NEAR HACKATHON 2026)

Tracks: AI Security & Defense, Agent Economy. In scope (owner, 2026-11-08): the vault, the function call key flow, the adapter and `/v1/analyze` for NEAR, an agent demo, Chain Signatures, a NEAR Intents quote check, a web panel, an Agent Market listing. Task list: `TASKS.md` → "NEAR HACKATHON".
