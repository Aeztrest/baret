import type { Address } from "viem";
import type { EvmContext, FindingDraft } from "../analysis/context.js";
import { assetAddress, formatAmount, formatPercent, tokenMeta } from "../analysis/format.js";
import { actualPayment } from "./x402.js";

/**
 * The rules that need the owner's limits or spend history: loss, balance floors, x402
 * caps and merchants. Ported from Metropolis `policy/evaluate.ts` (`policyFindings`);
 * deciding which findings block (`decide`) belongs to the engine (T1.6).
 *
 * v2 differences: floors and caps are per CAIP-19 asset in base units (no USDC or MON
 * assumed); a payment asset with no cap entry has no caps.
 */

/** The user's net change in one asset (native when token is null), fee included for native. */
export function netDelta(ctx: EvmContext, token: Address | null): bigint | null {
  let delta = 0n;
  for (const t of ctx.effects.transfers) {
    if (t.nft || t.token !== token) continue;
    if (t.from === ctx.user) delta -= t.amount;
    if (t.to === ctx.user) delta += t.amount;
  }
  if (token === null && ctx.tx && ctx.tx.from === ctx.user) {
    if (ctx.feeWei === null) return null;
    delta -= ctx.feeWei;
  }
  return delta;
}

function before(ctx: EvmContext, token: Address | null): bigint | null {
  return token === null
    ? ctx.balancesBefore.native
    : (ctx.balancesBefore.tokens.get(token) ?? null);
}

/**
 * An exchange with a listed contract: everything that leaves the user's account goes to
 * contracts Baret vouches for, and the user receives something in the same transaction (a
 * swap, a stake that returns a receipt, a mint). The two sides cannot be priced against
 * each other, so the loss limit does not apply (Metropolis D-021).
 */
export function isExchangeWithListed(ctx: EvmContext): boolean {
  const listed = new Set<Address>(ctx.network.knownContracts);
  const out = ctx.effects.transfers.filter((t) => t.from === ctx.user && t.to !== ctx.user);
  const receives = ctx.effects.transfers.some((t) => t.to === ctx.user && t.from !== ctx.user);
  return receives && out.length > 0 && out.every((t) => listed.has(t.to));
}

/** Loss rule: the largest share of any one balance the request takes. */
function lossRule(ctx: EvmContext): FindingDraft[] {
  const max = ctx.policy.core.maxLossPercent;
  if (max === null || isExchangeWithListed(ctx)) return [];
  const assets = new Set<Address | null>([null]);
  for (const t of ctx.effects.transfers) if (!t.nft) assets.add(t.token);

  let worst = 0;
  for (const asset of assets) {
    const delta = netDelta(ctx, asset);
    const pre = before(ctx, asset);
    if (delta === null || (delta < 0n && (pre === null || pre === 0n))) {
      return [{ code: "LOSS_PERCENT_UNAVAILABLE", values: {}, rule: "core.maxLossPercent" }];
    }
    if (delta >= 0n || pre === null) continue;
    // Basis points of a basis point, so tiny balances still compare exactly.
    const pct = Number((-delta * 1_000_000n) / pre) / 10_000;
    worst = Math.max(worst, pct);
  }
  if (worst <= max) return [];
  return [
    {
      code: "ESTIMATED_LOSS_EXCEEDS_MAX",
      values: { actual: formatPercent(worst), limit: formatPercent(max) },
      rule: "core.maxLossPercent",
    },
  ];
}

