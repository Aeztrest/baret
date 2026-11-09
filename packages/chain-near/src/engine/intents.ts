import { type IntentsQuote, intentsQuoteSchema } from "./request.js";

/**
 * NEAR Intents 1Click, read-only (TN.8). `GET /v0/status?depositAddress=` answers the
 * quote 1Click registered when it handed out that deposit address, and the swap's state.
 * Baret uses it as the source of truth for a quote: the quote in a request is only a
 * pointer to it (pipeline.ts `confirmQuote`).
 */
export interface IntentsClient {
  /**
   * The registered quote and the swap's status ("PENDING_DEPOSIT" until a deposit lands);
   * null when 1Click knows no such deposit address; "unavailable" when 1Click did not
   * answer (the analysis then fails closed).
   */
  status(
    depositAddress: string,
  ): Promise<{ status: string; quote: IntentsQuote } | null | "unavailable">;
}

/** 1Click's public API (mainnet: NEAR Intents has no testnet). */
export const ONECLICK_API: Record<string, string> = {
  "near:mainnet": "https://1click.chaindefuser.com",
};

export class OneClickClient implements IntentsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async status(
    depositAddress: string,
  ): Promise<{ status: string; quote: IntentsQuote } | null | "unavailable"> {
    let res: Response;
    try {
      res = await this.fetchImpl(
        `${this.baseUrl}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`,
        { signal: AbortSignal.timeout(this.timeoutMs) },
      );
    } catch {
      return "unavailable";
    }
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) return "unavailable";
    let body: { status?: unknown; quoteResponse?: unknown };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      return "unavailable";
    }
    const quote = intentsQuoteSchema.safeParse(body.quoteResponse);
    if (typeof body.status !== "string" || !quote.success) return null;
    return { status: body.status, quote: quote.data };
  }
}
