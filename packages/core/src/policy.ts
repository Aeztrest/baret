import { z } from "zod";
import { caip19Schema } from "./ids.js";
import { baseUnitsSchema } from "./units.js";

/**
 * GuardPolicy v2 (ADR-0006): the owner's rules, as pure data.
 *
 * `core` applies on every chain; `evm`, `stellar` and `casper` hold the rules only one
 * family has. Every section is always present, so a policy is complete on any chain and
 * a wallet can keep one policy per account per chain without merging defaults.
 *
 * Amounts are base units of a named asset (CAIP-19); a null threshold means the rule is off.
 */

export const REPUTATION_TRUST_LEVELS = ["new", "known", "trusted"] as const;
export type ReputationTrustLevel = (typeof REPUTATION_TRUST_LEVELS)[number];

const assetAmountSchema = z.object({ asset: caip19Schema, min: baseUnitsSchema }).strict();

/** Per-asset x402 caps. Null: that cap is off. Hourly and daily caps are rolling windows. */
export const x402CapSchema = z
  .object({
    asset: caip19Schema,
    perTx: baseUnitsSchema.nullable(),
    perHour: baseUnitsSchema.nullable(),
    perDay: baseUnitsSchema.nullable(),
  })
  .strict();

export const corePolicySchema = z
  .object({
    /** A transaction whose simulation fails is blocked. */
    requireSuccessfulSimulation: z.boolean(),
    /** Off: any warning (a finding with no rule of its own) blocks. */
    allowWarnings: z.boolean(),
    blockKnownMalicious: z.boolean(),
    blockRiskyContracts: z.boolean(),
    blockUnknownContractExposure: z.boolean(),
    blockUnlimitedApprovals: z.boolean(),
    /** Owner transfers, signer or threshold changes, master key removal. */
    blockAuthorityChanges: z.boolean(),
    /** Largest share (0–100) of the account's tracked value the transaction may remove. */
    maxLossPercent: z.number().min(0).max(100).nullable(),
    /** Balances that must remain after the transaction. */
    minPostBalances: z.array(assetAmountSchema),
    /** Lowest reputation of a counterparty; "new" sets no minimum. */
    minReputationTrust: z.enum(REPUTATION_TRUST_LEVELS),
    /** Largest fee, in base units of the chain's native asset. */
    maxFee: baseUnitsSchema.nullable(),
    compliance: z
      .object({
        /** Both sides of a transfer must hold a valid credential. */
        required: z.boolean(),
        /** ISO 3166-1 alpha-2 codes of the other account. Empty: any country. */
        allowedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)),
        /** Lowest verification level of the other account. Null: any level. */
        minTier: z.number().int().min(0).nullable(),
      })
      .strict(),
    x402: z
      .object({
        requireMemo: z.boolean(),
        /** Assets an agent may pay with. Empty: every payment is blocked. */
        allowedAssets: z.array(caip19Schema),
        /** Origins (https://shop.example) an agent may pay. Empty: any site, within the caps. */
        allowedMerchantOrigins: z.array(z.url()),
        caps: z.array(x402CapSchema),
      })
      .strict(),
  })
  .strict();

export const evmPolicySchema = z
  .object({
    blockSetApprovalForAll: z.boolean(),
    /** Off-chain approvals and orders (EIP-2612, Permit2, Seaport). */
    blockPermit: z.boolean(),
    blockSelfdestruct: z.boolean(),
    blockDelegatecall: z.boolean(),
    /** Gas units. */
    maxGas: z.number().int().positive().nullable(),
  })
  .strict();

export const stellarPolicySchema = z
  .object({
    /** account_merge sends everything and deletes the account. */
    blockAccountMerge: z.boolean(),
    blockTrustlineRemoval: z.boolean(),
  })
  .strict();

export const casperPolicySchema = z
  .object({
    /** Session code runs arbitrary wasm with the account's full authority. */
    blockSessionCode: z.boolean(),
  })
  .strict();

export const guardPolicySchema = z
  .object({
    version: z.literal(2),
    core: corePolicySchema,
    evm: evmPolicySchema,
    stellar: stellarPolicySchema,
    casper: casperPolicySchema,
  })
  .strict();

export type GuardPolicy = z.infer<typeof guardPolicySchema>;
export type X402Cap = z.infer<typeof x402CapSchema>;

/**
 * Every rule a finding or a fired rule can name, as a dotted path into GuardPolicy.
 * A test walks the schema and keeps this list equal to its leaves.
 */
export const POLICY_FIELDS = [
  "core.requireSuccessfulSimulation",
  "core.allowWarnings",
  "core.blockKnownMalicious",
  "core.blockRiskyContracts",
  "core.blockUnknownContractExposure",
  "core.blockUnlimitedApprovals",
  "core.blockAuthorityChanges",
  "core.maxLossPercent",
  "core.minPostBalances",
  "core.minReputationTrust",
  "core.maxFee",
  "core.compliance.required",
  "core.compliance.allowedCountries",
  "core.compliance.minTier",
  "core.x402.requireMemo",
  "core.x402.allowedAssets",
  "core.x402.allowedMerchantOrigins",
  "core.x402.caps",
  "evm.blockSetApprovalForAll",
  "evm.blockPermit",
  "evm.blockSelfdestruct",
  "evm.blockDelegatecall",
  "evm.maxGas",
  "stellar.blockAccountMerge",
  "stellar.blockTrustlineRemoval",
  "casper.blockSessionCode",
] as const;

export type PolicyField = (typeof POLICY_FIELDS)[number];
