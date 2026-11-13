# Engine: pipeline, effects, detectors, policy, verdict

Status: **in progress** — EVM done in code, not deployed: `packages/core` types, `packages/engine` (`createEngine`, `decide`) and the EVM adapter pass Metropolis's 87 end-to-end scenarios (parity). Stellar and Casper adapters not built.
Last verified: 2026-11-07

Owns: `packages/core` (the types) and `packages/engine` (the pipeline). The adapter side of each step is in `docs/architecture/chain-adapters.md`.

## 1. Pipeline

`engine.analyze(input) → Verdict`, where `input = { chain, request, policy, account?, payment? }`.

| Step | Who | What | Failure behaviour |
|---|---|---|---|
| 1. resolve | engine | `chains.get(chain)` → config + adapter; chain must be enabled | 400 `chain_unsupported` |
| 2. pin | adapter | Choose one state point (EVM block number, Stellar ledger, Casper block/state root); every read uses it | 503 `rpc_unavailable` |
| 3. decode | adapter | Family payload → decoded tx; checks chain id / network passphrase / chain name; recovers signer when signed | 400 `invalid_request` |
| 4. simulate | adapter | Run against pinned state | Degrades: no simulation → effects from decoding only, `confidence: low`, `LOW_CONFIDENCE_INCOMPLETE_DATA` |
| 5. effects | adapter | Simulation + decoding → normalised `Effects` | — |
| 6. lookup | engine + providers | Reputation and compliance for every counterparty; each source reports `ok`, `unavailable` or `skipped` | Missing data only fails rules that need it (`*_UNAVAILABLE`) |
| 7. detect | engine + adapter | Universal detectors over `Effects`; family detectors over the decoded tx and simulation | A detector that throws → `LOW_CONFIDENCE_INCOMPLETE_DATA`, never a silent pass |
| 8. evaluate | engine | Policy decides which findings block | — |
| 9. answer | engine | Build `Verdict`; validate against its schema before returning | 500 never leaks internals |

Detectors are **pure functions** of the context: no I/O inside a detector. All reads happen in steps 2–6.

## 2. Identifiers — built (`packages/core/src/ids.ts`)

- Chain: CAIP-2 — `eip155:10143` (Monad testnet), `eip155:143` (Monad), `stellar:testnet`, `stellar:pubnet`, `casper:casper-test`, `casper:casper`, `near:testnet`, `near:mainnet` (ADR-0011).
- Account: CAIP-10 — `eip155:143:0xabc…`, `stellar:pubnet:G…` / `C…`, `casper:casper:<account-hash or public key>`, `near:testnet:alice.testnet` (`_` written `%5F`).
- Asset: CAIP-19 — `eip155:143/erc20:0x…`, `eip155:143/slip44:…` (native), `stellar:pubnet/sep41:C…` / classic `stellar:pubnet/asset:USDC-G…`, `casper:casper/cep18:<package-hash>`, `near:testnet/nep141:<token-contract>`.
- Address comparison is family-aware (EVM checksum-insensitive; Stellar/Casper exact) and lives in the adapter (`adapter.normaliseAddress`).

**Asset namespaces (decided 2026-11-07, T1.11).** Native assets use `slip44:<coin type>` with the coin type of the family's derivation path: `slip44:60` on every EVM chain (as wallets derive EVM keys), `slip44:148` for XLM, `slip44:506` for CSPR, `slip44:397` for NEAR. Tokens: `erc20:<address>` / `erc721:<address>` (EVM), `sep41:<C… contract>` and `asset:<CODE>-<ISSUER>` for classic assets (Stellar), `cep18:<package hash>` (Casper). The Stellar and Casper forms are checked against the CAIP namespace registry when their adapters are ported (T3.1, T4.2).

## 3. Effects model — built (`packages/core/src/effects.ts`)

The contract between adapters and everything else. The code is the authority; the sketch below shows the idea:

