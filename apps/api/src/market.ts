import {
  type Analyze,
  DeliveryLog,
  handleHire,
  type MarketClient,
  readHire,
  verifyWebhook,
} from "@baret/agent-market";
import type { FastifyInstance, FastifyReply } from "fastify";

/**
 * NEAR Agent Market webhook (TN.13): the market POSTs `hire.created` here the moment Baret
 * is hired, so a hire does not wait for a poller. The free staging instance sleeps when
 * idle; the first delivery wakes it and the market's retries (10 s, 30 s, 90 s, 270 s)
 * cover the cold start, well inside the 15 min SLA.
 *
 * The answer comes first and the work after: a 2xx to `hire.created` is what tells the
 * market the job started, and the analysis must not hold the market's request open.
 */
export interface MarketWebhookDeps {
  secret: string;
  client: MarketClient;
  analyze: Analyze;
  /** Receives each hire's work once it is scheduled (tests wait on it). */
  onWork?: (work: Promise<void>) => void;
  /** Unix seconds; the clock the signature's timestamp is compared with. */
  now?: () => number;
}

export const MARKET_WEBHOOK_PATH = "/v1/market/webhook";

export async function registerMarketWebhook(
  app: FastifyInstance,
  deps: MarketWebhookDeps,
  sendError: (reply: FastifyReply, status: number, code: string, message: string) => unknown,
): Promise<void> {
  const seen = new DeliveryLog();
  // Own scope: here the body is kept as raw bytes, because the signature is over them.
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => {
      done(null, body);
    });

    scope.post(MARKET_WEBHOOK_PATH, async (req, reply) => {
      const header = (name: string) => {
        const v = req.headers[name];
        return typeof v === "string" ? v : undefined;
      };
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const signed = verifyWebhook(
        deps.secret,
        { timestamp: header("x-market-timestamp"), signature: header("x-market-signature") },
        raw,
        deps.now?.(),
      );
      if (!signed) {
        return sendError(reply, 401, "unauthorized", "missing or invalid webhook signature");
      }
      const event = header("x-market-event");
      const delivery = header("x-market-delivery");
      // A retried delivery that was already handled: say so, so the market stops retrying.
      if (delivery && !seen.first(delivery)) return reply.code(200).send({ status: "duplicate" });
      if (event !== "hire.created") return reply.code(200).send({ status: "ignored", event });

      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        return sendError(reply, 400, "invalid_request", "the body is not JSON");
      }
      const hire = readHire(body);
      if (!hire) {
        return sendError(reply, 400, "invalid_request", "hire.created without an assignment_id");
      }

      const work = handleHire(deps.client, hire, deps.analyze, { started: true }).then(
        (outcome) => {
          req.log.info({ assignment: hire.assignmentId, outcome }, "market hire handled");
        },
        (err: unknown) => {
          // The poller (keep-warm workflow) picks up a started job left undelivered.
          req.log.error({ err, assignment: hire.assignmentId }, "market hire failed");
        },
      );
      deps.onWork?.(work);
      return reply.code(202).send({ status: "accepted" });
    });
  });
}
