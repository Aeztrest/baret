import { REPUTATION_TRUST_LEVELS, type ReputationTrustLevel } from "@baret/core";
import {
  type Detector,
  type FindingDraft,
  REGISTRY_BLOCKLIST_SEVERITY,
} from "../analysis/context.js";

const rank = (level: ReputationTrustLevel) => REPUTATION_TRUST_LEVELS.indexOf(level);

/**
 * The reputation provider (Nansen today) and Baret's on-chain ReputationRegistry, for
 * every address the request sends something to. Ported from Metropolis.
 *
 * The blocklist rules need the registry; the provider adds to them when it answers. Only
 * the trust-level rule cannot be decided without the provider. When a source a rule needs
 * does not answer, the request fails closed with REPUTATION_DATA_UNAVAILABLE (D-017).
 */
export const reputation: Detector = (ctx) => {
  const out: FindingDraft[] = [];
  const p = ctx.policy.core;
  const providerNeeded = p.minReputationTrust !== "new";
  const registryNeeded = p.blockKnownMalicious || p.blockRiskyContracts;

  const missing: string[] = [];
  if (providerNeeded && !ctx.reputation.data) missing.push("reputation-provider");
  if (registryNeeded && !ctx.registry.data) missing.push("reputation-registry");
  if (missing.length > 0) {
    out.push({
      code: "REPUTATION_DATA_UNAVAILABLE",
      values: {},
      details: { sources: missing },
      rule:
        registryNeeded && !ctx.registry.data
          ? p.blockKnownMalicious
            ? "core.blockKnownMalicious"
            : "core.blockRiskyContracts"
          : "core.minReputationTrust",
    });
  }

  const contracts = new Set(ctx.contracts);
  const addresses = new Set([...ctx.counterparties, ...ctx.contracts]);
  for (const address of addresses) {
    const entry = ctx.registry.data?.get(address);
    const profile = ctx.reputation.data?.get(address);
    const registryBlocklisted =
      entry?.flagged === true &&
      (entry.severity >= REGISTRY_BLOCKLIST_SEVERITY || !contracts.has(address));

    if (registryBlocklisted || profile?.flagged) {
      out.push({
        code: "KNOWN_MALICIOUS_ADDRESS",
        values: { address },
        details: {
          registry: registryBlocklisted
            ? { severity: entry?.severity, reasonCode: entry?.reasonCode }
            : null,
          provider: profile?.flagged === true,
        },
      });
      continue;
    }
    if (!profile || !ctx.counterparties.includes(address)) continue;
    if (profile.freshWallet) out.push({ code: "REPUTATION_FRESH_ACCOUNT", values: { address } });
    if (profile.whale) out.push({ code: "REPUTATION_WHALE_COUNTERPARTY", values: { address } });
    if (rank(profile.trustLevel) < rank(p.minReputationTrust)) {
      out.push({
        code: "REPUTATION_TRUST_BELOW_MINIMUM",
        values: { address, actual: profile.trustLevel, limit: p.minReputationTrust },
        rule: "core.minReputationTrust",
      });
    }
  }
  return out;
};
