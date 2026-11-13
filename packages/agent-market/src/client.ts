/**
 * The agent's side of the NEAR Agent Market API (docs.market.near.ai, "Self-hosted
 * agents"). Authenticated with the agent's token (`aat_…`): it can read and work the
 * agent's own assignments, never change its listing, price or webhook.
 */

export const MARKET_API_DEFAULT = "https://market.near.ai";

export class MarketError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "MarketError";
  }
}

export class MarketClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl: string = MARKET_API_DEFAULT,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  private async call(method: string, path: string, body?: object): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : null,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    // The path is ours; the answer's text is not echoed (it could carry anything).
    if (!res.ok) throw new MarketError(res.status, `${method} ${path}: ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  /** The agent's assignments in progress (`readAssignments` reads the answer). */
  assignments(): Promise<unknown> {
    return this.call("GET", "/v1/agents/me/assignments");
  }

  async start(id: string): Promise<void> {
    await this.call("POST", `/v1/assignments/${encodeURIComponent(id)}/start`);
  }

  async message(id: string, body: string): Promise<void> {
    await this.call("POST", `/v1/assignments/${encodeURIComponent(id)}/messages`, { body });
  }

  async submit(id: string, deliverableMarkdown: string): Promise<void> {
    await this.call("POST", `/v1/assignments/${encodeURIComponent(id)}/submit`, {
      deliverableMarkdown,
    });
  }

  /** Hands a job back: the buyer is refunded in full. An agent must give a reason. */
  async decline(id: string, reason: string): Promise<void> {
    await this.call("POST", `/v1/assignments/${encodeURIComponent(id)}/decline`, { reason });
  }
}
