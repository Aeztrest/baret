import type { Detector, FindingDraft } from "../analysis/context.js";
import { formatAmount, tokenMeta } from "../analysis/format.js";

/**
 * Allowances, operator access and permits the user grants, and a signed
 * message whose grant Baret cannot read. For an unlimited
 * allowance, {amount} is what this same request actually spends of the token,
 * the amount a bounded approval would need; empty when nothing is spent.
 */
export const approvals: Detector = (ctx) => {
  const out: FindingDraft[] = [];
  // A signed message. The values stay empty on purpose: the message's own
  // names are text the site chose.
  const signature = ctx.effects.signature;
  if (signature) {
    const unread = signature.kind === "unread";
    if (signature.wrongChain || (unread && signature.valueBearing)) {
      // Cannot be read and may move value, or is meant for another chain,
      // where the same account exists: stopped under every policy.
      out.push({
        code: "SIGNATURE_NOT_UNDERSTOOD",
        values: {},
        details: { reason: signature.wrongChain ? "chain" : signature.reason },
      });
    } else if (unread) {
      // Cannot be read, and nothing in it points at funds: said, not stopped.
      out.push({ code: "SIGNATURE_UNRECOGNISED", values: {} });
    }
  }
  // A marketplace order: it can be filled any time until it ends, so it is
  // always said; one that pays the signer nothing is a gift to whoever fills it.
  const order = ctx.effects.order;
  if (order) {
    const count = String(order.gives);
    out.push({ code: "SIGNED_ORDER_DETECTED", values: { count } });
    if (!order.paid) out.push({ code: "ORDER_PAYS_NOTHING", values: { count } });
  }
  for (const a of ctx.effects.approvals) {
    const meta = tokenMeta(ctx, a.contract);
    if (a.kind === "operator") {
      out.push({
        code: "NFT_OPERATOR_GRANTED",
        values: { operator: a.spender, contract: a.contract },
      });
      continue;
    }
    const amount = a.amount ?? 0n;
    if (a.kind === "permit") {
      out.push({
        code: "PERMIT_SIGNATURE_DETECTED",
        values: {
          spender: a.spender,
          amount: a.unlimited ? "unlimited" : formatAmount(amount, meta.decimals),
          asset: meta.symbol,
        },
        details: { contract: a.contract, unlimited: a.unlimited },
      });
    }
    if (a.unlimited) {
      const spent = ctx.effects.transfers
        .filter((t) => t.token === a.contract && t.from === ctx.user && !t.nft)
        .reduce((sum, t) => sum + t.amount, 0n);
      out.push({
        code: "APPROVAL_UNLIMITED",
        values: {
          spender: a.spender,
          asset: meta.symbol,
          amount: spent > 0n ? formatAmount(spent, meta.decimals) : "",
        },
        details: { contract: a.contract, standard: "erc20", neededAmountKnown: spent > 0n },
      });
    } else if (a.kind === "erc20") {
      out.push({
        code: "APPROVAL_GRANTED",
        values: {
          spender: a.spender,
          amount: formatAmount(amount, meta.decimals),
          asset: meta.symbol,
        },
        details: { contract: a.contract, standard: "erc20" },
      });
    }
  }
  out.push(...grantsToWallets(ctx));
  return out;
};

/**
 * An allowance, operator access, permit or single-item approval granted to an
 * address with no code: a wallet. Apps take allowances through contracts; a
 * wallet that may spend the user's tokens is how ice phishing works, and the
 * thief pulls the funds later, in a transaction of their own. An address
 * whose code was not read is not judged here.
 */
function grantsToWallets(ctx: Parameters<Detector>[0]): FindingDraft[] {
  const codeless = new Set(ctx.codeless);
  const grants = [
    ...ctx.effects.approvals.map((a) => ({ spender: a.spender, contract: a.contract })),
    ...(ctx.effects.itemApprovals ?? []),
  ];
  const seen = new Set<string>();
  const out: FindingDraft[] = [];
  for (const g of grants) {
    const key = `${g.contract}:${g.spender}`;
    if (!codeless.has(g.spender) || g.spender === ctx.user || seen.has(key)) continue;
    seen.add(key);
    out.push({
      code: "APPROVAL_TO_WALLET",
      values: { spender: g.spender, contract: g.contract },
    });
  }
  return out;
}