/** Floors: every balance the owner wants kept, per asset. */
function floorRules(ctx: EvmContext): FindingDraft[] {
  const out: FindingDraft[] = [];
  for (const floor of ctx.policy.core.minPostBalances) {
    const token = assetAddress(ctx, floor.asset);
    if (token === undefined) continue; // a floor for another chain's asset
    const { symbol, decimals } = tokenMeta(ctx, token);
    const pre = before(ctx, token);
    const delta = netDelta(ctx, token);
    if (pre === null || delta === null) {
      out.push({
        code: "POST_BALANCE_UNAVAILABLE",
        values: { asset: symbol },
        rule: "core.minPostBalances",
      });
      continue;
    }
    const after = pre + delta;
    // A request that does not lower this balance cannot break the floor.
    if (delta >= 0n || after >= BigInt(floor.min)) continue;
    out.push({
      code: "POST_BALANCE_TOO_LOW",
      values: {
        actual: formatAmount(after < 0n ? 0n : after, decimals),
        limit: formatAmount(BigInt(floor.min), decimals),
        asset: symbol,
      },
      rule: "core.minPostBalances",
    });
  }
  return out;
}

const HOUR = 3600;
const DAY = 86_400;

function paymentRules(ctx: EvmContext): FindingDraft[] {
  const payment = ctx.payment;
  if (!payment) return [];
  const x = ctx.policy.core.x402;
  const out: FindingDraft[] = [];

  const origin = new URL(payment.origin).origin;
  if (
    x.allowedMerchantOrigins.length > 0 &&
    !x.allowedMerchantOrigins.some((o) => new URL(o).origin === origin)
  ) {
    out.push({
      code: "X402_MERCHANT_NOT_ALLOWED",
      values: { origin },
      rule: "core.x402.allowedMerchantOrigins",
    });
  }

  const req = payment.requirements;
  const asset = assetAddress(ctx, req.asset);
  if (asset === undefined) return out; // X402_SHAPE_INVALID already says so
  const cap = x.caps.find((c) => assetAddress(ctx, c.asset) === asset);
  if (!cap) return out;
  const { decimals } = tokenMeta(ctx, asset);
  const fmt = (v: bigint) => formatAmount(v, decimals);
  const requested = BigInt(req.amount);
  const paid = actualPayment(ctx);
  // Judge the larger of what was asked and what actually leaves.
  const amount = paid && paid.amount > requested ? paid.amount : requested;

  if (cap.perTx !== null && amount > BigInt(cap.perTx)) {
    out.push({
      code: "X402_PER_TX_CAP_EXCEEDED",
      values: { origin, actual: fmt(amount), cap: fmt(BigInt(cap.perTx)) },
      rule: "core.x402.caps",
    });
  }

  const windows = [
    { limit: cap.perHour, seconds: HOUR, code: "X402_HOURLY_CAP_EXCEEDED" },
    { limit: cap.perDay, seconds: DAY, code: "X402_DAILY_CAP_EXCEEDED" },
  ] as const;
  const set = windows.filter((w) => w.limit !== null);
  if (set.length > 0 && !payment.spendHistory) {
    out.push({ code: "X402_SPEND_HISTORY_UNAVAILABLE", values: {}, rule: "core.x402.caps" });
    return out;
  }
  for (const w of set) {
    const spent = (payment.spendHistory ?? [])
      .filter((s) => assetAddress(ctx, s.asset) === asset)
      .filter((s) => s.timestamp > ctx.now - w.seconds && s.timestamp <= ctx.now)
      .reduce((sum, s) => sum + BigInt(s.amount), 0n);
    const total = spent + amount;
    if (total > BigInt(w.limit as string)) {
      out.push({
        code: w.code,
        values: { amount: fmt(amount), actual: fmt(total), cap: fmt(BigInt(w.limit as string)) },
        rule: "core.x402.caps",
      });
    }
  }
  return out;
}

/** Findings only the owner's limits can produce. */
export function policyFindings(ctx: EvmContext): FindingDraft[] {
  // A request that would revert moves nothing: SIMULATION_FAILED already says so, and
  // "could not measure the loss" on top of it would be noise.
  const reverts = ctx.simulation.ran && !ctx.simulation.ok;
  return [...(reverts ? [] : [...lossRule(ctx), ...floorRules(ctx)]), ...paymentRules(ctx)];
}
