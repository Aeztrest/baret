import type { Family } from "./ids.js";
import type { PolicyField } from "./policy.js";

/**
 * Every finding code the engine can emit (ADR-0006). Universal concepts have one code
 * on every chain; concepts only one family has keep a family code. The words for each
 * code live in @baret/content. Tables: docs/architecture/engine.md §4.
 */
export const FINDING_CODES = [
  // simulation and data
  "SIMULATION_FAILED",
  "LOW_CONFIDENCE_INCOMPLETE_DATA",
  // allowances
  "APPROVAL_GRANTED",
  "APPROVAL_UNLIMITED",
  "APPROVAL_TO_WALLET",
  // contracts
  "RISKY_CONTRACT_INTERACTION",
  "UNKNOWN_CONTRACT_EXPOSURE",
  "VALUE_KEPT_BY_UNKNOWN_CONTRACT",
  // authority
  "AUTHORITY_CHANGE",
  // reputation
  "KNOWN_MALICIOUS_ADDRESS",
  "REPUTATION_TRUST_BELOW_MINIMUM",
  "REPUTATION_FRESH_ACCOUNT",
  "REPUTATION_WHALE_COUNTERPARTY",
  "REPUTATION_DATA_UNAVAILABLE",
  "LOOKALIKE_ADDRESS",
  // complexity
  "DEEP_CALL_NESTING",
  "HIGH_OPERATION_COUNT",
  "EXCESSIVE_FEE",
  // compliance
  "COMPLIANCE_NO_CREDENTIAL",
  "COMPLIANCE_EXPIRED",
  "COMPLIANCE_TIER_INSUFFICIENT",
  "COMPLIANCE_COUNTRY_DISALLOWED",
  "COMPLIANCE_DATA_UNAVAILABLE",
  // signed messages
  "SIGNATURE_NOT_UNDERSTOOD",
  "SIGNATURE_UNRECOGNISED",
  // x402 shape
  "X402_DESTINATION_MISMATCH",
  "X402_ASSET_MISMATCH",
  "X402_AMOUNT_MISMATCH",
  "X402_NETWORK_MISMATCH",
  "X402_NON_CANONICAL_ASSET",
  "X402_MEMO_MISSING",
  "X402_SHAPE_INVALID",
  "X402_FACILITATOR_MISMATCH",
  // policy thresholds
  "ESTIMATED_LOSS_EXCEEDS_MAX",
  "LOSS_PERCENT_UNAVAILABLE",
  "POST_BALANCE_TOO_LOW",
  "POST_BALANCE_UNAVAILABLE",
  "X402_ASSET_NOT_ALLOWED",
  "X402_MERCHANT_NOT_ALLOWED",
  "X402_PER_TX_CAP_EXCEEDED",
  "X402_HOURLY_CAP_EXCEEDED",
  "X402_DAILY_CAP_EXCEEDED",
  "X402_SPEND_HISTORY_UNAVAILABLE",
  // EVM only
  "NFT_OPERATOR_GRANTED",
  "PERMIT_SIGNATURE_DETECTED",
  "SIGNED_ORDER_DETECTED",
  "ORDER_PAYS_NOTHING",
  "DELEGATECALL_DETECTED",
  "SELFDESTRUCT_CALL",
  "ACCOUNT_CODE_DELEGATION",
  "CALL_TO_ADDRESS_WITHOUT_CODE",
  // Stellar only
  "ACCOUNT_MERGE_DETECTED",
  "MASTER_KEY_REMOVED",
  "TRUSTLINE_CHANGE_DETECTED",
  "TRUSTLINE_REMOVED",
  "UNLIMITED_TRUSTLINE",
  "UNSIGNED_AUTH_ENTRY",
  // Casper only
  "SESSION_CODE_EXECUTION",
  // NEAR (ADR-0011)
  "ACCOUNT_DELETE_DETECTED",
  "CONTRACT_DEPLOY_DETECTED",
  "FUNCTION_CALL_KEY_ADDED",
  "CHAIN_SIGNATURE_REQUEST",
  "INTENTS_RECIPIENT_MISMATCH",
  "INTENTS_DEPOSIT_MISMATCH",
  "INTENTS_QUOTE_INVALID",
  "INTENTS_APP_FEE",
  "INTENTS_QUOTE_UNVERIFIED",
  "NFT_TRANSFER_DETECTED",
  "MULTI_TOKEN_TRANSFER_DETECTED",
] as const;

