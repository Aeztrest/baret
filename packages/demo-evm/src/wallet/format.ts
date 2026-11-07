/** MON in wei, cut to four decimals for the wallet chip and the balance guards. */
export function formatMon(wei: bigint): string {
  const base = 10n ** 18n;
  const whole = (wei / base).toString();
  const fraction = (wei % base).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/** True when an amount is above a known balance; an unknown balance never blocks. */
export function exceeds(wei: bigint, balance: bigint | null): boolean {
  return balance !== null && wei > balance;
}
