import { type DemoTx, NOVASWAP, novaswap } from "@baret/demo-evm";
import type { Address } from "@baret/demo-evm/wallet";
import type { CheckSource, DemoMode } from "@baret/web-ui/lib/check-types";
import { sampleCheck } from "./sample.js";

/**
 * Where NovaSwap's "Review swap" goes, and what "Sign with your wallet"
 * sends. The one place that knows the requests and the source of the answer.
 *
 * The requests come from `@baret/demo`, so the frontend never writes
 * calldata: honest is `swapMonForUsdc` on the router, attack is the
 * "enable trading" approval, `approve(look-alike, unlimited)` on dUSDC.
 * The same builders feed the panel's check and the wallet's signature, so
 * what Baret checks is what the wallet signs.
 *
 * Live when there is an address to simulate from (a connected wallet, or
 * VITE_BARET_DEMO_FROM): the request goes to Baret's server and fails
 * closed. With no address, the prepared sample, and nothing is fetched.
 */

export interface SwapInput {
  readonly mode: DemoMode;
  /** What the visitor typed, already validated: MON when honest, dUSDC in the attack. */
  readonly amount: string;
  /** The honest swap's MON in wei: a live request sends this. */
  readonly wei: bigint;
  /** The address a live check simulates from; null for the sample. */
  readonly from: Address | null;
}

/** The call each version asks the wallet to sign. */
export function buildRequest(mode: DemoMode, wei: bigint, from: Address): DemoTx {
  return mode === "safe" ? novaswap.swapMonForUsdc(from, wei) : novaswap.attackApprove(from);
}

/**
 * The calls "Sign with your wallet" sends, in order. Honest: the swap the
 * panel checks. Attack: the "enable trading" approval the panel checks, then
 * the "swap" on the look-alike that spends it (it takes the whole balance).
 */
export function signCalls(mode: DemoMode, wei: bigint, units: bigint, from: Address): DemoTx[] {
  if (mode === "safe") return [buildRequest("safe", wei, from)];
  return [buildRequest("danger", wei, from), novaswap.attackSwap(from, units)];
}

/** 100 test dUSDC to the visitor, before the attack. */
export function faucetCall(from: Address): DemoTx {
  return novaswap.faucet(from);
}

/** The contract each version's request touches, for "What the site asks for". */
export function contractOf(mode: DemoMode): Address {
  return mode === "safe" ? NOVASWAP.router : NOVASWAP.lookalike;
}

/** The live path loads only when a live check runs, so the sample page never fetches it. */
export const SOURCE: CheckSource<SwapInput> = async (input, signal) => {
  if (input.from === null) return sampleCheck(input.mode, Number(input.amount.replace(",", ".")));
  const { analyzeCall } = await import("../kit/live.js");
  return analyzeCall(buildRequest(input.mode, input.wei, input.from), signal);
};
