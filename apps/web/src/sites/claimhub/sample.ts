import type { CheckResult, DemoMode } from "@baret/web-ui/lib/check-types";
import { SITE_ART } from "../../shared/assets.js";

/**
 * ClaimHub's prepared sample. The distributor, the spender and the wallet
 * are sample addresses; the allocation matches the page (2,410 HUB).
 */

export const SAMPLE = {
  wallet: "0x7a3f9e21c84b5d06f13a2e9b7c40d58e6f21c21e",
  /** The ClaimHub distributor Baret knows. */
  distributor: "0x4e7b0d3a6c9f2e5b8d1a4c7f0e3b6d9a2c5f8e13",
  /** Who the attack version's allowance goes to: on the blocklist. */
  spender: "0xa61f3c8e5b2d9f4a7c0e1b6d3f8a5c2e9b4d7f30",
  /** HUB per claim, as the page says. */
  allocation: "2,410",
} as const;

/** The three ClaimHub pictures (paths live in shared/assets.ts). */
export const ART = SITE_ART.claimhub;

/** A 0x address of 40 hex digits. */
export function isWallet(text: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(text);
}

/**
 * Which wallet the eligibility check reads: the address typed in, or the
 * connected one when the field is left empty; null when the text is not an
 * address. Every wallet comes back eligible: the check is the page's own
 * theatre, which is the scenario.
 */
export function walletFor(text: string, connected: string): string | null {
  const value = text.trim();
  if (value === "") return connected;
  return isWallet(value) ? value : null;
}

/**
 * The sample answer. Honest: Safe, the HUB arrives and nothing leaves but
 * the network fee. Attack: no HUB, an unlimited USDC allowance to a listed
 * spender: Blocked twice, and the allowance is the harm.
 */
export function sampleCheck(mode: DemoMode): CheckResult {
  if (mode === "safe") {
    return {
      source: "sample",
      verdict: "safe",
      findings: [],
      changes: [{ direction: "in", value: SAMPLE.allocation, unit: "HUB" }],
      approvals: [],
    };
  }
  return {
    source: "sample",
    verdict: "blocked",
    findings: [
      {
        code: "APPROVAL_UNLIMITED",
        // The approval spends nothing itself, so there is no amount and the
        // panel leaves out the "approve only" line.
        values: { spender: SAMPLE.spender, asset: "USDC", amount: "" },
      },
      { code: "KNOWN_MALICIOUS_ADDRESS", values: { address: SAMPLE.spender } },
    ],
    changes: [],
    approvals: [{ unit: "USDC", spender: SAMPLE.spender, unlimited: true, amount: null }],
  };
}
