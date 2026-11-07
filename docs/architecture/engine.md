# Engine: pipeline, effects, detectors, policy, verdict

Status: **planned** (ported from `Baret-Metropolis/apps/server/src` and generalised; see `docs/migration/porting-plan.md`)
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

## 2. Identifiers (`packages/core/ids`)

- Chain: CAIP-2 — `eip155:10143` (Monad testnet), `eip155:143` (Monad), `stellar:testnet`, `stellar:pubnet`, `casper:casper-test`, `casper:casper`.
- Account: CAIP-10 — `eip155:143:0xabc…`, `stellar:pubnet:G…` / `C…`, `casper:casper:<account-hash or public key>`.
- Asset: CAIP-19 — `eip155:143/erc20:0x…`, `eip155:143/slip44:…` (native), `stellar:pubnet/sep41:C…` / classic `stellar:pubnet/asset:USDC-G…`, `casper:casper/cep18:<package-hash>`.
- Address comparison is family-aware (EVM checksum-insensitive; Stellar/Casper exact) and lives in the adapter (`adapter.normaliseAddress`).

Exact asset namespaces for Stellar and Casper are confirmed in Phase 1 (`TASKS.md`), following the CAIP namespace registry where one exists.

## 3. Effects model (`packages/core/effects`)

The contract between adapters and everything else. Draft shape:

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

Ported codes are unified across families (proposed in ADR-0006). Each code has one entry in the registry (`packages/core/findings`): kind (toggle / threshold / fail-closed / warning), the policy field that controls it, the families that can emit it, its value placeholders. Words for each code: `packages/content`.

### 4.1 Universal detectors (`packages/engine/detectors`, work on `Effects`)

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

Adding a code: registry entry + content words + detector + test + this table, in one PR.

## 5. Policy (`GuardPolicy` v2, `packages/core/policy`)

The v1 policy (Metropolis) is flat and EVM-shaped (`minPostUsdcBalance`, `maxGas`, `minNansenTrustLevel`). v2 separates what applies everywhere from what is family-specific, and names assets instead of assuming USDC:

```ts
type GuardPolicy = {
  version: 2;
  core: {
    requireSuccessfulSimulation: boolean;
    allowWarnings: boolean;
    blockKnownMalicious: boolean;
    blockRiskyContracts: boolean;
    blockUnknownContractExposure: boolean;
    blockUnlimitedApprovals: boolean;
    blockAuthorityChanges: boolean;
    maxLossPercent: number | null;
    minPostBalances: { asset: Caip19; min: string }[];   // base units
    minReputationTrust: "new" | "known" | "trusted";
    compliance: { required: boolean; allowedCountries: string[]; minTier: number | null };
    x402: { requireMemo: boolean; allowedAssets: Caip19[]; allowedMerchantOrigins: string[];
            caps: { asset: Caip19; perTx: string | null; perHour: string | null; perDay: string | null }[] };
  };
  evm?:     { blockSetApprovalForAll: boolean; blockPermit: boolean; blockSelfdestruct: boolean;
              blockDelegatecall: boolean; blockCodeDelegation: boolean; maxGas: number | null };
  stellar?: { blockTrustlineRemoval: boolean; blockAccountMerge: boolean; maxFeeStroops: string | null };
  casper?:  { blockSessionCode: boolean; maxPaymentMotes: string | null };
};
```

- **Templates** `strict`, `balanced` (default), `permissive` are defined once and filled per chain (the chain's canonical USDC, native asset) by `policyTemplate(name, chain)`.
- **Scope:** a wallet keeps one policy per account per chain, created from the account's default template. The API never stores a policy.
- **Decision:** a finding blocks when its registry kind says so under this policy (toggle on, threshold broken, fail-closed data missing, or a warning with `allowWarnings: false`). Severity is display only; it never decides.
- **Migration:** `migratePolicyV1(v1, chain)` converts Metropolis policies (used by `@baret/guard` 0.1.x users and saved wallet rules).

## 6. Verdict (`packages/core/verdict`)

```ts
type Verdict = {
  decision: "safe" | "caution" | "blocked";
  findings: { code; severity: "low"|"medium"|"high"|"critical"; values; blocking: boolean; details? }[];
  firedRules: { rule; code; limit; actual }[];
  suggestions: { code; values }[];
  confidence: "high" | "medium" | "low";
  estimatedChanges: BalanceChange[];
  allowances: Allowance[];
  sources: { name; status: "ok" | "unavailable" | "skipped" }[];
  chain: Caip2;
  pinnedAt: { kind: "block" | "ledger" | "state-root"; value: string };
  expiresAt: number;               // signers refuse an expired verdict
  meta: { requestId; engineVersion; adapterVersion };
  attestation?: { alg: "ed25519"; keyId; signature };   // planned: lets an agent prove a check ran (Stellar legacy had this)
};
```

`safe` = no findings; `caution` = findings, none blocking; `blocked` = at least one blocking finding.

## 7. Not built yet

Everything in this file. Port order: `docs/migration/porting-plan.md`.
