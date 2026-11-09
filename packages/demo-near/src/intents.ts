/**
 * NEAR Intents 1Click quotes for the demo (TN.8): real, non-dry quotes on mainnet (Intents
 * has no testnet) and the deposit each one asks for. Asking for a quote moves no funds;
 * nothing here signs. Used by `scripts/intents-check.ts` and `scripts/verify.ts`.
 */

export const ONECLICK_DEFAULT = "https://1click.chaindefuser.com";
const WNEAR = "nep141:wrap.near";
const USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const AMOUNT = (10n ** 23n).toString(); // 0.1 wNEAR

export interface IntentsQuote {
  quote: { depositAddress?: string | undefined; amountIn: string; amountOutFormatted?: string };
  quoteRequest: Record<string, unknown>;
}

/** A 0.1 wNEAR → USDC quote paying out and refunding to `payTo`; null when 1Click fails. */
export async function getQuote(
  payTo: string,
  oneClick = ONECLICK_DEFAULT,
): Promise<IntentsQuote | null> {
  try {
    const res = await fetch(`${oneClick}/v0/quote`, {
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
        refundTo: payTo,
        refundType: "ORIGIN_CHAIN",
        recipient: payTo,
        recipientType: "DESTINATION_CHAIN",
        deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const q = (await res.json()) as IntentsQuote;
    return res.ok && q.quote?.depositAddress ? q : null;
  } catch {
    return null;
  }
}

/** The deposit a quote asks for: its amount of wNEAR from `signer` to its deposit address. */
export function depositFor(signer: string, q: IntentsQuote) {
  return {
    signerId: signer,
    receiverId: "wrap.near",
    actions: [
      {
        type: "FunctionCall",
        methodName: "ft_transfer",
        args: { receiver_id: q.quote.depositAddress, amount: q.quote.amountIn },
        gas: "30000000000000",
        deposit: "1",
      },
    ],
  };
}

/** The agent's own quote, carrying the deposit address of another quote (a forgery). */
export function forge(mine: IntentsQuote, theirs: IntentsQuote): IntentsQuote {
  return { ...mine, quote: { ...mine.quote, depositAddress: theirs.quote.depositAddress } };
}
