# NEAR family

Status: **in progress** (ADR-0011, 2026-11-08; built for NEAR HACKATHON 2026, deadline 2026-11-14)
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
| decode | A transaction as JSON (`signerId`, `receiverId`, `actions`) or base64 borsh. Actions: Transfer, FunctionCall (method, args, deposit, gas), AddKey (full access or function call key with receiver, methods, allowance), DeleteKey, DeleteAccount (beneficiary), DeployContract, CreateAccount, Stake. Known methods are decoded from their JSON args: NEP-141 `ft_transfer`, `ft_transfer_call`, `storage_deposit`; the vault's `execute_transfer`; Chain Signatures `sign`. |
| simulate | **Preflight only**: NEAR has no public transaction simulation. RPC reads: signer and receiver accounts (exist, balance, code hash), the signer's access keys, NEP-141 `ft_balance_of`. The verdict says `simulation: "preflight"`. |
| effects | Native and NEP-141 balance changes the actions state; deposits attached to calls; access key changes as authority changes; account deletion; contract deployment. |
| family detectors | full access key added (AUTHORITY_CHANGE), function call key added (FUNCTION_CALL_KEY_ADDED), DeleteAccount (ACCOUNT_DELETE_DETECTED), DeployContract (CONTRACT_DEPLOY_DETECTED), a Chain Signatures request (CHAIN_SIGNATURE_REQUEST, with the derivation path and target chain when readable), deposit to an account with no contract or an unknown one (universal codes). |

## 3. Spend limit: the vault (`contracts/near`)

Rust, near-sdk. The owner deposits NEAR and NEP-141 tokens and sets the policy: per-transfer limit and rolling 24-hour limit per asset, receiver allowlist, token allowlist, pause. One or more agents are registered; an agent's function call key reaches only `execute_transfer` on the vault, so a leaked agent key cannot touch the owner's account. Every refusal is a panic with a stable error code (rule 4 in CLAUDE.md: codes, not sentences). The vault can forward an approved request to the Chain Signatures MPC contract (`v1.signer-prod.testnet` / `v1.signer`, to verify) so the same limits apply to an agent's payment on an EVM chain.

## 4. Wallet side

Not in the hackathon scope. Derivation for the multichain wallet: ed25519, `m/44'/397'/0'` (to verify against NEAR wallets), with the extension (T2.3).

## 5. Hackathon scope (NEAR HACKATHON 2026)

Tracks: AI Security & Defense, Agent Economy. In scope (owner, 2026-11-08): the vault, the function call key flow, the adapter and `/v1/analyze` for NEAR, an agent demo, Chain Signatures, a NEAR Intents quote check, a web panel, an Agent Market listing. Task list: `TASKS.md` → "NEAR HACKATHON".
