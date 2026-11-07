import { type Address, getAddress, isAddress } from "viem";
import type { Detector, EvmContext, FindingDraft } from "../analysis/context.js";
import type { TransferEffect } from "../analysis/effects.js";
import { assetAddress, tokenMeta } from "../analysis/format.js";

/** The value the request actually sends: the first fungible transfer out of the user's account. */
export function actualPayment(ctx: EvmContext): TransferEffect | null {
  return (
    ctx.effects.transfers.find((t) => t.from === ctx.user && !t.nft && t.to !== ctx.user) ?? null
  );
}

function label(ctx: EvmContext, token: Address | null, other: Address | null): string {
  const mine = tokenMeta(ctx, token).symbol;
  // Two tokens with one name: the address is the only honest label.
  if (other !== token && tokenMeta(ctx, other).symbol === mine) {
    return token ?? ctx.network.chain.nativeAsset.symbol;
  }
  return mine;
}

/**
 * Compares the payment with what the merchant's 402 answer asked for, and the asset with
 * the user's allowed list (by contract address, not by name). Ported from Metropolis;
 * v2 adds the network check and reads assets as CAIP-19 ids.
 */
export const x402: Detector = (ctx) => {
  const payment = ctx.payment;
  if (!payment) return [];
  const out: FindingDraft[] = [];
  const req = payment.requirements;
  const p = ctx.policy.core.x402;

  if (req.network !== ctx.network.chain.id) {
    out.push({
      code: "X402_NETWORK_MISMATCH",
      values: { expected: req.network, actual: ctx.network.chain.id },
    });
  }
  const expectedAsset = assetAddress(ctx, req.asset);
  const expectedPayTo = isAddress(req.payTo, { strict: false }) ? getAddress(req.payTo) : null;
  if (expectedAsset === undefined || expectedPayTo === null) {
    // The 402 answer names an asset or payee this chain cannot have: nothing to check against.
    out.push({ code: "X402_SHAPE_INVALID", values: {}, details: { asset: req.asset } });
    return out;
  }
  const paid = actualPayment(ctx);

  if (!paid || paid.to !== expectedPayTo) {
    out.push({
      code: "X402_DESTINATION_MISMATCH",
      values: { expected: expectedPayTo, actual: paid?.to ?? ctx.tx?.to ?? "no recipient" },
    });
  }
  if (paid && paid.token !== expectedAsset) {
    out.push({
      code: "X402_ASSET_MISMATCH",
      values: {
        expected: label(ctx, expectedAsset, paid.token),
        actual: label(ctx, paid.token, expectedAsset),
      },
      details: { expectedAsset, actualAsset: paid.token },
    });
  }
  // Only an overpayment is the payer's risk; paying less is the merchant's problem. New in
  // v2 (from the Stellar and Casper repos); Metropolis caught overpayments only through caps.
  if (paid && paid.token === expectedAsset && paid.amount > BigInt(req.amount)) {
    out.push({
      code: "X402_AMOUNT_MISMATCH",
      values: { expected: req.amount, actual: paid.amount.toString() },
    });
  }

  const asset = paid ? paid.token : expectedAsset;
  const allowed = p.allowedAssets
    .map((id) => assetAddress(ctx, id))
    .filter((a): a is Address | null => a !== undefined);
  if (!allowed.includes(asset)) {
    const symbol = tokenMeta(ctx, asset).symbol;
    const lookalike =
      asset !== null && allowed.some((a) => a !== null && tokenMeta(ctx, a).symbol === symbol);
    out.push(
      lookalike
        ? {
            code: "X402_NON_CANONICAL_ASSET",
            values: { asset: symbol, contract: asset },
            rule: "core.x402.allowedAssets",
          }
        : {
            code: "X402_ASSET_NOT_ALLOWED",
            values: { asset: symbol },
            rule: "core.x402.allowedAssets",
          },
    );
  }

  if (p.requireMemo && !req.memo?.trim()) {
    out.push({ code: "X402_MEMO_MISSING", values: {}, rule: "core.x402.requireMemo" });
  }
  return out;
};
