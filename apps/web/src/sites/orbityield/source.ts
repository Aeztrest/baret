import { DEMO, type DemoTx, orbityield } from "@baret/demo-evm";
import type { Address } from "@baret/demo-evm/wallet";
import type { CheckSource, DemoMode } from "@baret/web-ui/lib/check-types";
import { LOSS_LIMIT } from "../kit/amount.js";

import { sampleCheck } from "./sample.js";

/**
 * Where OrbitYield's "Stake" goes. The request comes from `@baret/demo`, so
 * the frontend never writes calldata: honest is `stake()` on the pool Baret
 * knows (oMON back one to one), attack is the same call on a pool on no list
 * that keeps the MON.
 *
 * Live when there is an address to simulate from (a connected wallet, or
 * VITE_BARET_DEMO_FROM): the request goes to Baret's server and fails
 * closed. With no address, the prepared sample, and nothing is fetched.
 */

export interface StakeInput {
  readonly mode: DemoMode;
  /** MON, already checked against the balance: the sample reads this. */
  readonly amount: number;
  /** The same amount in wei: a live request sends this. */
  readonly wei: bigint;
  /** The address a live check simulates from; null for the sample. */
  readonly from: Address | null;
}

/** The call each version asks the wallet to sign. */
export function buildRequest(mode: DemoMode, wei: bigint, from: Address): DemoTx {
  return mode === "safe" ? orbityield.stake(from, wei) : orbityield.attackStake(from, wei);
}

/** The call "Sign with your wallet" sends: the one the panel checks. */
export function signCalls(mode: DemoMode, wei: bigint, from: Address): DemoTx[] {
  return [mode === "safe" ? orbityield.stake(from, wei) : orbityield.attackStake(from, wei)];
}

/** oMON, the receipt the honest pool pays: read before and after a signed stake. */
export const RECEIPT = { address: DEMO.orbityield.receipt, decimals: 18 } as const;

/** The pool a live request pays, for the panel's copy. */
export function livePoolOf(mode: DemoMode): string {
  return mode === "safe" ? DEMO.orbityield.pool : DEMO.orbityield.silentPool;
}

/**
 * Live: true when the attack's deposit is more of the wallet's real balance
 * than Balanced lets go with nothing back. Unknown balance: false.
 */
export function overLimitLive(mode: DemoMode, wei: bigint, balance: bigint | null): boolean {
  return mode === "danger" && balance !== null && balance > 0n
    ? wei * 100n > balance * BigInt(Math.round(LOSS_LIMIT))
    : false;
}

/** The live path loads only when a live check runs, so the sample page never fetches it. */
export const SOURCE: CheckSource<StakeInput> = async (input, signal) => {
  if (input.from === null) return sampleCheck(input.mode, input.amount);
  const { analyzeCall } = await import("../kit/live.js");
  return analyzeCall(buildRequest(input.mode, input.wei, input.from), signal);
};
