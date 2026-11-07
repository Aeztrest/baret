import type { Address } from "viem";
import {
  type Detector,
  type EvmContext,
  type FindingDraft,
  REGISTRY_BLOCKLIST_SEVERITY,
} from "../analysis/context.js";
import { formatAmount, tokenMeta } from "../analysis/format.js";

/**
 * Contracts the request touches: reported in the reputation registry, or on
 * no list Baret reads. A contract counts as known when the server lists it,
 * when it is the network's USDC, or when the reputation provider rates it trusted. The
 * implementation behind a standard proxy is not judged on its own. An unknown
 * contract that keeps what the user sends is reported on top (`keptValue`).
 */
export const programs: Detector = (ctx) => {
  const out: FindingDraft[] = [];
  const known = new Set(ctx.network.knownContracts);
  if (ctx.network.usdcAddress) known.add(ctx.network.usdcAddress);

  // The code behind a standard proxy is vouched for, or not, through the proxy.
  const implementations = new Set(
    ctx.delegateCalls.filter((d) => d.standardProxy).map((d) => d.codeFrom),
  );

  const unknown = new Set<Address>();
  for (const contract of ctx.contracts) {
    if (implementations.has(contract)) continue;
    const entry = ctx.registry.data?.get(contract);
    if (entry?.flagged && entry.severity < REGISTRY_BLOCKLIST_SEVERITY) {
      out.push({
        code: "RISKY_CONTRACT_INTERACTION",
        values: { contract },
        details: { severity: entry.severity, reasonCode: entry.reasonCode },
      });
      continue;
    }
    if (entry?.flagged) continue; // a blocklist entry is the reputation detector's
    const identified = ctx.reputation.data?.get(contract)?.trustLevel === "trusted";
    if (!known.has(contract) && !identified) {
      out.push({ code: "UNKNOWN_CONTRACT_EXPOSURE", values: { contract } });
      unknown.add(contract);
    }
  }
  out.push(...keptValue(ctx, unknown));
  out.push(...callWithoutCode(ctx));
  return out;
};

/**
 * Calldata sent to an account that has no code. The chain accepts such a
 * call and does nothing with the data, so whatever the site says it does (a
 * token transfer, a swap) will not happen: a wrong, stale or poisoned
 * address. Not reported for a plain transfer (no calldata), nor for a
 * deployment (no `to`).
 */
function callWithoutCode(ctx: EvmContext): FindingDraft[] {
  const to = ctx.tx?.to ?? null;
  if (!ctx.tx || !to || ctx.tx.data === "0x" || ctx.contracts.includes(to)) return [];
  // Exactly 20 bytes is no call: an ERC-2771 forwarder relaying a plain
  // transfer appends the signer's address to empty data (effects.ts).
  if (ctx.tx.data.length === 42) return [];
  return [{ code: "CALL_TO_ADDRESS_WITHOUT_CODE", values: { address: to } }];
}

/**
 * A call that pays an unknown contract and brings nothing back: the user
 * calls a function, value leaves their account for a contract nothing vouches
 * for, and no token, collectible or native coin arrives in the same transaction. A
 * deposit or a purchase returns something; this one only takes.
 *
 * Not reported for a plain transfer (no calldata): sending native coin to a contract
 * address is a transfer, and the user chose its recipient. One finding per
 * contract, for the largest amount it keeps.
 */
function keptValue(ctx: EvmContext, unknown: ReadonlySet<Address>): FindingDraft[] {
  if (!ctx.tx || ctx.tx.data === "0x" || unknown.size === 0) return [];
  const { transfers } = ctx.effects;
  if (transfers.some((t) => t.to === ctx.user && t.from !== ctx.user)) return [];
  const kept = new Map<Address, (typeof transfers)[number]>();
  for (const t of transfers) {
    if (t.from !== ctx.user || !unknown.has(t.to) || t.amount === 0n) continue;
    const seen = kept.get(t.to);
    if (!seen || t.amount > seen.amount) kept.set(t.to, t);
  }
  return [...kept.values()].map((t) => {
    const meta = tokenMeta(ctx, t.token);
    return {
      code: "VALUE_KEPT_BY_UNKNOWN_CONTRACT",
      values: {
        contract: t.to,
        amount: t.nft ? "1" : formatAmount(t.amount, meta.decimals),
        asset: meta.symbol,
      },
    };
  });
}