```ts
type Effects = {
  chain: Caip2;
  actor: Caip10;                          // who signs / pays
  balanceChanges: BalanceChange[];        // { account, asset, decimals, symbol?, before?, after?, delta } base units as strings
  allowances: Allowance[];                // { owner, spender, asset, amount | "unlimited", scope: "token" | "all-tokens-of-collection" | "single-item", via: "transaction" | "signature", expiresAt? }
  authorityChanges: AuthorityChange[];    // { account, kind: "owner-transfer" | "signer-added" | "signer-removed" | "threshold-changed" | "master-key-removed" | "code-delegation" | "account-merge", details }
  counterparties: Counterparty[];         // { address, roles: ("target"|"spender"|"recipient"|"payee"|"signer")[], isContract: boolean | null, deployedAt? }
  calls: { depth: number; operationCount: number; reverted: boolean; revertReason?: string };
  fee: { asset; maxAmount; estimatedAmount? };
  message?: { kind: "typed-data" | "auth-entry" | "personal" | "unknown"; understood: boolean; summary };
  confidence: "high" | "medium" | "low";
  gaps: string[];                         // what could not be determined, for LOW_CONFIDENCE findings
};
```

Rule: if a family has a concept with no field here, it is added to the model (ADR) **only** if a universal detector or the policy needs it; otherwise it stays in the adapter and is handled by a family detector.

## 4. Detectors and finding codes

Ported codes are unified across families (ADR-0006). Each code has one entry in the registry (`packages/core/src/findings.ts`, built): kind (toggle / threshold / fail-closed / warning), the policy field that controls it, the families that can emit it, its value placeholders. Words for each code: `packages/content`.

### 4.1 Universal detectors (target: `packages/engine/detectors`, working on `Effects`)

**Today (D9):** every detector, universal or not, is ported into `packages/chain-evm/src/engine/detectors` working on the EVM context, and already emits the codes below. They move here with the Stellar adapter (T3.7).

| Detector | Codes | Legacy origin |
|---|---|---|
| simulation | `SIMULATION_FAILED`, `LOW_CONFIDENCE_INCOMPLETE_DATA` | all |
| allowances | `APPROVAL_GRANTED`, `APPROVAL_UNLIMITED`, `APPROVAL_TO_WALLET` | Metropolis `ERC20_APPROVAL_*`, Stellar `SOROBAN_ALLOWANCE_*`, Casper `CEP18_ALLOWANCE_*` |
| contracts | `RISKY_CONTRACT_INTERACTION`, `UNKNOWN_CONTRACT_EXPOSURE`, `VALUE_KEPT_BY_UNKNOWN_CONTRACT` | all |
| authority | `AUTHORITY_CHANGE` (`values.kind`) | Metropolis `OWNERSHIP_TRANSFER`, Stellar `SIGNER_CHANGE_DETECTED` / `THRESHOLD_CHANGE_DETECTED` |
| reputation | `KNOWN_MALICIOUS_ADDRESS`, `REPUTATION_TRUST_BELOW_MINIMUM`, `REPUTATION_FRESH_ACCOUNT`, `REPUTATION_WHALE_COUNTERPARTY`, `REPUTATION_DATA_UNAVAILABLE` | Metropolis `NANSEN_*` (provider-neutral names) |
| lookalike | `LOOKALIKE_ADDRESS` | Metropolis |
| complexity | `DEEP_CALL_NESTING`, `HIGH_OPERATION_COUNT`, `EXCESSIVE_FEE` | Metropolis `EXCESSIVE_GAS`, Stellar `EXCESSIVE_*_FEE` |
| compliance | `COMPLIANCE_NO_CREDENTIAL`, `COMPLIANCE_EXPIRED`, `COMPLIANCE_TIER_INSUFFICIENT`, `COMPLIANCE_COUNTRY_DISALLOWED`, `COMPLIANCE_DATA_UNAVAILABLE` | Metropolis (Cleanverse) |
| messages | `SIGNATURE_NOT_UNDERSTOOD`, `SIGNATURE_UNRECOGNISED` | Metropolis |
| x402 | `X402_DESTINATION_MISMATCH`, `X402_ASSET_MISMATCH`, `X402_AMOUNT_MISMATCH`, `X402_NETWORK_MISMATCH`, `X402_NON_CANONICAL_ASSET`, `X402_MEMO_MISSING`, `X402_SHAPE_INVALID`, `X402_FACILITATOR_MISMATCH` | all three |
| policy (in evaluate) | `ESTIMATED_LOSS_EXCEEDS_MAX`, `LOSS_PERCENT_UNAVAILABLE`, `POST_BALANCE_TOO_LOW`, `POST_BALANCE_UNAVAILABLE`, `X402_ASSET_NOT_ALLOWED`, `X402_MERCHANT_NOT_ALLOWED`, `X402_PER_TX_CAP_EXCEEDED`, `X402_HOURLY_CAP_EXCEEDED`, `X402_DAILY_CAP_EXCEEDED`, `X402_SPEND_HISTORY_UNAVAILABLE` | all |

