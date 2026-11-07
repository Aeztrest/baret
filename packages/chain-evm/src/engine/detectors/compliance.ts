import type { PolicyField } from "@baret/core";
import { getAddress } from "viem";
import type { Detector, EvmContext, FindingDraft } from "../analysis/context.js";

/**
 * Identity credentials (Cleanverse A-Pass) on both sides of a transfer. Ported from
 * Metropolis (D-030, D-034).
 *
 * Two things can ask for them. The user's rules: `core.compliance.required` applies to the
 * user and every recipient; the country and tier rules apply to recipients only. And the
 * asset: a compliant token (CVA) moves only between credential holders, so sending one is
 * checked on both sides whatever the rules say.
 *
 * `details.side` says which account a finding is about (`self` / `recipient`);
 * `details.asset` is set when the asset, not a rule, demands the credential.
 */

/** `NotVerified(address party, uint8 reason)`, the typed refusal of CompliantPaymentGuard. */
const NOT_VERIFIED = "0x0c2b355f";
const GUARD_REASONS = ["NoCredential", "NotActive", "TierTooLow"] as const;

/**
 * A payment the CompliantPaymentGuard refused in simulation: the contract checked both
 * identities on chain and named the party that failed. The asset never moved, so the
 * contract's own answer is reported.
 */
function refusedByGuard(ctx: EvmContext): FindingDraft[] {
  const data = ctx.simulation.revertData;
  if (!data?.toLowerCase().startsWith(NOT_VERIFIED) || data.length !== 138) return [];
  const party = getAddress(`0x${data.slice(34, 74)}`);
  const reason = GUARD_REASONS[Number(BigInt(`0x${data.slice(74)}`))];
  if (!reason) return [];
  return [
    {
      code: "COMPLIANCE_NO_CREDENTIAL",
      values: { recipient: party },
      details: {
        side: party === ctx.user ? "self" : "recipient",
        reason,
        refusedBy: ctx.tx?.to ?? null,
      },
      rule: "core.compliance.required",
    },
  ];
}

export const compliance: Detector = (ctx) => {
  const refused = refusedByGuard(ctx);
  if (refused.length > 0) return refused;
  const c = ctx.policy.core.compliance;
  const byAsset = ctx.gatedAssets[0] ?? null;
  const byRule = c.required || c.allowedCountries.length > 0 || c.minTier !== null;
  if ((!byRule && !byAsset) || ctx.recipients.length === 0) return [];

  const deciding: PolicyField =
    c.required || !byRule
      ? "core.compliance.required"
      : c.allowedCountries.length > 0
        ? "core.compliance.allowedCountries"
        : "core.compliance.minTier";
  const asset = byAsset ? { asset: byAsset } : {};

  if (!ctx.compliance.data) {
    return [{ code: "COMPLIANCE_DATA_UNAVAILABLE", values: {}, details: asset, rule: deciding }];
  }

  const bothSides = c.required || byAsset !== null;
  const out: FindingDraft[] = [];
  const accounts = [
    ...(bothSides ? [{ address: ctx.user, side: "self" as const }] : []),
    ...ctx.recipients
      .filter((r) => r !== ctx.user)
      .map((address) => ({ address, side: "recipient" as const })),
  ];

  for (const { address, side } of accounts) {
    const credential = ctx.compliance.data.get(address) ?? null;
    if (!credential) {
      out.push({
        code: "COMPLIANCE_NO_CREDENTIAL",
        values: { recipient: address },
        details: { side, ...asset },
        rule: deciding,
      });
      continue;
    }
    if (credential.expiresAt !== null && credential.expiresAt <= ctx.now && bothSides) {
      // An expired credential blocks through the identity rule or the asset.
      out.push({
        code: "COMPLIANCE_EXPIRED",
        values: { recipient: address },
        details: { side, expiresAt: credential.expiresAt, ...asset },
        rule: "core.compliance.required",
      });
      continue;
    }
    if (side === "self") continue;
    if (c.allowedCountries.length > 0) {
      // No country on the credential is not a pass: the rule cannot be shown to hold.
      const outside = credential.countries.find((x) => !c.allowedCountries.includes(x));
      if (outside !== undefined || credential.countries.length === 0) {
        out.push({
          code: "COMPLIANCE_COUNTRY_DISALLOWED",
          values: { recipient: address, country: outside ?? "an unknown country" },
          details: { side, countries: credential.countries },
          rule: "core.compliance.allowedCountries",
        });
      }
    }
    if (c.minTier !== null && credential.tier < c.minTier) {
      out.push({
        code: "COMPLIANCE_TIER_INSUFFICIENT",
        values: { recipient: address, tier: String(credential.tier), limit: String(c.minTier) },
        details: { side },
        rule: "core.compliance.minTier",
      });
    }
  }
  return out;
};
