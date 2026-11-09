/**
 * TN.10: the Baret agent on NEAR Agent Market. It polls its assignments, reads the
 * transaction in each new hire's brief, asks Baret, and delivers the verdict as Markdown.
 * A brief without a transaction gets the expected format as a message and is not started,
 * so the buyer can cancel for a full refund.
 *
 * Self-hosted: it only makes outbound calls (market.near.ai, Baret's API). The agent token
 * (`aat_…`, from the agent's Edit page) is a secret: .env.near or the environment only.
 *
 *   NEAR_MARKET_TOKEN=aat_… pnpm market-agent          # loop
 *   NEAR_MARKET_TOKEN=aat_… pnpm market-agent --once   # one pass
 */
import { BARET_API, env, envOr } from "../src/env.js";
import { BRIEF_HELP, briefToBody, type Verdict, verdictMarkdown } from "../src/market.js";

const TOKEN = env("NEAR_MARKET_TOKEN");
const MARKET = envOr("NEAR_MARKET_API", "https://market.near.ai");
const ONCE = process.argv.includes("--once");
const POLL_MS = 30_000;

async function market(method: string, path: string, body?: object): Promise<unknown> {
  const res = await fetch(`${MARKET}${path}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : null,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

interface Assignment {
  id: string;
  startedAt: string | null;
  status?: string;
  job?: { description?: string };
}

/** The API answers a list, or an object holding one; both are read. */
function rows(v: unknown): Assignment[] {
  if (Array.isArray(v)) return v as Assignment[];
  if (v && typeof v === "object") {
    for (const key of ["assignments", "data", "items"]) {
      const inner = (v as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner as Assignment[];
    }
  }
  return [];
}

async function analyze(body: object): Promise<Verdict | null> {
  try {
    const res = await fetch(`${BARET_API}/v1/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    return (await res.json()) as Verdict;
  } catch {
    return null; // fail-closed: verdictMarkdown says "no verdict"
  }
}

const told = new Set<string>();

async function pass(): Promise<void> {
  for (const a of rows(await market("GET", "/v1/agents/me/assignments"))) {
    if (a.startedAt !== null) continue; // started (or done): this loop never resumes work
    const body = briefToBody(a.job?.description ?? "");
    if (!body) {
      if (!told.has(a.id)) {
        await market("POST", `/v1/assignments/${a.id}/messages`, { body: BRIEF_HELP });
        told.add(a.id);
        console.log(`${a.id}: no transaction in the brief, format sent, not started`);
      }
      continue;
    }
    await market("POST", `/v1/assignments/${a.id}/start`);
    const verdict = await analyze(body);
    await market("POST", `/v1/assignments/${a.id}/submit`, {
      deliverableMarkdown: verdictMarkdown(body, verdict),
    });
    console.log(`${a.id}: ${body.chain} ${verdict?.decision ?? "no verdict"}, delivered`);
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
