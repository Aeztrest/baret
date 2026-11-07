import { NOVASWAP } from "@baret/demo-evm";
import type { CheckResult, DemoMode } from "@baret/web-ui/lib/check-types";
import { SITE_ART } from "../../shared/assets.js";

/**
 * NovaSwap's prepared sample, used until a wallet is connected. The
 * contract addresses are the real testnet ones from `@baret/demo`; the
 * wallet and its balances are sample data. The sample answers match what
 * Baret returns live for the same requests (tasks/FOR_MERIC.md, 2026-10-03).
 */

export const SAMPLE = {
  wallet: "0x7a3f9e21c84b5d06f13a2e9b7c40d58e6f21c21e",
  /** The sample wallet's MON balance. */
  mon: 25,
  /** The sample wallet's dUSDC balance: one faucet call. */
  usdc: 100,
} as const;

/** The three NovaSwap pictures (paths live in shared/assets.ts). */
export const ART = SITE_ART.novaswap;

/** Digits with at most one decimal mark and 18 decimals: what parseEther takes. */
const DECIMAL = /^(\d+([.,]\d{0,18})?|[.,]\d{1,18})$/;

/** "12.5" -> 12.5; anything that is not a positive decimal ("1e3", "0x5") -> null. */
export function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!DECIMAL.test(text)) return null;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Two decimals, no grouping: what the swap card and the panel print. */
export function format(value: number): string {
  return value.toFixed(2);
}

/** dUSDC for a MON amount at the router's fixed rate, to the cent. */
export function quote(mon: number): number {
  return Math.round(mon * NOVASWAP.rate * 100) / 100;
}

/** MON for a dUSDC amount at the same rate, to the cent. */
export function quoteBack(usdc: number): number {
  return Math.round((usdc / NOVASWAP.rate) * 100) / 100;
}

/** What the card spends in each version: MON when honest, dUSDC in the attack. */
export function balanceOf(mode: DemoMode): number {
  return mode === "safe" ? SAMPLE.mon : SAMPLE.usdc;
}

/**
 * The sample result for one version. Honest: Safe, MON out and dUSDC in.
 * Attack: the "enable trading" approval, Blocked by the unlimited allowance,
 * by the reported spender and by the spender copying the router's address;
 * nothing moves yet, the allowance is the harm.
 */
export function sampleCheck(mode: DemoMode, amount: number): CheckResult {
  if (mode === "safe") {
    return {
      source: "sample",
      verdict: "safe",
      findings: [],
      changes: [
        { direction: "out", value: format(amount), unit: "MON" },
        { direction: "in", value: format(quote(amount)), unit: "dUSDC" },
      ],
      approvals: [],
    };
  }
  return {
    source: "sample",
    verdict: "blocked",
    findings: [
      {
        code: "APPROVAL_UNLIMITED",
        // The approval spends nothing itself, so the server sends no amount
        // and the panel leaves out the "approve only" line.
        values: { spender: NOVASWAP.lookalike, asset: "dUSDC", amount: "" },
      },
      { code: "KNOWN_MALICIOUS_ADDRESS", values: { address: NOVASWAP.lookalike } },
      // The drainer starts and ends like the real router; the lookalike
      // detector runs after reputation, so its finding comes last.
      {
        code: "LOOKALIKE_ADDRESS",
        values: { address: NOVASWAP.lookalike, expected: NOVASWAP.router },
      },
    ],
    changes: [],
    approvals: [{ unit: "dUSDC", spender: NOVASWAP.lookalike, unlimited: true, amount: null }],
  };
}
