import { z } from "zod";

/**
 * Amounts. On the wire every amount is an integer in the asset's base units, as a decimal
 * string ("1250000" = 1.25 USDC). Floats are never used for money.
 */
export const baseUnitsSchema = z.string().regex(/^\d+$/, "must be an integer in base units");

/** A human amount in whole units, e.g. "12.5". Used only at the edges (templates, UI input). */
export const decimalAmountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'must be a non-negative decimal number, e.g. "12.5"');

/** "12.5" with 6 decimals → "12500000". Throws when the amount has more decimals than the asset. */
export function toBaseUnits(amount: string, decimals: number): string {
  decimalAmountSchema.parse(amount);
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error(`invalid decimals: ${decimals}`);
  const [whole = "0", fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new Error(`${amount} has more than ${decimals} decimals`);
  }
  const digits = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  return digits === "" ? "0" : digits;
}

/** "12500000" with 6 decimals → "12.5". */
export function fromBaseUnits(amount: string, decimals: number): string {
  baseUnitsSchema.parse(amount);
  if (decimals === 0) return amount.replace(/^0+(?=\d)/, "");
  const padded = amount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
