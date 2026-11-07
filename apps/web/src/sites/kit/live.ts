import type { AnalyzeRequest, Verdict } from "@baret/core";
import {
  callRequest,
  type DemoPayment,
  type DemoRules,
  type DemoTx,
  paymentRequest,
} from "@baret/demo-evm";
import { FAILED } from "@baret/web-ui/lib/check";
import type { CheckApproval, CheckChange, CheckResult } from "@baret/web-ui/lib/check-types";

/**
 * Baret's live answer for a demo dApp. The showcase reaches the server at
 * `/api` (the Vite proxy in development, a Vercel rewrite in production), so
 * there is no URL to configure.
 *
 * Fail-closed at every step: a non-2xx status or an answer that does not
 * match the /v1/analyze contract becomes FAILED (Blocked). A network error
 * or an abort rejects, which `runCheck` turns into FAILED as well.
 */

export const ANALYZE_URL = "/api/v1/analyze";

/**
 * One request to Baret (a `POST /v1/analyze` body, as `@baret/demo-evm` builds it),
 * read back with `wallet` as the account whose changes show.
 */
export async function analyze(
  body: AnalyzeRequest,
  wallet: string,
  signal: AbortSignal,
): Promise<CheckResult> {
  const res = await fetch(ANALYZE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) return FAILED;
  // The schema (and zod with it) loads only when a live check runs.
  const { verdictSchema } = await import("@baret/core");
  const parsed = verdictSchema.safeParse(await res.json());
  return parsed.success ? fromVerdict(parsed.data, wallet) : FAILED;
}

/**
 * Base units to a short display amount: at most four decimals, cut (never
 * rounded up), no trailing zeros. BigInt maths only, so the live seam does
 * not pull in a chain library. A negative amount keeps its sign unless it
 * shows as 0 (no "-0"); a negative or fractional `decimals` throws, which
 * the caller turns into FAILED.
 */
/** A demo call, checked under Balanced unless `rules` says otherwise; the sender's changes show. */
export function analyzeCall(
  tx: DemoTx,
  signal: AbortSignal,
  rules?: DemoRules,
): Promise<CheckResult> {
  return analyze(callRequest(tx, rules), tx.from, signal);
}

/** A demo x402 payment, checked under `rules`; the signer's changes show. */
export function analyzePayment(
  built: DemoPayment,
  rules: DemoRules,
  signal: AbortSignal,
): Promise<CheckResult> {
  return analyze(paymentRequest(built, rules), built.typedData.signer, signal);
}

export function displayAmount(raw: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0) throw new RangeError("decimals");
  const sign = raw < 0n ? "-" : "";
  const abs = raw < 0n ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = (abs / base).toString();
  const fraction = (abs % base).toString().padStart(decimals, "0");
  const short = fraction.slice(0, 4).replace(/0+$/, "");
  const body = short ? `${whole}.${short}` : whole;
  return body === "0" ? body : `${sign}${body}`;
}

/** A contract address cut to its head and tail, the unit of a token with no symbol. */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The asset of a balance change, read loosely: the server may name kinds
 * the client's contract does not know yet (an ERC-721 piece with its token
 * id), and an unknown kind still has to render rather than throw.
 */
interface LooseAsset {
  readonly kind?: unknown;
  /** CAIP-19: the token's address is its last segment. */
  readonly id?: unknown;
  readonly symbol?: unknown;
  readonly decimals?: unknown;
  readonly tokenId?: unknown;
}

/** The address at the end of a CAIP-10 or CAIP-19 id, or the id itself. */
export function addressIn(id: string): string {
  return id.split(":").pop() ?? id;
}

/**
 * One change's amount and unit. A piece (kind "erc721") is counted, never
 * divided: "1 NIGHT #42" in or out, so a mint shows the piece arriving.
 * Everything else is a token amount in display units.
 */
export function changeOf(abs: bigint, asset: LooseAsset): { value: string; unit: string } {
  const symbol = typeof asset.symbol === "string" ? asset.symbol : "";
  const address =
    typeof asset.id === "string" && asset.kind !== "native" ? addressIn(asset.id) : null;
  const name = symbol || (address ? shortAddress(address) : "");
  if (asset.kind === "nft") {
    const id =
      typeof asset.tokenId === "string" && asset.tokenId !== "" ? ` #${asset.tokenId}` : "";
    return { value: abs.toString(), unit: `${name}${id}` };
  }
  const decimals = typeof asset.decimals === "number" && asset.decimals >= 0 ? asset.decimals : 0;
  return { value: displayAmount(abs, decimals), unit: name };
}

/** Severity order for the panel: the finding that decides the verdict reads first. */
const SEVERITY_RANK: Readonly<Record<string, number>> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Findings with the blocking ones first, then by severity, else in the
 * server's order. The server lists them in detector order, which can put the
 * one reason for Blocked under two cards that block nothing.
 */
export function orderFindings<
  F extends { readonly blocking?: boolean; readonly severity?: string },
>(list: readonly F[]): F[] {
  return list
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => {
      const blocking = Number(b.finding.blocking === true) - Number(a.finding.blocking === true);
      if (blocking !== 0) return blocking;
      const severity =
        (SEVERITY_RANK[b.finding.severity ?? ""] ?? 0) -
        (SEVERITY_RANK[a.finding.severity ?? ""] ?? 0);
      return severity !== 0 ? severity : a.index - b.index;
    })
    .map((entry) => entry.finding);
}

/**
 * AnalyzeResponse to what the panel reads. Only the visitor's own balance
 * changes and allowances are shown: that is the "What changes" a wallet
 * would show before signing. A token with no symbol is named by its
 * shortened contract address, so an allowance never shows a blank unit.
 * firedRules, suggestions, sources and expiresAt are not mapped yet:
 * CheckResult has no place for them.
 */
export function fromVerdict(verdict: Verdict, wallet: string): CheckResult {
  const changes: CheckChange[] = verdict.estimatedChanges
    .filter((c) => same(addressIn(c.account), wallet))
    .flatMap((c) => {
      const delta = BigInt(c.delta);
      if (delta === 0n) return [];
      const abs = delta < 0n ? -delta : delta;
      return [{ direction: delta < 0n ? "out" : "in", ...changeOf(abs, c.asset) } as const];
    });

  const approvals: CheckApproval[] = verdict.allowances
    .filter((a) => same(addressIn(a.owner), wallet))
    .map((a) => ({
      unit: a.asset.symbol || shortAddress(addressIn(a.asset.id)),
      spender: addressIn(a.spender),
      unlimited: a.unlimited,
      amount:
        a.unlimited || a.amount === null || a.asset.decimals === null
          ? null
          : displayAmount(BigInt(a.amount), a.asset.decimals),
    }));

  return {
    source: "live",
    verdict: verdict.decision,
    findings: orderFindings(verdict.findings).map((f) => ({
      code: f.code,
      values: f.values,
      ...(f.details ? { details: f.details } : {}),
    })),
    changes,
    approvals,
    requestId: verdict.meta.requestId,
  };
}
