import type { CheckFinding, CheckResult, DemoMode } from "@baret/web-ui/lib/check-types";
import { SITE_ART } from "../../shared/assets.js";
import { format, LOSS_LIMIT, lossPercent, percent } from "../kit/amount.js";

/**
 * OrbitYield's prepared sample. The two pools and the wallet are sample
 * addresses; the wallet holds 25 MON, like NovaSwap's.
 */

export const SAMPLE = {
  wallet: "0x7a3f9e21c84b5d06f13a2e9b7c40d58e6f21c21e",
  /** The OrbitYield pool Baret knows: oMON back one to one. */
  pool: "0x2d6f0a4c8e1b3d5f7a9c0e2b4d6f8a1c3e5b7d92",
  /** The second pool, on no list: it keeps the MON and sends nothing. */
  other: "0x8f3a6c9e1b4d7f0a2c5e8b1d4f7a0c3e6b9d2f57",
  /** The sample wallet's MON. */
  mon: 25,
} as const;

/** The three OrbitYield pictures (paths live in shared/assets.ts). */
export const ART = SITE_ART.orbityield;

/** The pool each version's button really calls. */
export function poolOf(mode: DemoMode): string {
  return mode === "safe" ? SAMPLE.pool : SAMPLE.other;
}

/**
 * True when the attack's deposit costs more of the balance than Balanced
 * allows. Nothing comes back from the second pool, so the whole deposit
 * counts as the loss.
 */
export function overLimit(mode: DemoMode, amount: number): boolean {
  return mode === "danger" && lossPercent(amount, SAMPLE.mon) > LOSS_LIMIT;
}

/**
 * The sample answer. Honest: Safe, MON out and oMON in, one to one. Attack:
 * MON out and nothing in, kept by a pool Baret does not know: Blocked under
 * Balanced at any size, with the loss finding on top once the deposit is
 * above the loss limit.
 */
export function sampleCheck(mode: DemoMode, amount: number): CheckResult {
  if (mode === "safe") {
    return {
      source: "sample",
      verdict: "safe",
      findings: [],
      changes: [
        { direction: "out", value: format(amount), unit: "MON" },
        { direction: "in", value: format(amount), unit: "oMON" },
      ],
      approvals: [],
    };
  }
  const findings: CheckFinding[] = [
    { code: "UNKNOWN_CONTRACT_EXPOSURE", values: { contract: SAMPLE.other } },
    {
      code: "VALUE_KEPT_BY_UNKNOWN_CONTRACT",
      values: { contract: SAMPLE.other, amount: format(amount), asset: "MON" },
    },
  ];
  if (overLimit(mode, amount)) {
    findings.push({
      code: "ESTIMATED_LOSS_EXCEEDS_MAX",
      values: { actual: percent(lossPercent(amount, SAMPLE.mon)), limit: percent(LOSS_LIMIT) },
    });
  }
  return {
    source: "sample",
    verdict: "blocked",
    findings,
    changes: [{ direction: "out", value: format(amount), unit: "MON" }],
    approvals: [],
  };
}