export type FindingCode = (typeof FINDING_CODES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * How the policy decides a code (carried over from Metropolis D-014):
 *
 *   toggle      one boolean field decides. On: blocks. Off: shown, and falls to allowWarnings.
 *   threshold   emitted only when the owner's rule is set and broken, so it always blocks.
 *   failClosed  data a rule needed is missing, or the request cannot be read. Always blocks;
 *               `fields` lists the rules that needed it (empty: no rule can turn it off).
 *   warning     no rule of its own. Blocks only when core.allowWarnings is off.
 *
 * Severity is for display only; it never decides.
 */
export type FindingRule =
  | { kind: "toggle"; fields: readonly [PolicyField] }
  | { kind: "threshold"; fields: readonly PolicyField[] }
  | { kind: "failClosed"; fields: readonly PolicyField[] }
  | { kind: "warning"; fields: readonly ["core.allowWarnings"] };

export interface FindingSpec {
  severity: Severity;
  rule: FindingRule;
  /** Which families can emit it. */
  families: "all" | readonly Family[];
}

const warning = { kind: "warning", fields: ["core.allowWarnings"] } as const;
const toggle = (field: PolicyField) => ({ kind: "toggle", fields: [field] }) as const;
const threshold = (...fields: PolicyField[]) => ({ kind: "threshold", fields }) as const;
const failClosed = (...fields: PolicyField[]) => ({ kind: "failClosed", fields }) as const;
const all = "all" as const;
const COMPLIANCE_FIELDS: PolicyField[] = [
  "core.compliance.required",
  "core.compliance.allowedCountries",
  "core.compliance.minTier",
];
const CAPS: PolicyField = "core.x402.caps";

export const FINDING_SPECS = {
  SIMULATION_FAILED: {
    severity: "high",
    rule: toggle("core.requireSuccessfulSimulation"),
    families: all,
  },
  LOW_CONFIDENCE_INCOMPLETE_DATA: { severity: "low", rule: warning, families: all },
  APPROVAL_GRANTED: { severity: "low", rule: warning, families: all },
  APPROVAL_UNLIMITED: {
    severity: "high",
    rule: toggle("core.blockUnlimitedApprovals"),
    families: all,
  },
  // A spender with no code (a plain account) that may spend the user's tokens: ice phishing.
  APPROVAL_TO_WALLET: { severity: "high", rule: toggle("core.blockRiskyContracts"), families: all },
  RISKY_CONTRACT_INTERACTION: {
    severity: "high",
    rule: toggle("core.blockRiskyContracts"),
    families: all,
  },
  UNKNOWN_CONTRACT_EXPOSURE: {
    severity: "medium",
    rule: toggle("core.blockUnknownContractExposure"),
    families: all,
  },
  VALUE_KEPT_BY_UNKNOWN_CONTRACT: {
    severity: "high",
    rule: toggle("core.blockRiskyContracts"),
    families: all,
  },
  AUTHORITY_CHANGE: { severity: "high", rule: toggle("core.blockAuthorityChanges"), families: all },
  KNOWN_MALICIOUS_ADDRESS: {
    severity: "critical",
    rule: toggle("core.blockKnownMalicious"),
    families: all,
  },
  REPUTATION_TRUST_BELOW_MINIMUM: {
    severity: "medium",
    rule: threshold("core.minReputationTrust"),
    families: all,
  },
  REPUTATION_FRESH_ACCOUNT: { severity: "medium", rule: warning, families: all },
  REPUTATION_WHALE_COUNTERPARTY: { severity: "low", rule: warning, families: all },
  REPUTATION_DATA_UNAVAILABLE: {
    severity: "high",
    rule: failClosed(
      "core.blockRiskyContracts",
      "core.blockKnownMalicious",
      "core.minReputationTrust",
    ),
    families: all,
  },
  // Address poisoning and CREATE2-style lookalikes.
  LOOKALIKE_ADDRESS: {
    severity: "critical",
    rule: toggle("core.blockRiskyContracts"),
    families: all,
  },
  DEEP_CALL_NESTING: { severity: "low", rule: warning, families: all },
  HIGH_OPERATION_COUNT: { severity: "low", rule: warning, families: all },
  EXCESSIVE_FEE: {
    severity: "medium",
    rule: threshold("core.maxFee", "evm.maxGas"),
    families: all,
  },
  COMPLIANCE_NO_CREDENTIAL: {
    severity: "high",
    rule: threshold(...COMPLIANCE_FIELDS),
    families: all,
  },
  COMPLIANCE_EXPIRED: {
    severity: "high",
    rule: threshold("core.compliance.required"),
    families: all,
  },
  COMPLIANCE_TIER_INSUFFICIENT: {
    severity: "high",
    rule: threshold("core.compliance.minTier"),
    families: all,
  },
  COMPLIANCE_COUNTRY_DISALLOWED: {
    severity: "high",
    rule: threshold("core.compliance.allowedCountries"),
    families: all,
  },
  COMPLIANCE_DATA_UNAVAILABLE: {
    severity: "high",
    rule: failClosed(...COMPLIANCE_FIELDS),
    families: all,
  },
  // A signed message Baret cannot read that points at funds or another chain: never Safe.
  SIGNATURE_NOT_UNDERSTOOD: { severity: "high", rule: failClosed(), families: all },
  SIGNATURE_UNRECOGNISED: { severity: "medium", rule: warning, families: all },
  X402_DESTINATION_MISMATCH: { severity: "high", rule: warning, families: all },
  X402_ASSET_MISMATCH: { severity: "high", rule: warning, families: all },
  X402_AMOUNT_MISMATCH: { severity: "high", rule: warning, families: all },
  X402_NETWORK_MISMATCH: { severity: "high", rule: warning, families: all },
  X402_NON_CANONICAL_ASSET: {
    severity: "high",
    rule: threshold("core.x402.allowedAssets"),
    families: all,
  },
  X402_MEMO_MISSING: {
    severity: "medium",
    rule: threshold("core.x402.requireMemo"),
    families: all,
  },
  // The 402 answer cannot be read: nothing to check the payment against.
  X402_SHAPE_INVALID: { severity: "high", rule: failClosed(), families: all },
  X402_FACILITATOR_MISMATCH: { severity: "medium", rule: warning, families: all },
  ESTIMATED_LOSS_EXCEEDS_MAX: {
    severity: "high",
    rule: threshold("core.maxLossPercent"),
    families: all,
  },
  LOSS_PERCENT_UNAVAILABLE: {
    severity: "high",
    rule: failClosed("core.maxLossPercent"),
    families: all,
  },
  POST_BALANCE_TOO_LOW: {
    severity: "high",
    rule: threshold("core.minPostBalances"),
    families: all,
  },
  POST_BALANCE_UNAVAILABLE: {
    severity: "high",
    rule: failClosed("core.minPostBalances"),
    families: all,
  },
  X402_ASSET_NOT_ALLOWED: {
    severity: "high",
    rule: threshold("core.x402.allowedAssets"),
    families: all,
  },
  X402_MERCHANT_NOT_ALLOWED: {
    severity: "high",
    rule: threshold("core.x402.allowedMerchantOrigins"),
    families: all,
  },
  X402_PER_TX_CAP_EXCEEDED: { severity: "high", rule: threshold(CAPS), families: all },
  X402_HOURLY_CAP_EXCEEDED: { severity: "high", rule: threshold(CAPS), families: all },
  X402_DAILY_CAP_EXCEEDED: { severity: "high", rule: threshold(CAPS), families: all },
  X402_SPEND_HISTORY_UNAVAILABLE: { severity: "high", rule: failClosed(CAPS), families: all },

  NFT_OPERATOR_GRANTED: {
    severity: "high",
    rule: toggle("evm.blockSetApprovalForAll"),
    families: ["evm"],
  },
  PERMIT_SIGNATURE_DETECTED: {
    severity: "high",
    rule: toggle("evm.blockPermit"),
    families: ["evm"],
  },
  SIGNED_ORDER_DETECTED: { severity: "low", rule: warning, families: ["evm"] },
  ORDER_PAYS_NOTHING: { severity: "critical", rule: toggle("evm.blockPermit"), families: ["evm"] },
  DELEGATECALL_DETECTED: {
    severity: "medium",
    rule: toggle("evm.blockDelegatecall"),
    families: ["evm"],
  },
  SELFDESTRUCT_CALL: {
    severity: "critical",
    rule: toggle("evm.blockSelfdestruct"),
    families: ["evm"],
  },
  // The simulation does not apply an EIP-7702 delegation, so its effect is unknown.
  ACCOUNT_CODE_DELEGATION: {
    severity: "critical",
    rule: failClosed("evm.blockDelegatecall"),
    families: ["evm"],
  },
  CALL_TO_ADDRESS_WITHOUT_CODE: { severity: "medium", rule: warning, families: ["evm"] },

  ACCOUNT_MERGE_DETECTED: {
    severity: "critical",
    rule: toggle("stellar.blockAccountMerge"),
    families: ["stellar"],
  },
  MASTER_KEY_REMOVED: {
    severity: "critical",
    rule: toggle("core.blockAuthorityChanges"),
    families: ["stellar"],
  },
  TRUSTLINE_CHANGE_DETECTED: { severity: "low", rule: warning, families: ["stellar"] },
  TRUSTLINE_REMOVED: {
    severity: "medium",
    rule: toggle("stellar.blockTrustlineRemoval"),
    families: ["stellar"],
  },
  UNLIMITED_TRUSTLINE: { severity: "low", rule: warning, families: ["stellar"] },
  UNSIGNED_AUTH_ENTRY: { severity: "medium", rule: warning, families: ["stellar"] },

  SESSION_CODE_EXECUTION: {
    severity: "high",
    rule: toggle("casper.blockSessionCode"),
    families: ["casper"],
  },

  ACCOUNT_DELETE_DETECTED: {
    severity: "critical",
    rule: toggle("near.blockDeleteAccount"),
    families: ["near"],
  },
  CONTRACT_DEPLOY_DETECTED: {
    severity: "high",
    rule: toggle("near.blockContractDeploy"),
    families: ["near"],
  },
  // A key limited to one contract and a gas allowance: worth reading, never blocking on its own.
  FUNCTION_CALL_KEY_ADDED: { severity: "low", rule: warning, families: ["near"] },
  // A signature for another chain: the transaction it signs is not simulated here.
  CHAIN_SIGNATURE_REQUEST: { severity: "medium", rule: warning, families: ["near"] },
  // NEAR Intents (TN.8): the 1Click quote sent with the deposit says where the swap pays.
  INTENTS_RECIPIENT_MISMATCH: {
    severity: "critical",
    rule: toggle("near.blockIntentsMismatch"),
    families: ["near"],
  },
  INTENTS_DEPOSIT_MISMATCH: {
    severity: "high",
    rule: toggle("near.blockIntentsMismatch"),
    families: ["near"],
  },
  // A quote was sent but cannot be read, has expired or has no deposit address.
  INTENTS_QUOTE_INVALID: { severity: "high", rule: failClosed(), families: ["near"] },
  // A fee the quote adds for an app: shown, never blocking on its own.
  INTENTS_APP_FEE: { severity: "low", rule: warning, families: ["near"] },
  // 1Click could not confirm the quote behind the deposit address, or the request's quote
  // differs from the one 1Click registered (a forged quote). No rule can turn it off.
  INTENTS_QUOTE_UNVERIFIED: { severity: "critical", rule: failClosed(), families: ["near"] },
  // A NEP-171 piece or NEP-245 multi-tokens leave: no price, so no amount rule covers them.
  NFT_TRANSFER_DETECTED: { severity: "medium", rule: warning, families: ["near"] },
  MULTI_TOKEN_TRANSFER_DETECTED: { severity: "medium", rule: warning, families: ["near"] },
} as const satisfies Record<FindingCode, FindingSpec>;

/**
 * Metropolis (v1, @baret/guard 0.1.x) codes → v2 codes. Codes not listed kept their name.
 * Used to migrate saved content and to replay Metropolis fixtures in parity tests.
 */
export const V1_FINDING_CODE_MAP = {
  ERC20_APPROVAL_GRANTED: "APPROVAL_GRANTED",
  ERC20_APPROVAL_UNLIMITED: "APPROVAL_UNLIMITED",
  OWNERSHIP_TRANSFER: "AUTHORITY_CHANGE",
  NANSEN_FLAGGED_FRESH_WALLET: "REPUTATION_FRESH_ACCOUNT",
  NANSEN_FLAGGED_WHALE_COUNTERPARTY: "REPUTATION_WHALE_COUNTERPARTY",
  NANSEN_TRUST_BELOW_MINIMUM: "REPUTATION_TRUST_BELOW_MINIMUM",
  EXCESSIVE_GAS: "EXCESSIVE_FEE",
} as const satisfies Record<string, FindingCode>;

/** The v2 code for a v1 code, or null when the v1 code is unknown. */
export function findingCodeFromV1(code: string): FindingCode | null {
  const mapped = (V1_FINDING_CODE_MAP as Record<string, FindingCode>)[code];
  if (mapped) return mapped;
  return (FINDING_CODES as readonly string[]).includes(code) ? (code as FindingCode) : null;
}
