import { DEMO, type DemoTx, launchpad } from "@baret/demo-evm";
import type { Address } from "@baret/demo-evm/wallet";
import type { CheckSource, DemoMode } from "@baret/web-ui/lib/check-types";

import { sampleCheck } from "./sample.js";

/**
 * Where LaunchPad's "Contribute" goes. The request comes from `@baret/demo`,
 * so the frontend never writes calldata: honest is `contribute()` on the
 * plain sale, attack is the same call on the proxy sale whose code its
 * deployer can replace.
 *
 * Live when there is an address to simulate from (a connected wallet, or
 * VITE_BARET_DEMO_FROM): the request goes to Baret's server and fails
 * closed. With no address, the prepared sample, and nothing is fetched.
 */

export interface ContributeInput {
  readonly mode: DemoMode;
  /** MON, already checked against the sale's limits: the sample reads this. */
  readonly amount: number;
  /** The same amount in wei: a live request sends this. */
  readonly wei: bigint;
  /** The address a live check simulates from; null for the sample. */
  readonly from: Address | null;
}

/** The call each version asks the wallet to sign. */
export function buildRequest(mode: DemoMode, wei: bigint, from: Address): DemoTx {
  return mode === "safe" ? launchpad.contribute(from, wei) : launchpad.attackContribute(from, wei);
}

/** The call "Sign with your wallet" sends: the one the panel checks. */
export function signCalls(mode: DemoMode, wei: bigint, from: Address): DemoTx[] {
  return [
    mode === "safe" ? launchpad.contribute(from, wei) : launchpad.attackContribute(from, wei),
  ];
}

/** LNTL, what a sale pays: read before and after a signed contribution. */
export const SALE_TOKEN = { address: DEMO.launchpad.token, decimals: 18 } as const;

/** The sale a live request pays, for the panel's copy. */
export function liveSaleOf(mode: DemoMode): string {
  return mode === "safe" ? DEMO.launchpad.sale : DEMO.launchpad.proxySale;
}

/** The live path loads only when a live check runs, so the sample page never fetches it. */
export const SOURCE: CheckSource<ContributeInput> = async (input, signal) => {
  if (input.from === null) return sampleCheck(input.mode, input.amount);
  const { analyzeCall } = await import("../kit/live.js");
  return analyzeCall(buildRequest(input.mode, input.wei, input.from), signal);
};
