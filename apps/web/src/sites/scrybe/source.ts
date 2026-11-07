import { type DemoRules, hourlyCap, SCRYBE, scrybe } from "@baret/demo-evm";
import type { Address } from "@baret/demo-evm/wallet";
import type { CheckSource, DemoMode } from "@baret/web-ui/lib/check-types";
import { sampleCheck } from "./sample.js";

/**
 * Where Scrybe's "Pay and ask" and "Start the agent" go. The payment comes
 * from `@baret/demo`, so the frontend never writes one: an x402 payment is
 * an EIP-3009 TransferWithAuthorization message on the real test USDC, sent
 * to Baret as `typedData` with the 402's terms as `payment`.
 *
 * Live when there is an address to pay from (a connected wallet, or
 * VITE_BARET_DEMO_FROM): the request goes to Baret's server and fails
 * closed. With no address, the prepared sample, and nothing is fetched.
 */

export interface AskInput {
  readonly mode: DemoMode;
  /** The hourly cap the visitor picked for the agent loop, in base units. */
  readonly cap: bigint;
  /** The address a live check pays from; null for the sample. */
  readonly from: Address | null;
}

/**
 * Answers already paid this hour before the one Baret checks. One answer:
 * none. The agent loop: every answer that fits under the cap, so the one
 * checked is the payment that would take the hour over it.
 */
export function paidBefore(mode: DemoMode, cap: bigint): number {
  return mode === "safe" ? 0 : Number(cap / SCRYBE.price);
}

/** Balanced, with the real test USDC as the payment asset and the visitor's cap as the hourly cap. */
export function policyFor(cap: bigint): DemoRules {
  return hourlyCap(cap);
}

/** The wallet a live payment goes to, for the panel's copy. */
export const LIVE_VALUES = { merchant: SCRYBE.payTo } as const;

/** The live path loads only when a live check runs, so the sample page never fetches it. */
export const SOURCE: CheckSource<AskInput> = async (input, signal) => {
  if (input.from === null) return sampleCheck(input.mode, input.cap);
  const { analyzePayment } = await import("../kit/live.js");
  return analyzePayment(
    scrybe.pay(input.from, paidBefore(input.mode, input.cap)),
    policyFor(input.cap),
    signal,
  );
};
