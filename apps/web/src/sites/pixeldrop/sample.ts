import type { CheckResult, DemoMode } from "@baret/web-ui/lib/check-types";
import { SITE_ART } from "../../shared/assets.js";

/**
 * PixelDrop's prepared sample. The collection, the operator and the wallet
 * are sample addresses; the price and the limit match the page (0.01 MON a
 * piece, 10 per wallet).
 */

export const SAMPLE = {
  wallet: "0x7a3f9e21c84b5d06f13a2e9b7c40d58e6f21c21e",
  /** The Night Shift collection. */
  collection: "0x3b8d1f5a7c9e2b4d6f8a0c1e3b5d7f9a2c4e6b81",
  /** Who the attack version hands the collection to. */
  operator: "0x9e1c4a7f2b5d8e0a3c6f9b2d5e8a1c4f7b0d3e96",
  /** The price of one piece, in hundredths of a MON. */
  price: 1,
  perWallet: 10,
} as const;

/** The collection's name, as the wallet shows a piece arriving. */
export const PIECE = "Night Shift";

/** The three PixelDrop pictures (paths live in shared/assets.ts). */
export const ART = SITE_ART.pixeldrop;

/** "3" -> 3; anything that is not a whole number from 1 up -> null. */
export function parseQuantity(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** The price of `count` pieces in MON, to the hundredth: 3 -> "0.03". */
export function priceOf(count: number): string {
  const hundredths = count * SAMPLE.price;
  return `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, "0")}`;
}

/**
 * The sample answer. Honest: Safe, the price out and the pieces in. Attack:
 * nothing is minted, the grant over the whole collection is the harm, and
 * the operator is on the blocklist, so Blocked twice.
 */
export function sampleCheck(mode: DemoMode, count: number): CheckResult {
  if (mode === "safe") {
    return {
      source: "sample",
      verdict: "safe",
      findings: [],
      changes: [
        { direction: "out", value: priceOf(count), unit: "MON" },
        { direction: "in", value: String(count), unit: PIECE },
      ],
      approvals: [],
    };
  }
  return {
    source: "sample",
    verdict: "blocked",
    findings: [
      {
        code: "NFT_OPERATOR_GRANTED",
        values: { operator: SAMPLE.operator, contract: SAMPLE.collection },
      },
      { code: "KNOWN_MALICIOUS_ADDRESS", values: { address: SAMPLE.operator } },
    ],
    changes: [],
    // As Baret reports an operator grant: every piece, no amount.
    approvals: [{ unit: PIECE, spender: SAMPLE.operator, unlimited: true, amount: null }],
  };
}
