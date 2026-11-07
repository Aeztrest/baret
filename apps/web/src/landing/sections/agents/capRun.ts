import { findings, home } from "@baret/content";
import { fill } from "@baret/web-ui/lib/util";

const { demo } = home.agents;

/** A run under the cap, or the payment the cap stops. */
export type CapResult =
  | { readonly kind: "fits"; readonly spent: number }
  | { readonly kind: "capped"; readonly spent: number; readonly next: number };

/**
 * A deterministic sample run (IMPROVE H3): `run` payments of `price` each
 * against a daily `cap`. Either every payment fits, or the first one that
 * would cross the cap is stopped and `next` is the total it would have made.
 */
export function capRun(price: number, run: number, cap: number): CapResult {
  const paid = Math.min(run, Math.floor(cap / price));
  return paid === run
    ? { kind: "fits", spent: paid * price }
    : { kind: "capped", spent: paid * price, next: (paid + 1) * price };
}

/** An amount in the sample asset, for example "20 USDC". */
export function amount(n: number): string {
  return fill(demo.preset, { cap: String(n), asset: demo.asset });
}

/** The one sentence under the presets: the run fits, or the finding that stops it. */
export function capSentence(cap: number): string {
  const result = capRun(demo.price, demo.run, cap);
  if (result.kind === "fits") return fill(demo.fits, { count: String(demo.run) });
  // The v2 finding names the asset itself ({asset}), so the numbers go in bare.
  return fill(findings[demo.findingCode].body, {
    amount: String(demo.price),
    actual: String(result.next),
    cap: String(cap),
    asset: demo.asset,
  });
}

/**
 * How far a capped run got, for example "10 of 20 paid.", or null when the
 * whole run fits (the fits sentence already says so).
 */
export function capProgress(cap: number): string | null {
  const result = capRun(demo.price, demo.run, cap);
  if (result.kind === "fits") return null;
  return fill(demo.progress, {
    paid: String(result.spent / demo.price),
    count: String(demo.run),
  });
}

/** What the status region says after a preset is chosen. */
export function announceCap(cap: number): string {
  const sentence = capSentence(cap);
  return capRun(demo.price, demo.run, cap).kind === "fits"
    ? sentence
    : fill(demo.announceCapped, { tag: demo.capped, finding: sentence });
}

/** The sample line above the presets. */
export function sampleLine(): string {
  return fill(demo.sample, { count: String(demo.run), amount: amount(demo.price) });
}
