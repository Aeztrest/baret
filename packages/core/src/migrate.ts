import { z } from "zod";
import { type Caip2, toCaip19 } from "./ids.js";
import type { GuardPolicy, ReputationTrustLevel } from "./policy.js";
import { POLICY_TEMPLATES, type PolicyAsset } from "./policy-templates.js";
import { decimalAmountSchema, toBaseUnits } from "./units.js";

/**
 * GuardPolicy v1: the flat, EVM-only policy of Metropolis (@baret/guard 0.1.x), kept here
 * only so saved rules and 0.1.x integrators keep working. Amounts are whole units.
 */
export const guardPolicyV1Schema = z
  .object({
    requireSuccessfulSimulation: z.boolean(),
    blockRiskyContracts: z.boolean(),
    blockUnknownContractExposure: z.boolean(),
    blockUnlimitedApprovals: z.boolean(),
    blockSetApprovalForAll: z.boolean(),
    blockPermit: z.boolean(),
    blockSelfdestruct: z.boolean(),
    blockDelegatecall: z.boolean(),
    blockOwnershipTransfer: z.boolean(),
    maxLossPercent: z.number().min(0).max(100).nullable(),
    minPostUsdcBalance: decimalAmountSchema.nullable(),
    minPostNativeBalance: decimalAmountSchema.nullable(),
    blockKnownMalicious: z.boolean(),
    minNansenTrustLevel: z.enum(["new", "established", "identified"]),
    requireComplianceCheck: z.boolean(),
    allowedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)),
    minComplianceTier: z.number().int().min(0).nullable(),
    maxGas: z.number().int().positive().nullable(),
    requireMemo: z.boolean(),
    maxPerTxCap: decimalAmountSchema.nullable(),
    maxHourlyCap: decimalAmountSchema.nullable(),
    maxDailyCap: decimalAmountSchema.nullable(),
    allowedAssets: z.array(z.string().regex(/^0x[0-9a-fA-F]{40}$/)),
    allowedMerchantOrigins: z.array(z.url()),
    allowWarnings: z.boolean(),
  })
  .strict();

export type GuardPolicyV1 = z.infer<typeof guardPolicyV1Schema>;

const TRUST: Record<GuardPolicyV1["minNansenTrustLevel"], ReputationTrustLevel> = {
  new: "new",
  established: "known",
  identified: "trusted",
};

export interface MigrationContext {
  /** The EVM chain the v1 policy was used on (v1 had Monad testnet and mainnet only). */
  chain: Caip2;
  native: PolicyAsset;
  /** The chain's canonical USDC: v1 caps and the USDC floor were in USDC. */
  usdc: PolicyAsset | null;
}

/**
 * A v1 policy as v2. The Stellar and Casper sections did not exist in v1; they take the
 * Balanced defaults. v1 caps and the USDC floor need the chain's USDC: without it they
 * cannot be expressed and are dropped, which blocks payments rather than loosening them
 * (an asset outside `allowedAssets` is refused).
 */
export function migratePolicyV1(input: unknown, ctx: MigrationContext): GuardPolicy {
  const v1 = guardPolicyV1Schema.parse(input);
  const balanced = POLICY_TEMPLATES.balanced;
  const usdc = ctx.usdc;

  const minPostBalances: GuardPolicy["core"]["minPostBalances"] = [];
  if (v1.minPostNativeBalance !== null) {
    minPostBalances.push({
      asset: ctx.native.id,
      min: toBaseUnits(v1.minPostNativeBalance, ctx.native.decimals),
    });
  }
  if (v1.minPostUsdcBalance !== null && usdc) {
    minPostBalances.push({
      asset: usdc.id,
      min: toBaseUnits(v1.minPostUsdcBalance, usdc.decimals),
    });
  }

  const anyCap = v1.maxPerTxCap !== null || v1.maxHourlyCap !== null || v1.maxDailyCap !== null;
  const cap = (v: string | null) => (v === null || !usdc ? null : toBaseUnits(v, usdc.decimals));
  const caps: GuardPolicy["core"]["x402"]["caps"] =
    anyCap && usdc
      ? [
          {
            asset: usdc.id,
            perTx: cap(v1.maxPerTxCap),
            perHour: cap(v1.maxHourlyCap),
            perDay: cap(v1.maxDailyCap),
          },
        ]
      : [];

  return {
    version: 2,
    core: {
      requireSuccessfulSimulation: v1.requireSuccessfulSimulation,
      allowWarnings: v1.allowWarnings,
      blockKnownMalicious: v1.blockKnownMalicious,
      blockRiskyContracts: v1.blockRiskyContracts,
      blockUnknownContractExposure: v1.blockUnknownContractExposure,
      blockUnlimitedApprovals: v1.blockUnlimitedApprovals,
      blockAuthorityChanges: v1.blockOwnershipTransfer,
      maxLossPercent: v1.maxLossPercent,
      minPostBalances,
      minReputationTrust: TRUST[v1.minNansenTrustLevel],
      maxFee: null,
      compliance: {
        required: v1.requireComplianceCheck,
        allowedCountries: [...v1.allowedCountries],
        minTier: v1.minComplianceTier,
      },
      x402: {
        requireMemo: v1.requireMemo,
        allowedAssets: v1.allowedAssets.map((a) => toCaip19(ctx.chain, "erc20", a)),
        allowedMerchantOrigins: [...v1.allowedMerchantOrigins],
        caps,
      },
    },
    evm: {
      blockSetApprovalForAll: v1.blockSetApprovalForAll,
      blockPermit: v1.blockPermit,
      blockSelfdestruct: v1.blockSelfdestruct,
      blockDelegatecall: v1.blockDelegatecall,
      maxGas: v1.maxGas,
    },
    stellar: { ...balanced.stellar },
    casper: { ...balanced.casper },
    near: { ...balanced.near },
  };
}
