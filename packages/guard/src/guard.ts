import {
  type AnalyzeRequest,
  analyzeRequestSchema,
  type Caip2,
  type Verdict,
  verdictSchema,
} from "@baret/core";

/**
 * The client for Baret's `/v1/analyze`, on any chain the server serves. Ported from
 * Metropolis `@baret/guard` 0.1.x onto the multichain contract (`chain` as CAIP-2,
 * GuardPolicy v2, the v2 Verdict). It never signs or sends anything.
 */

/** Baret could not be reached or answered with something it should not. */
export class GuardUnreachableError extends Error {
  /**
   * What a non-2xx answer said: the parsed JSON (`{ error: { code, message } }` from Baret's
   * own server), the text when it is not JSON, null when there is none. For reading and
   * logging only. Whatever it says, the caller does not sign.
   */
  public readonly body: unknown;

  constructor(
    message: string,
    public readonly status: number | null = null,
    options?: { cause?: unknown; body?: unknown },
  ) {
    super(message, options);
    this.name = "GuardUnreachableError";
    this.body = options?.body ?? null;
  }
}

export interface TransactionGuardOptions {
  /** The Baret server, e.g. https://api.baret.example. No default on purpose. */
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

/**
 * Asks the Baret server for a verdict.
 *
 * Fail-closed: when the server cannot be reached, times out or returns a body that does
 * not match the contract, `evaluate` throws GuardUnreachableError. The caller treats that as
 * Blocked ("Can't reach Baret"). A request off the schema throws a ZodError before anything
 * is sent.
 */
export class TransactionGuard {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly options: TransactionGuardOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async evaluate(request: AnalyzeRequest): Promise<Verdict> {
    const body = analyzeRequestSchema.parse(request);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.options.apiKey) headers["x-api-key"] = this.options.apiKey;

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/v1/analyze`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
      });
    } catch (cause) {
      throw new GuardUnreachableError("Baret did not answer", null, { cause });
    }
    if (!res.ok) {
      throw new GuardUnreachableError(`Baret answered ${res.status}`, res.status, {
        body: await errorBody(res),
      });
    }
    const parsed = verdictSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardUnreachableError("Baret answered with an unexpected body", res.status, {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }
}

async function errorBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Whether a verdict lets the caller sign without asking anyone. */
export function isSafe(verdict: Verdict): boolean {
  return verdict.decision === "safe";
}

/** Whether a verdict lets a person sign after reading the findings. */
export function isSignable(verdict: Verdict): boolean {
  return verdict.decision !== "blocked";
}

/** Why a verdict may no longer be signed on. */
export type VerdictRefusal = "expired" | "wrong_chain";

/**
 * Whether a verdict can still be signed on: null when it can, the reason when it cannot.
 * `chain` is the chain the caller is about to sign for; `now` is Unix seconds.
 *
 * Call it right before signing, and again when a person took time to confirm.
 */
export function verdictRefusal(
  verdict: Verdict,
  expected: { chain: Caip2; now?: number },
): VerdictRefusal | null {
  if (verdict.chain !== expected.chain) return "wrong_chain";
  const now = expected.now ?? Math.floor(Date.now() / 1000);
  if (!(now < verdict.expiresAt)) return "expired";
  return null;
}