### 4.2 Family detectors (in each adapter)

| Family | Codes |
|---|---|
| EVM | `NFT_OPERATOR_GRANTED`, `PERMIT_SIGNATURE_DETECTED`, `SIGNED_ORDER_DETECTED`, `ORDER_PAYS_NOTHING`, `DELEGATECALL_DETECTED`, `SELFDESTRUCT_CALL`, `ACCOUNT_CODE_DELEGATION` (EIP-7702), `CALL_TO_ADDRESS_WITHOUT_CODE` |
| Stellar | `ACCOUNT_MERGE_DETECTED`, `MASTER_KEY_REMOVED`, `TRUSTLINE_CHANGE_DETECTED`, `TRUSTLINE_REMOVED`, `UNLIMITED_TRUSTLINE`, `UNSIGNED_AUTH_ENTRY`; later `SEP10_*`, `SEP6_*` |
| Casper | `SESSION_CODE_EXECUTION` (arbitrary wasm runs with the account's authority — new), associated-key changes map to `AUTHORITY_CHANGE` |
| NEAR (ADR-0011) | `ACCOUNT_DELETE_DETECTED` (`near.blockDeleteAccount`), `CONTRACT_DEPLOY_DETECTED` (`near.blockContractDeploy`), `FUNCTION_CALL_KEY_ADDED` (warning), `CHAIN_SIGNATURE_REQUEST` (warning); NEAR Intents (a 1Click quote sent with the deposit, TN.8): `INTENTS_RECIPIENT_MISMATCH` and `INTENTS_DEPOSIT_MISMATCH` (`near.blockIntentsMismatch`), `INTENTS_QUOTE_INVALID` (fail-closed), `INTENTS_QUOTE_UNVERIFIED` (fail-closed: 1Click does not confirm the quote behind the deposit address), `INTENTS_APP_FEE` (warning); `NFT_TRANSFER_DETECTED` and `MULTI_TOKEN_TRANSFER_DETECTED` (warnings: a NEP-171 piece or NEP-245 tokens leave, unpriced); `STAKE_DETECTED` (warning: NEAR locked by a Stake action); a Baret vault's owner changes that widen what its agents may spend: `VAULT_RECEIVER_ADDED`, `VAULT_AGENT_ADDED`, `VAULT_LIMIT_RAISED`, `VAULT_UNPAUSED` (warnings); `nft_approve` maps to `APPROVAL_GRANTED` / `APPROVAL_TO_WALLET`, and the swap's loss from the quote's USD values under `core.maxLossPercent`; a full access key added or removed maps to `AUTHORITY_CHANGE`; counterparties (TN.14): `REPUTATION_FRESH_ACCOUNT` (universal), `COUNTERPARTY_FIRST_PAYMENT`, `CONTRACT_CODE_CHANGED_RECENTLY`, `COUNTERPARTY_HISTORY_UNAVAILABLE`, `COUNTERPARTY_REPORTED` (warnings; `docs/chains/near.md` §2a); the shared NEAR blocklist maps a flagged account to `KNOWN_MALICIOUS_ADDRESS` |

Adding a code: registry entry + content words + detector + test + this table, in one PR.

## 5. Policy (`GuardPolicy` v2) — built

Source of truth: `packages/core/src/policy.ts` (schema), `packages/core/src/policy-templates.ts` (templates), `packages/core/src/migrate.ts` (v1 → v2). This section only explains the design; read the code for the fields.

- **Shape.** `{ version: 2, core, evm, stellar, casper, near }`. `core` applies on every chain; each family section holds the rules only that family has. **All sections are always present**, so a policy is complete on any chain and needs no merging of defaults.
- **Assets are named, amounts are base units.** Floors (`core.minPostBalances`) and x402 caps (`core.x402.caps`) are per CAIP-19 asset, in base units. No rule assumes USDC or a native symbol.
- **Fees.** `core.maxFee` (native base units) works on every chain; `evm.maxGas` (gas units) is kept for EVM. Both feed `EXCESSIVE_FEE`.
- **Rule names.** Findings and fired rules name rules by dotted path (`core.x402.caps`, `evm.blockPermit`); the list is `POLICY_FIELDS`, kept equal to the schema by a test.
- **Templates.** `strict`, `balanced` (default), `permissive` are chain-free; `createPolicy(name, chain)` fills in the chain's payment assets, their x402 caps (template caps are in whole dollar units: strict 1/5/20, balanced 5/25/100, permissive 50/250/1000 per tx/hour/day) and the native floor (`policyFloors` in the chain's registry entry, because 0.1 MON is not 0.1 XLM). Casper's `blockSessionCode` is on only in Strict: payable calls on Casper run through session code.
- **Parity.** Each Metropolis v1 template, migrated, equals the v2 template of the same name in `core` and `evm` (test in `packages/core/src/core.test.ts`).
- **Migration.** `migratePolicyV1(v1, { chain, native, usdc })`. Stellar and Casper sections take Balanced defaults. Without the chain's USDC, v1 caps cannot be expressed and are dropped: payments are then refused, never loosened.
- **Scope:** a wallet keeps one policy per account per chain. The API never stores a policy.
- **Decision:** a finding blocks when its registry kind says so under the policy (toggle on, threshold broken, fail-closed data missing, or a warning with `core.allowWarnings: false`). Severity is display only; it never decides.

