import { type Address, getAddress, isAddress } from "viem";
import type { Detector, EvmContext, FindingDraft } from "../analysis/context.js";

/**
 * Contracts every EVM chain shares at the same address (deterministic deployments). A copy of one of
 * these is how a fake allowance manager or batcher is passed off.
 */
export const CANONICAL_CONTRACTS: readonly Address[] = [
  "0x000000000022D473030F116dDEE9F6B43aC78BA3", // Permit2
  "0xcA11bde05977b3631167028862bE2a173976CA11", // Multicall3
];

/** Hex characters that must match at each end, and in total, to count as a copy. */
const MIN_END = 3;
const MIN_TOTAL = 7;

/**
 * Whether two different addresses share their opening and closing hex
 * characters: the part a wallet shows (`0xEB9E...1888`). Address poisoning and
 * CREATE2 lookalikes grind exactly these. Seven matching characters happen by
 * chance about once in 268 million pairs.
 */
export function looksAlike(a: Address, b: Address): boolean {
  const x = a.slice(2).toLowerCase();
  const y = b.slice(2).toLowerCase();
  if (x === y) return false;
  let head = 0;
  while (head < 40 && x[head] === y[head]) head++;
  let tail = 0;
  while (tail < 40 && x[39 - tail] === y[39 - tail]) tail++;
  return head >= MIN_END && tail >= MIN_END && head + tail >= MIN_TOTAL;
}

/**
 * An address in the request that copies the look of another address: a
 * contract Baret vouches for, the user's own account, the payee of the
 * payment, or another address the same request names. Reported on the copy,
 * never on a listed contract. A wallet shows the first and last characters,
 * so the user cannot tell the two apart; Baret compares every character.
 */
export const lookalike: Detector = (ctx) => {
  const known = trusted(ctx);
  const named = requestAddresses(ctx);
  const references = [...new Set<Address>([...known, ctx.user, ...named])];
  const out: FindingDraft[] = [];
  const reported = new Set<string>();
  for (const suspect of named) {
    if (known.has(suspect) || suspect === ctx.user) continue;
    for (const expected of references) {
      if (!looksAlike(suspect, expected)) continue;
      // Two unknown addresses that copy each other: one finding for the pair.
      const pair = [suspect, expected].sort().join();
      if (reported.has(pair)) continue;
      reported.add(pair);
      out.push({
        code: "LOOKALIKE_ADDRESS",
        values: { address: suspect, expected },
        details: {
          imitates: known.has(expected)
            ? "known"
            : expected === ctx.user
              ? "self"
              : expected === payee(ctx)
                ? "payee"
                : "request",
        },
      });
    }
  }
  return out;
};

const payee = (ctx: EvmContext): Address | null => {
  const payTo = ctx.payment?.requirements.payTo;
  return payTo && isAddress(payTo, { strict: false }) ? getAddress(payTo) : null;
};

/** Addresses Baret vouches for on this network. */
function trusted(ctx: EvmContext): Set<Address> {
  const out = new Set<Address>([...ctx.network.knownContracts, ...CANONICAL_CONTRACTS]);
  if (ctx.network.usdcAddress) out.add(ctx.network.usdcAddress);
  return out;
}

/** Every address the request sends something to, grants something to or calls. */
function requestAddresses(ctx: EvmContext): Address[] {
  const e = ctx.effects;
  const list: (Address | null | undefined)[] = [
    ctx.tx?.to,
    ...ctx.counterparties,
    ...ctx.contracts,
    ...e.approvals.map((a) => a.contract),
    ...(e.itemApprovals ?? []).map((a) => a.contract),
    ...e.transfers.map((t) => t.token),
    e.signature?.verifier,
    payee(ctx),
  ];
  return [...new Set(list.filter((a): a is Address => Boolean(a)))];
}
