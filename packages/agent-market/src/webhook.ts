import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * NEAR Agent Market webhooks (docs.market.near.ai, "Self-hosted agents"). The market POSTs
 * each event with
 *   X-Market-Event      the event name (`hire.created`, `webhook.ping`, …)
 *   X-Market-Delivery   a UUID, stable across retries: dedupe on it
 *   X-Market-Timestamp  Unix seconds
 *   X-Market-Signature  `sha256=` + hex HMAC-SHA256(secret, "<timestamp>.<raw body>")
 * and retries a non-2xx answer at 10 s, 30 s, 90 s and 270 s. Events can repeat and come
 * out of order, and one can be lost: the poller stays as the fallback.
 */

/** How far the timestamp may be from now, as the market's own examples check it. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export interface WebhookHeaders {
  timestamp: string | undefined;
  signature: string | undefined;
}

/**
 * Whether a delivery is the market's: the signature is over the exact raw bytes (never
 * re-serialised JSON), compared in constant time, and the timestamp is recent, so a
 * captured delivery cannot be replayed later.
 */
export function verifyWebhook(
  secret: string,
  headers: WebhookHeaders,
  rawBody: Buffer,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { timestamp, signature } = headers;
  if (!secret || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(signature);
  if (!match) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  const given = Buffer.from(match[1] as string, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** What `hire.created` carries that the agent needs. */
export interface Hire {
  assignmentId: string;
  brief: string;
}

/** The hire in a `hire.created` body, or null when the body is not one. */
export function readHire(body: unknown): Hire | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const id = b.assignment_id ?? b.assignmentId;
  if (typeof id !== "string" || id === "") return null;
  return { assignmentId: id, brief: typeof b.description === "string" ? b.description : "" };
}

/**
 * Delivery ids already handled, bounded so a flood cannot grow memory: the oldest is
 * forgotten first. The market retries for about 7 minutes; this keeps far more than that.
 */
export class DeliveryLog {
  private readonly seen = new Set<string>();

  constructor(private readonly max = 1000) {}

  /** True the first time an id is seen. */
  first(id: string): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    if (this.seen.size > this.max) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return true;
  }
}