## 6. Verdict — built

Source of truth: `verdictSchema` in `packages/core/src/analyze.ts` (with the `/v1/analyze` request envelope). The schema itself enforces the decision rule: `safe` exactly when there are no findings, `blocked` exactly when at least one finding blocks, otherwise `caution`. `meta.simulation` says how the chain was read (`trace`, `preflight`, `speculative`, `none`). `expiresAt` is Unix seconds; signers refuse an expired verdict. Planned, not built: `attestation` (a signed verdict an agent can show; the Stellar legacy repo had one).

## 7. Not built yet

Universal detectors in the engine (they are in the EVM adapter, D9 → T3.7); Stellar and Casper adapters; signed attestations. Port order: `docs/migration/porting-plan.md`.

## 8. What runs today (Phase 1)

`createEngine({ adapters, chains, verdictTtlSeconds })` → `engine.analyze(body)`: validates the request (`analyzeRequestSchema`) → resolves the enabled chain and its family adapter → validates the family payload → fills the policy from the template and `policyContext(chain)` → `adapter.analyze()` (the EVM adapter runs Metropolis's whole pipeline: pin, decode, simulate, effects, reads, sources, detectors, policy rules) → `decide()` → suggestions, confidence → `verdictSchema.parse()`. Errors: `InvalidRequestError`, `ChainUnsupportedError`, `ChainUnavailableError` (`packages/core/src/errors.ts`).
