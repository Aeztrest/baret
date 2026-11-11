/**
 * TN.10: the Baret agent on NEAR Agent Market, as a poller. The API's webhook
 * (`POST /v1/market/webhook`, TN.13) answers hires as they come; this pass is the fallback
 * the market's docs ask for, since a webhook delivery can be lost. It reads the agent's
 * assignments, and for each new hire runs `handleHire` (@baret/agent-market): the brief's
 * transaction goes to Baret's API and the verdict is delivered as Markdown. A brief
 * without a transaction gets the expected format as a message and is not started, so the
 * buyer can cancel for a full refund.
 *
 * Self-hosted: it only makes outbound calls (market.near.ai, Baret's API). The agent token
 * (`aat_…`, from the agent's Edit page) is a secret: .env.agent or the environment only.
 * Like the paying agent, it reads its settings by allowlist and holds no NEAR key.
 *
 *   NEAR_MARKET_TOKEN=aat_… pnpm market-agent          # loop
 *   NEAR_MARKET_TOKEN=aat_… pnpm market-agent --once   # one pass
 */
import {
  type Analyze,
  briefToBody,
  handleHire,
  MARKET_API_DEFAULT,
  MarketClient,
  readAssignments,
  type Verdict,
} from "@baret/agent-market";
import { BARET_API, agentEnv as env, agentEnvOr as envOr } from "../src/agent-env.js";

const client = new MarketClient(
  env("NEAR_MARKET_TOKEN"),
  envOr("NEAR_MARKET_API", MARKET_API_DEFAULT),
);
const ONCE = process.argv.includes("--once");
const POLL_MS = 30_000;
/** A job the webhook started is delivered within seconds; past this it was lost. */
const STALE_MS = 5 * 60_000;

const analyze: Analyze = async (body) => {
  try {
    const res = await fetch(`${BARET_API}/v1/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    return (await res.json()) as Verdict;
  } catch {
    return null; // fail-closed: the deliverable says "no verdict"
  }
};

const told = new Set<string>();

/**
 * Jobs this worker started but could not deliver (the market or the network failed after
 * start). They are tried again on every pass, so a started job is never left hanging
 * while the worker runs.
 */
const undelivered = new Map<string, string>();

async function pass(): Promise<void> {
  for (const [id, brief] of undelivered) {
    await handleHire(client, { assignmentId: id, brief }, analyze, { started: true });
    undelivered.delete(id);
    console.log(`${id}: delivered on retry`);
  }
  for (const a of readAssignments(await client.assignments())) {
    const hire = { assignmentId: a.id, brief: a.brief };
    if (a.startedAt !== null) {
      // Started (by the webhook) and still in progress long after: the API lost the work
      // (a restart between its 2xx and its submit). Deliver it here. A delivered job is no
      // longer listed as in progress, so this does not deliver twice.
      const started = Date.parse(a.startedAt);
      if (Number.isFinite(started) && Date.now() - started > STALE_MS) {
        await handleHire(client, hire, analyze, { started: true });
        console.log(`${a.id}: started ${a.startedAt} but undelivered, delivered now`);
      }
      continue;
    }
    if (!briefToBody(a.brief)) {
      // Told the format once, not started: the buyer decides (cancel, or a new brief).
      if (told.has(a.id)) continue;
      await handleHire(client, hire, analyze, { started: false });
      told.add(a.id);
      console.log(`${a.id}: no transaction in the brief, format sent, not started`);
      continue;
    }
    await client.start(a.id);
    undelivered.set(a.id, a.brief); // from here on, a failure is retried next pass
    await handleHire(client, hire, analyze, { started: true });
    undelivered.delete(a.id);
    console.log(`${a.id}: delivered`);
  }
}

do {
  try {
    await pass();
  } catch (e) {
    console.error(`pass failed: ${(e as Error).message}`);
    if (ONCE) process.exit(1);
  }
  if (!ONCE) await new Promise((r) => setTimeout(r, POLL_MS));
} while (!ONCE);
