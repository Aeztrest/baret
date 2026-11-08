/**
 * TN.8: an agent about to swap through NEAR Intents asks Baret first. It gets a real
 * 1Click quote (mainnet: Intents runs on mainnet only), builds the deposit the quote asks
 * for, and sends both to /v1/analyze. Then the same deposit with the quote changed the
 * way a prompt injection or a bad quote service would: output and refund to someone else.
 *
 * Nothing is signed or sent. A non-dry quote is asked for because only it has a deposit
 * address; no funds move until a deposit is made, and this script makes none.
 *
 *   NEAR_INTENTS_ACCOUNT=<mainnet account holding some wNEAR> pnpm intents-check
 */
import { BARET_API, envOr } from "../src/env.js";

const ACCOUNT = envOr("NEAR_INTENTS_ACCOUNT", "");
if (!ACCOUNT) {
  console.error("Set NEAR_INTENTS_ACCOUNT to a NEAR mainnet account that holds some wNEAR.");
  process.exit(2);
}
const ONECLICK = envOr("NEAR_INTENTS_API", "https://1click.chaindefuser.com");
const WNEAR = "nep141:wrap.near";
const USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const AMOUNT = (10n ** 23n).toString(); // 0.1 wNEAR

const res = await fetch(`${ONECLICK}/v0/quote`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    dry: false,
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    originAsset: WNEAR,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: USDC,
    amount: AMOUNT,
    refundTo: ACCOUNT,
    refundType: "ORIGIN_CHAIN",
    recipient: ACCOUNT,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
  }),
  signal: AbortSignal.timeout(30_000),
});
const quote = (await res.json()) as {
  quote: { depositAddress?: string; amountIn: string; amountOutFormatted?: string };
  quoteRequest: Record<string, unknown>;
};
if (!res.ok || !quote.quote?.depositAddress) {
  console.error(`1Click gave no quote (${res.status}).`);
  process.exit(1);
}
console.log(
  `Quote: 0.1 wNEAR -> ${quote.quote.amountOutFormatted ?? "?"} USDC, deposit to ${quote.quote.depositAddress}`,
);

/** The deposit the quote asks for: its amount of wNEAR to its deposit address. */
const deposit = {
  signerId: ACCOUNT,
  receiverId: "wrap.near",
  actions: [
    {
      type: "FunctionCall",
      methodName: "ft_transfer",
      args: { receiver_id: quote.quote.depositAddress, amount: quote.quote.amountIn },
      gas: "30000000000000",
      deposit: "1",
    },
  ],
};

async function ask(label: string, intents: unknown): Promise<void> {
  console.log(`\n${label}`);
  const r = await fetch(`${BARET_API}/v1/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chain: "near:mainnet",
      request: { kind: "transaction", tx: deposit, intents },
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

await ask("The quote as 1Click gave it:", quote);
await ask("The same quote, changed to pay out and refund to someone else:", {
  ...quote,
  quoteRequest: {
    ...quote.quoteRequest,
    recipient: "drain-it-all.near",
    refundTo: "drain-it-all.near",
  },
});
