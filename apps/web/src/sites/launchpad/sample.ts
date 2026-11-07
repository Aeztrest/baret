import type { CheckResult, DemoMode } from "@baret/web-ui/lib/check-types";
import { SITE_ART } from "../../shared/assets.js";
import { format } from "../kit/amount.js";

/**
 * LaunchPad's prepared sample. The two sale contracts and the wallet are
 * sample addresses; the price and the limits match the page (0.001 MON per
 * LNTL, 0.01 to 1 MON per wallet).
 */

export const SAMPLE = {
  wallet: "0x7a3f9e21c84b5d06f13a2e9b7c40d58e6f21c21e",
  /** The plain sale contract with fixed code. */
  sale: "0x6a9d2f5c8b1e4a7d0f3c6b9e2a5d8f1c4b7e0a35",
  /** The attack's sale: a proxy whose code its deployer can replace. */
  proxy: "0xc3e6a9d2f5b8e1c4a7d0f3b6e9c2a5d8f1b4e7a0",
  /** LNTL per MON. */
  rate: 1000,
  min: 0.01,
  max: 1,
} as const;

/** The three LaunchPad pictures (paths live in shared/assets.ts). */
export const ART = SITE_ART.launchpad;

/** How much of the sale is raised, from the page's own figure (8,420 of 10,000 MON). */
export const RAISED = 8420 / 10_000;

/** The LNTL a contribution buys, grouped: 0.5 -> "500", 1 -> "1,000". */
export function tokensFor(mon: number): string {
  return Math.round(mon * SAMPLE.rate).toLocaleString("en-US");
}

/** Which limit an amount breaks, if any. */
export function limitOf(mon: number): "tooLow" | "tooHigh" | null {
  if (mon < SAMPLE.min) return "tooLow";
  if (mon > SAMPLE.max) return "tooHigh";
  return null;
}

/** The sale each version's button really pays. */
export function saleOf(mode: DemoMode): string {
  return mode === "safe" ? SAMPLE.sale : SAMPLE.proxy;
}

/**
 * The sample answer. Both versions: MON out, LNTL in. Honest: Safe. Attack:
 * the sale runs borrowed code from a contract Baret does not know, Blocked
 * under Balanced. The most a wallet can put in is 1 MON, a twenty-fifth of
 * the sample balance, so the loss limit never comes into it here.
 */
export function sampleCheck(mode: DemoMode, mon: number): CheckResult {
  const changes = [
    { direction: "out", value: format(mon), unit: "MON" },
    { direction: "in", value: tokensFor(mon), unit: "LNTL" },
  ] as const;
  if (mode === "safe") {
    return { source: "sample", verdict: "safe", findings: [], changes, approvals: [] };
  }
  return {
    source: "sample",
    verdict: "blocked",
    findings: [
      { code: "DELEGATECALL_DETECTED", values: { contract: SAMPLE.proxy } },
      { code: "UNKNOWN_CONTRACT_EXPOSURE", values: { contract: SAMPLE.proxy } },
    ],
    changes,
    approvals: [],
  };
}
