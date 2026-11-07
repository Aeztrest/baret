import type { CheckResult, DemoMode } from "@baret/web-ui/lib/check-types";
import { SITE_ART } from "../../shared/assets.js";

/**
 * Scrybe's prepared sample. Live, the price and the merchant come from the
 * 402 reply; here they are fixed sample values, and so is the wallet.
 *
 * Amounts are kept in base units (USDC has 6 decimals), so a running total
 * never picks up a floating-point cent.
 */

export const SAMPLE = {
  wallet: "0x7a3f9e21c84b5d06f13a2e9b7c40d58e6f21c21e",
  /** Who the 402 reply says to pay. */
  merchant: "0x5c7e0b3a91d24f68e0a7c3b5d9f1e2a4c6b8d0f2",
  /** The price per answer: 0.05 USDC. */
  price: 50_000n,
} as const;

/**
 * The hourly caps the visitor can pick for the agent loop. Balanced allows
 * 25 USDC an hour, which takes 500 answers to fill; a low cap shows the stop
 * after a few payments, which is what the page asks the visitor to set.
 */
export const CAPS = [150_000n, 250_000n, 500_000n] as const;
export type Cap = (typeof CAPS)[number];
export const START_CAP: Cap = 250_000n;

/** The three Scrybe pictures (paths live in shared/assets.ts). */
export const ART = SITE_ART.scrybe;

/** Base units to "0.05": two decimals, always. */
export function usdc(units: bigint): string {
  const cents = units / 10_000n;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

/** One payment of the agent loop: its number, the hour's total with it, and whether it went out. */
export interface Payment {
  readonly n: number;
  readonly total: bigint;
  readonly paid: boolean;
}

/**
 * The agent's run under a cap: every payment that fits is paid; the first
 * that would take the hour over the cap is stopped, and the run ends there.
 */
export function runOf(cap: bigint, price: bigint = SAMPLE.price): readonly Payment[] {
  const run: Payment[] = [];
  let total = 0n;
  while (total + price <= cap) {
    total += price;
    run.push({ n: run.length + 1, total, paid: true });
  }
  run.push({ n: run.length + 1, total: total + price, paid: false });
  return run;
}

/**
 * The sample answer. One answer: Safe, 0.05 USDC out. The loop: the payment
 * that would cross the cap is Blocked by the hourly cap, with what the hour
 * would come to; nothing of it is signed, so nothing changes.
 */
export function sampleCheck(mode: DemoMode, cap: bigint): CheckResult {
  if (mode === "safe") {
    return {
      source: "sample",
      verdict: "safe",
      findings: [],
      changes: [{ direction: "out", value: usdc(SAMPLE.price), unit: "USDC" }],
      approvals: [],
    };
  }
  const stopped = runOf(cap).at(-1);
  return {
    source: "sample",
    verdict: "blocked",
    findings: [
      {
        code: "X402_HOURLY_CAP_EXCEEDED",
        // The v2 sentence names the asset itself ({asset}), so the amounts go in bare.
        values: {
          amount: usdc(SAMPLE.price),
          actual: usdc(stopped?.total ?? 0n),
          cap: usdc(cap),
          asset: "USDC",
        },
      },
    ],
    changes: [],
    approvals: [],
  };
}
