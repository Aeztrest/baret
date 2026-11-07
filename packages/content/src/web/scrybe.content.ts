import { hub } from "./hub.content.js";
import type { ScenarioSite } from "./types.js";

/**
 * /scrybe on apps/showcase. Silent agent. The x402 scenario.
 *
 * Story: a paid answer service that charges per answer over HTTP 402. Nothing
 * here is malicious. The scenario is what stops an agent that keeps asking.
 * Every x402 write-up online is from the seller's side; this page is the
 * payer's side.
 *
 * The price, the merchant and the receipt are read live from the 402 response
 * and the settlement ({amount}, {merchant}), so no price is fixed in the copy.
 * The answer text is not the point and is never presented as more than it is.
 *
 * One answer: GET /demo/paywall, 402, Baret checks the payment request, pays
 * inside the caps, the facilitator settles on Monad testnet, the answer comes
 * back with a receipt. Expected Safe, no findings. The payment is a signed
 * USDC transferWithAuthorization (the x402 exact scheme).
 *
 * Agent loop: an agent on the page asks back to back. Each payment is checked
 * and valid; the one that would cross a cap is declined before it is signed.
 * Expected "capped" (Blocked at the cap). Codes, whichever cap fills first:
 *   X402_HOURLY_CAP_EXCEEDED   maxHourlyCap (the likely one)
 *   X402_DAILY_CAP_EXCEEDED    maxDailyCap
 *   X402_PER_TX_CAP_EXCEEDED   maxPerTxCap, only if the price is above it
 * With default caps and a small price the loop takes many payments to fill a
 * cap, so the page tells the visitor to set a low hourly cap first.
 * Checks that run on every payment and pass here: X402_DESTINATION_MISMATCH,
 * X402_ASSET_MISMATCH, X402_NON_CANONICAL_ASSET (named in `claims`).
 *
 * Watch for -> source: the three cap codes above, one line each.
 */

