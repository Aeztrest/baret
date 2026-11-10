/**
 * TN.8: an agent about to swap through NEAR Intents asks Baret first. Three cases, each
 * with real 1Click quotes (mainnet: Intents runs on mainnet only):
 *
 *   1. honest: the agent's own quote and the deposit it asks for → Caution (app fee).
 *   2. a real quote that pays out and refunds to someone else (what a prompt injection
 *      or a bad app asks the agent to deposit into) → Blocked, INTENTS_RECIPIENT_MISMATCH.
 *   3. forged: the agent is shown its own quote, but with the deposit address of a quote
 *      that pays someone else → Blocked, INTENTS_QUOTE_UNVERIFIED (Baret asks 1Click for
 *      the quote registered behind the deposit address and finds a different one).
 *
 * Nothing is signed or sent; asking for a quote moves no funds.
 *
 *   NEAR_INTENTS_ACCOUNT=<mainnet account> pnpm intents-check
 */
import { BARET_API, envOr } from "../src/env.js";
import {
  depositFor,
  forge,
  getQuote,
  type IntentsQuote,
  ONECLICK_DEFAULT,
} from "../src/intents.js";

const ACCOUNT = envOr("NEAR_INTENTS_ACCOUNT", "");
if (!ACCOUNT) {
  console.error("Set NEAR_INTENTS_ACCOUNT to a NEAR mainnet account (the agent).");
  process.exit(2);
}
/** Who the attacker's quote pays: any existing mainnet account that is not the agent. */
const OTHER = envOr("NEAR_INTENTS_OTHER", "relay.near");
const ONECLICK = envOr("NEAR_INTENTS_API", ONECLICK_DEFAULT);

async function ask(label: string, intents: IntentsQuote): Promise<void> {
  console.log(`\n${label}`);
  const r = await fetch(`${BARET_API}/v1/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chain: "near:mainnet",
      request: { kind: "transaction", tx: depositFor(ACCOUNT, intents), intents },
      policyTemplate: "balanced",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const v = (await r.json()) as {
    decision?: string;
    findings?: {
      code: string;
      blocking: boolean;
      details?: { fields?: string[]; reason?: string };
    }[];
    error?: { code: string };
  };
  if (!r.ok || !v.decision) {
    console.log(`  Baret did not answer (${r.status} ${v.error?.code ?? ""}): not signing.`);
    return;
  }
  console.log(`  Baret: ${v.decision.toUpperCase()}`);
  for (const f of v.findings ?? []) {
    const why = f.details?.fields?.join(", ") ?? f.details?.reason;
    console.log(`    - ${f.code}${why ? ` (${why})` : ""}${f.blocking ? "  [blocks]" : ""}`);
  }
}

const mine = await getQuote(ACCOUNT, ONECLICK);
const theirs = await getQuote(OTHER, ONECLICK);
if (!mine || !theirs) {
  console.error("1Click gave no quote.");
  process.exit(1);
}
console.log(
  `Agent's quote: 0.1 wNEAR -> ${mine.quote.amountOutFormatted ?? "?"} USDC, deposit to ${mine.quote.depositAddress}`,
);
console.log(`A quote paying ${OTHER}: deposit to ${theirs.quote.depositAddress}`);

await ask("1. The agent's own quote, as 1Click gave it:", mine);
await ask(`2. A real quote that pays ${OTHER}, deposited into as asked:`, theirs);
await ask(
  `3. Forged: the agent's own quote, with the deposit address of the quote paying ${OTHER}:`,
  forge(mine, theirs),
);
