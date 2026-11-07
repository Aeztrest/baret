import { DEMO, type DemoTx, pixeldrop } from "@baret/demo-evm";
import type { Address } from "@baret/demo-evm/wallet";
import type { CheckSource, DemoMode } from "@baret/web-ui/lib/check-types";

import { sampleCheck } from "./sample.js";

/**
 * Where PixelDrop's "Mint" goes. The request comes from `@baret/demo`, so
 * the frontend never writes calldata: honest is `mint(count)` on the Night
 * Shift collection, attack is `setApprovalForAll(drainer, true)` on the
 * same collection.
 *
 * Live when there is an address to simulate from (a connected wallet, or
 * VITE_BARET_DEMO_FROM): the request goes to Baret's server and fails
 * closed. With no address, the prepared sample, and nothing is fetched.
 */

export interface MintInput {
  readonly mode: DemoMode;
  /** How many pieces, already checked against the per-wallet limit. */
  readonly count: number;
  /** The address a live check simulates from; null for the sample. */
  readonly from: Address | null;
}

/** The call each version asks the wallet to sign. */
export function buildRequest(mode: DemoMode, count: number, from: Address): DemoTx {
  return mode === "safe" ? pixeldrop.mint(from, count) : pixeldrop.attackApproveAll(from);
}

/**
 * The calls "Sign with your wallet" sends, in order. Honest: the mint the
 * panel checks. Attack: the approval the panel checks, then the call that
 * takes it back, so the demo leaves nothing open to the reported operator.
 */
export function signCalls(mode: DemoMode, count: number, from: Address): DemoTx[] {
  return mode === "safe"
    ? [pixeldrop.mint(from, count)]
    : [pixeldrop.attackApproveAll(from), pixeldrop.revokeApproveAll(from)];
}

/** What a request costs in MON, in wei: the mint price, nothing for the approval. */
export function costOf(mode: DemoMode, count: number): bigint {
  return mode === "safe" ? BigInt(count) * DEMO.pixeldrop.priceWei : 0n;
}

/** The collection and the operator a live request names, for the panel's copy. */
export const LIVE_VALUES = {
  contract: DEMO.pixeldrop.collection,
  operator: DEMO.drainer,
} as const;

/** The live path loads only when a live check runs, so the sample page never fetches it. */
export const SOURCE: CheckSource<MintInput> = async (input, signal) => {
  if (input.from === null) return sampleCheck(input.mode, input.count);
  const { analyzeCall } = await import("../kit/live.js");
  return analyzeCall(buildRequest(input.mode, input.count, input.from), signal);
};
