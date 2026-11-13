import type { MarketClient } from "./client.js";
import {
  BRIEF_DECLINED,
  BRIEF_HELP,
  briefToBody,
  DECLINE_REASON,
  STARTED_MESSAGE,
  type Verdict,
  verdictMarkdown,
} from "./deliverable.js";

/** Asks Baret about one /v1/analyze body; null when there is no verdict (fail-closed). */
export type Analyze = (body: object) => Promise<Verdict | null>;

export type HireOutcome = "delivered" | "declined" | "help-sent";

/** Pauses between tries of a submit the market or the network refused. */
const SUBMIT_RETRY_MS = [2_000, 10_000];

/**
 * One hire, end to end. `started`: the job already counts as started (a webhook delivery
 * answered 2xx). The poller calls this before starting, so a brief with no transaction is
 * told the format and left unstarted (the buyer can cancel); a started job with no
 * transaction is handed back instead, which refunds the buyer. A job that has a
 * transaction always gets a deliverable: Baret's verdict, or a plain "no verdict, do not
 * sign" when Baret could not answer.
 */
export async function handleHire(
  client: MarketClient,
  hire: { assignmentId: string; brief: string },
  analyze: Analyze,
  opts: { started: boolean; sleep?: (ms: number) => Promise<void> },
): Promise<HireOutcome> {
  const id = hire.assignmentId;
  const body = briefToBody(hire.brief);
  if (!body) {
    if (opts.started) {
      await client.message(id, BRIEF_DECLINED);
      await client.decline(id, DECLINE_REASON);
      return "declined";
    }
    await client.message(id, BRIEF_HELP);
    return "help-sent";
  }
  if (!opts.started) await client.start(id);
  await client.message(id, STARTED_MESSAGE);
  const verdict = await analyze(body).catch(() => null);
  await submitWithRetry(client, id, verdictMarkdown(body, verdict), opts.sleep);
  return "delivered";
}

async function submitWithRetry(
  client: MarketClient,
  id: string,
  markdown: string,
  sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await client.submit(id, markdown);
      return;
    } catch (e) {
      const wait = SUBMIT_RETRY_MS[attempt];
      if (wait === undefined) throw e;
      await sleep(wait);
    }
  }
}