export const scrybe = {
  meta: {
    title: "Scrybe x402 payments scenario · Baret",
    description:
      "A pay-per-answer service on Monad testnet that an agent pays over x402. Watch Baret check every payment against the caps you set.",
  },

  /** The card on the hub and the landing (web/hub.content.ts `sites`). */
  scenario: hub.sites[0],

  site: {
    brand: "Scrybe",
    hostname: "scrybe.example",
    nav: ["Ask", "Pricing", "API", "Usage"],
    /** The fake site's wallet control. Pressing it fills in a sample address. */
    connect: { label: "Connect wallet", connected: "Sample wallet" },
    hero: {
      badge: "Paid per answer",
      title: "Ask a question. Pay for the answer.",
      body: "No account, no API key, no subscription. Ask, get a price, pay it, get the answer. An agent can run the whole loop on its own.",
      cta: "Ask",
    },
    panel: {
      title: "Ask Scrybe",
      input: "Type a question",
      rows: [
        { label: "Price", value: "{amount} USDC per answer" },
        { label: "Paid in", value: "USDC on Monad testnet" },
        { label: "Paid to", value: "{merchant}" },
      ],
      cta: "Pay and ask",
      note: "The price comes with every payment request, so you see it before anything is paid.",
      start: "How do x402 payments settle on Monad?",
      errors: { empty: "Type a question first." },
    },
    stats: [
      { value: "402", label: "the status code that asks for payment" },
      { value: "1", label: "payment per answer" },
      { value: "0", label: "accounts to create" },
    ],
    sections: [
      {
        title: "How paying works",
        body: "Your request gets a 402 reply with a price, an asset and an address. Your client pays and sends the same request again. The answer comes back.",
      },
      {
        title: "Built for agents",
        body: "There is no login to automate and no key to rotate. An agent that can pay can ask.",
      },
    ],
    faq: [
      {
        question: "What does an answer cost?",
        answer: "The price is in every payment request, so your client sees it before paying.",
      },
      { question: "Do I need an account?", answer: "No. The payment is the only credential." },
      {
        question: "What if a payment fails?",
        answer: "You get no answer and pay nothing. Ask again when you are ready.",
      },
    ],
    progress: ["Asking", "Payment requested", "Paying", "Settling on Monad", "Answered"],
    done: {
      title: "Answered",
      body: "Paid {amount} USDC to {merchant}. The payment settled on Monad testnet.",
    },
    footer: "Scrybe charges per answer over x402. The price is set in each payment request.",
    /** The agent loop: the card's switch, the cap the visitor picks, the button that starts it. */
    attack: {
      switch: {
        label: "Agent loop",
        off: "Off. You ask once and pay once.",
        on: "On. An agent asks one question after another and pays for each, until a payment would cross your hourly cap.",
      },
      cap: "Your hourly cap",
      cta: "Start the agent",
      note: "Each payment goes to Baret before it is signed.",
    },
    pages: {
      sampleNote: "Sample figures. This demo site has no live usage data.",
      views: [
        {
          id: "pricing",
          kind: "list",
          title: "Pricing",
          body: "One price per answer, sent with every payment request. No plans, no minimum, nothing to cancel.",
          items: [
            {
              label: "Per answer",
              title: "Priced in the request",
              body: "Every 402 reply names the price, the asset and the address. Your client reads all three before it pays.",
            },
            {
              label: "Asset",
              title: "USDC on Monad testnet",
              body: "Payments settle in USDC. Each request names the token contract to pay with.",
            },
            {
              label: "Plans",
              title: "None",
              body: "There is nothing to subscribe to and nothing to cancel. You pay for the answers you get.",
            },
            {
              label: "Failed payments",
              title: "Cost nothing",
              body: "A payment that does not settle sends no answer and takes nothing from you.",
            },
          ],
        },
        {
          id: "api",
          kind: "docs",
          title: "API",
          body: "One endpoint. Ask, read the price, pay, then ask again with the payment attached.",
          toc: "On this page",
          sections: [
            {
              id: "ask",
              title: "Ask",
              body: "Send the question as a GET request. Without a payment, the reply is 402 Payment Required.",
              code: "GET https://scrybe.example/ask?q=How+do+x402+payments+settle\n\nHTTP/1.1 402 Payment Required",
            },
            {
              id: "price",
              title: "Read the price",
              body: "The 402 reply says what to pay: the amount in base units, the token and the address.",
              code: '{\n  "scheme": "exact",\n  "network": "monad-testnet",\n  "maxAmountRequired": "50000",\n  "asset": "0x...",\n  "payTo": "0x..."\n}',
            },
            {
              id: "pay",
              title: "Pay and ask again",
              body: "Sign the payment, then send the same request with it in the X-PAYMENT header. The answer comes back with a receipt.",
              code: "GET https://scrybe.example/ask?q=How+do+x402+payments+settle\nX-PAYMENT: <signed payment>\n\nHTTP/1.1 200 OK\nX-PAYMENT-RESPONSE: <receipt>",
            },
            {
              id: "agents",
              title: "From an agent",
              body: "An agent runs the same loop on its own. Give it a wallet with caps, so the running total stops where you decide.",
            },
          ],
        },
        {
          id: "usage",
          kind: "chart",
          title: "Usage",
          body: "Answers and payments across every Scrybe client, by day.",
          chart: {
            title: "Answers per day",
            caption: "Last 14 days, in thousands.",
            unit: "k",
            days: [
              "19",
              "20",
              "21",
              "22",
              "23",
              "24",
              "25",
              "26",
              "27",
              "28",
              "29",
              "30",
              "1",
              "2",
            ],
            values: [
              18.2, 21.5, 20.1, 24.8, 26, 25.1, 29.4, 31.2, 30.5, 34.8, 36.1, 35.4, 39, 41.3,
            ],
          },
          top: {
            title: "Totals",
            items: [
              { label: "Answers in 24h", value: "41,280" },
              { label: "Paying clients", value: "1,906" },
              { label: "Agents among them", value: "71%" },
              { label: "USDC paid in 24h", value: "2,064" },
            ],
          },
        },
      ],
    },
  },

  analysis: {
    modes: {
      safe: {
        label: "One answer",
        body: "You ask once. Baret checks the payment request, pays inside your caps and shows the receipt.",
        asks: "Scrybe wants you to pay {amount} USDC to {merchant}.",
        call: "transferWithAuthorization(to, value)",
        expected: "safe",
        expectedBody:
          "No rule should fire. The address and the asset should match the request, and the amount should fit your caps.",
      },
      danger: {
        label: "Agent loop",
        body: "An agent on this page asks question after question and pays each time. Every payment is checked. The one that would cross a cap is not sent.",
        asks: "Scrybe wants you to pay {amount} USDC to {merchant}, once per question.",
        call: "transferWithAuthorization(to, value)",
        expected: "capped",
        expectedBody:
          "Payments go through until one would cross a cap. That payment is Blocked before it is signed, and so is every one after it until the window rolls on.",
      },
    },
    claims: [
      {
        claim: "The price is in every payment request.",
        check:
          "Baret checks that the payment matches the request: the same address and the same asset.",
      },
      {
        claim: "Paid in USDC.",
        check:
          "Baret compares the token's contract address with the canonical USDC on Monad, not its name.",
      },
      {
        claim: "An agent can run the whole loop on its own.",
        check: "It can, inside your caps. Baret counts every payment against a rolling total.",
      },
    ],
    watch: {
      title: "Before you start the loop",
      body: "Set a low hourly cap in your rules first. Then watch the running total fill and the next payment stop.",
    },
    without: {
      title: "Without a cap",
      body: "Each payment would be small and correct. The agent would keep paying for as long as it kept asking.",
    },
    lesson: {
      title: "Set the cap first",
      body: "x402 keeps no running total, on purpose. Your wallet has to, and the cap has to exist before the agent starts.",
    },
    run: {
      title: "The agent's payments",
      payment: "Payment {n}",
      /** Payments 1 to 5 are the agent's earlier payments, assumed for the demo; none was made here. */
      paid: "Assumed paid",
      total: "Last hour {total}",
      note: "Payments 1 to 5 are the agent's earlier payments this hour, assumed for this demo and never sent. Only the last payment is checked live.",
    },
  },

  /** The one extra key: SCRYBE bridges to the agents page. */
  cta: {
    title: "Give your agent the same caps",
    body: "Your agent pays from a PaymentGuard vault with a cap per payment and a daily cap per merchant. You can revoke its key at any time.",
    action: { label: "Read the agent docs", href: "/agents" },
  },

  /**
   * The strip on top: Scrybe makes a real payment in test USDC, so it is a
   * demo site, not a simulation. The notice sits above "Pay with your wallet".
   */
  frame: {
    pill: "Demo site",
    notice:
      "A demo merchant on Monad testnet. Pay with your wallet makes a real payment in test USDC, which has no value.",
  },

  /**
   * "Pay with your wallet": the same question paid for real. The server
   * answers 402, the wallet signs that payment and the server settles it on
   * Monad testnet before it answers.
   */
  pay: {
    checked:
      "The button above shows Baret's check of this payment. The one below makes it for real. Only the Baret wallet and the Baret extension check it before they sign.",
    action: "Pay with your wallet",
    note: "A real x402 payment on Monad testnet: your wallet signs a message for {amount} test USDC and Scrybe settles it. You need no MON. Test USDC has no value.",
    noteChecked:
      "A real x402 payment of {amount} test USDC on Monad testnet. Baret checks the payment before your wallet signs it. You need no MON. Test USDC has no value.",
    title: "Your payment",
    status: {
      asking: "Asking Scrybe for the price...",
      signing: "Confirm the payment in {wallet}...",
      settling: "Settling on Monad testnet...",
    },
    done: "Paid {amount} test USDC to {merchant}.",
    answer: "Scrybe's answer",
    errors: {
      rejected: "You declined in {wallet}. Nothing was paid.",
      pending: "{wallet} already has a request open. Finish it there, then try again.",
      network: "Your wallet is on another network. Switch it to Monad testnet, then try again.",
      account: "The connected account changed. Press the button again.",
      funds: "Your wallet does not hold enough test USDC. Nothing was paid.",
      balance: "Your wallet holds less than {amount} test USDC. Nothing was paid.",
      blocked: "Baret did not sign this payment in its window. Nothing was paid.",
      /** The same refusal, as the shared send path names it (kit/wallet/baretSend.ts). */
      checked: "Baret did not sign this payment in its window. Nothing was paid.",
      closed: "The Baret wallet window closed before it answered. Nothing was paid.",
      // A refusal with no check behind it: never shown as Blocked.
      unreachable:
        "The Baret wallet could not reach Baret, so the check did not finish. Nothing was paid.",
      window:
        "Your browser stopped the Baret wallet window. Allow pop-ups for this site, then press again. Nothing was paid.",
      refused: "Scrybe did not take the payment. Nothing was paid.",
      unsettled:
        "The payment did not settle in time, so there is no answer. Check your test USDC balance before you pay again.",
      unavailable: "Scrybe is not answering right now. Nothing was paid.",
      failed: "The wallet did not sign it. Nothing was paid.",
    },
    faucet: { label: "Get test USDC", href: "https://faucet.circle.com" },
  },
  /** An amount with its unit, for the cap choices and the agent's run. */
  amount: "{amount} USDC",
} as const satisfies ScenarioSite & {
  amount: string;
  pay: object;
  frame: { pill: string; notice: string };
  /** The run's extra line: the assumed payments are named as such (types.ts owns the rest). */
  analysis: { run: { note: string } };
};

export type ScrybeContent = typeof scrybe;
