import { claimhub, DEMO, type DemoTx } from "@baret/demo-evm";
import type { Address } from "@baret/demo-evm/wallet";
import type { CheckSource, DemoMode } from "@baret/web-ui/lib/check-types";

import { sampleCheck } from "./sample.js";

/**
 * Where ClaimHub's "Claim 2,410 HUB" goes. The request comes from
 * `@baret/demo`, so the frontend never writes calldata: honest is `claim()`
 * on the distributor Baret knows, attack is "verify your wallet", an
 * unlimited USDC allowance to a reported drainer.
 *
 * Live when there is an address to simulate from (a connected wallet, or
 * VITE_BARET_DEMO_FROM): the request goes to Baret's server and fails
 * closed. With no address, the prepared sample, and nothing is fetched.
 */

export interface ClaimInput {
  readonly mode: DemoMode;
  /** The wallet the eligibility check read. */
  readonly wallet: string;
  /** The address a live check simulates from (it signs the claim); null for the sample. */
  readonly from: Address | null;
}

/** The call each version asks the wallet to sign. */
export function buildRequest(mode: DemoMode, from: Address): DemoTx {
  return mode === "safe" ? claimhub.claim(from) : claimhub.attackApprove(from);
}

/**
 * The calls "Sign with your wallet" sends, in order. Honest: the claim the
 * panel checks. Attack: the allowance the panel checks, then the call that
 * sets it back to zero, so the demo leaves no allowance open to the drainer.
 */
export function signCalls(mode: DemoMode, from: Address): DemoTx[] {
  return mode === "safe"
    ? [claimhub.claim(from)]
    : [claimhub.attackApprove(from), claimhub.revokeApprove(from)];
}

/** HUB, what the honest claim sends: read before and after a signed claim. */
export const HUB = { address: DEMO.claimhub.hub, decimals: 18 } as const;

/** The distributor and the spender a live request names, for the panel's copy. */
export const LIVE_VALUES = {
  contract: DEMO.claimhub.distributor,
  spender: DEMO.drainer,
} as const;

/** The live path loads only when a live check runs, so the sample page never fetches it. */
export const SOURCE: CheckSource<ClaimInput> = async (input, signal) => {
  if (input.from === null) return sampleCheck(input.mode);
  const { analyzeCall } = await import("../kit/live.js");
  return analyzeCall(buildRequest(input.mode, input.from), signal);
};
