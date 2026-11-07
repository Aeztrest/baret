import type { Caip19 } from "./ids.js";
import type { GuardPolicy } from "./policy.js";
import { toBaseUnits } from "./units.js";

/**
 * The three starting rule sets, carried over from Metropolis (v1) into v2:
 * Strict blocks the most and turns every caution into a block; Balanced is the default;
 * Permissive still blocks known-malicious addresses, failing transactions and the
 * account-destroying operations (selfdestruct, account merge).
 *
 * The templates are chain-free. `createPolicy()` fills in what depends on the chain:
 * the payment assets and their x402 caps, and the native-balance floor.
 */

export const POLICY_TEMPLATE_NAMES = ["strict", "balanced", "permissive"] as const;
export type PolicyTemplateName = (typeof POLICY_TEMPLATE_NAMES)[number];

/** x402 caps per template, in whole units of a dollar-pegged payment asset. */
export const TEMPLATE_X402_CAPS: Record<
  PolicyTemplateName,
  { perTx: string; perHour: string; perDay: string }
> = {
  strict: { perTx: "1", perHour: "5", perDay: "20" },
  balanced: { perTx: "5", perHour: "25", perDay: "100" },
  permissive: { perTx: "50", perHour: "250", perDay: "1000" },
};

const base = (name: PolicyTemplateName): GuardPolicy => {
  const strict = name === "strict";
  const permissive = name === "permissive";
  return {
    version: 2,
    core: {
      requireSuccessfulSimulation: true,
      allowWarnings: !strict,
      blockKnownMalicious: true,
      blockRiskyContracts: !permissive,
      blockUnknownContractExposure: strict,
      blockUnlimitedApprovals: !permissive,
      blockAuthorityChanges: !permissive,
      maxLossPercent: strict ? 10 : permissive ? null : 50,
      minPostBalances: [],
      minReputationTrust: strict ? "known" : "new",
      maxFee: null,
      compliance: { required: false, allowedCountries: [], minTier: null },
      x402: { requireMemo: strict, allowedAssets: [], allowedMerchantOrigins: [], caps: [] },
    },
    evm: {
      blockSetApprovalForAll: !permissive,
      blockPermit: !permissive,
      blockSelfdestruct: true,
      blockDelegatecall: !permissive,
      maxGas: strict ? 2_000_000 : permissive ? null : 10_000_000,
    },
    stellar: {
      blockAccountMerge: true,
      blockTrustlineRemoval: strict,
    },
    casper: {
      // Payable calls on Casper run through session code, so only Strict blocks it.
      blockSessionCode: strict,
    },
  };
};

/** The templates with no chain filled in (no payment assets, no floors). */
export const POLICY_TEMPLATES: Record<PolicyTemplateName, GuardPolicy> = {
  strict: base("strict"),
  balanced: base("balanced"),
  permissive: base("permissive"),
};

export interface PolicyAsset {
  id: Caip19;
  decimals: number;
}

export interface PolicyChainContext {
  /** Dollar-pegged assets an agent may pay with on this chain (usually the canonical USDC). */
  paymentAssets: readonly PolicyAsset[];
  /** The native asset and the floor each template keeps, in whole units. */
  native?: PolicyAsset & { floors: Partial<Record<PolicyTemplateName, string>> };
}

/** A fresh template with the chain's payment assets, x402 caps and native floor filled in. */
export function createPolicy(name: PolicyTemplateName, chain: PolicyChainContext): GuardPolicy {
  // The policy is plain JSON data, so a JSON round trip is a full deep copy without
  // needing DOM or Node typings in this package.
  const policy: GuardPolicy = JSON.parse(JSON.stringify(POLICY_TEMPLATES[name]));
  const caps = TEMPLATE_X402_CAPS[name];
  policy.core.x402.allowedAssets = chain.paymentAssets.map((a) => a.id);
  policy.core.x402.caps = chain.paymentAssets.map((a) => ({
    asset: a.id,
    perTx: toBaseUnits(caps.perTx, a.decimals),
    perHour: toBaseUnits(caps.perHour, a.decimals),
    perDay: toBaseUnits(caps.perDay, a.decimals),
  }));
  const floor = chain.native?.floors[name];
  if (chain.native && floor !== undefined) {
    policy.core.minPostBalances = [
      { asset: chain.native.id, min: toBaseUnits(floor, chain.native.decimals) },
    ];
  }
  return policy;
}
