import { hub } from "./hub.content.js";
import type { ScenarioSite } from "./types.js";

/**
 * /novaswap on apps/showcase. Drainer. Story per DECISIONS D-018.
 *
 * Runs on real Monad testnet contracts (`@baret/demo`, CONTRACTS.md section
 * 7): a test token dUSDC (never taken for real USDC), the NovaSwap router at
 * a fixed 3.2 dUSDC per MON, and a look-alike router whose address starts
 * and ends like the real one.
 *
 * Honest version: swapMonForUsdc(minOut), payable, on the router. MON out,
 * dUSDC in, both in your wallet. Expected Safe, no findings. Needs no
 * allowance.
 *
 * Attack version: the card turns into a dUSDC sale that first asks to
 * "enable dUSDC trading": approve(look-alike, unlimited). With an ordinary
 * wallet the following "swap" takes the whole dUSDC balance to a sink.
 * Expected Blocked, twice:
 *   APPROVAL_UNLIMITED   the allowance has no limit
 *   KNOWN_MALICIOUS_ADDRESS    the look-alike is on the registry's list
 *
 * Watch for -> source:
 *   1 unlimited allowance        APPROVAL_UNLIMITED (approvals)
 *   2 spender one character off  the router address on the Docs page
 *   3 reported spender           KNOWN_MALICIOUS_ADDRESS (registry)
 *
 * Keep demo swaps under half the wallet's MON: Baret does not price MON
 * against dUSDC, so the Balanced 50 % loss limit would block a bigger swap.
 */

export const novaswap = {
  meta: {
    title: "NovaSwap swap scenario · Baret",
    description:
      'A swap page on Monad testnet whose "enable trading" step hands a look-alike router your whole dUSDC balance. See what Baret checks before you sign.',
  },

  /** The card on the hub and the landing (web/hub.content.ts `sites`). */
  scenario: hub.sites[1],

  site: {
    brand: "NovaSwap",
    hostname: "novaswap.example",
    nav: ["Swap", "Pools", "Stats", "Docs"],
    /** The fake site's wallet control. The demo never asks a real wallet:
     *  pressing it fills in a sample address. */
    connect: { label: "Connect wallet", connected: "Sample wallet" },
    hero: {
      badge: "No allowance needed for MON",
      title: "Swap MON for dUSDC in one step",
      body: "Pay in MON, receive dUSDC, settle in a single transaction. No account, and no allowance to manage.",
      cta: "Swap",
    },
    panel: {
      title: "Swap",
      input: "Amount of MON",
      rows: [
        { label: "You pay", value: "MON" },
        { label: "You receive", value: "dUSDC" },
        { label: "Rate", value: "Fixed test rate" },
        { label: "Route", value: "NovaSwap router" },
        { label: "Max slippage", value: "0.5%" },
      ],
      cta: "Review swap",
      note: "Quotes on Monad testnet use a fixed test rate, not a market price.",
      balance: "Balance",
      max: "Max",
      errors: {
        empty: "Enter an amount of MON.",
        tooHigh: "That is more MON than this wallet holds.",
      },
    },
    stats: [
      { value: "$4.2M", label: "24h volume" },
      { value: "14", label: "pools routed" },
      { value: "0.05%", label: "protocol fee" },
    ],
    sections: [
      {
        title: "Settles in one transaction",
        body: "Your MON goes in and your dUSDC comes out in the same transaction. Nothing waits in a queue.",
      },
      {
        title: "Routed for you",
        body: "NovaSwap picks the route. You see the rate before you confirm.",
      },
    ],
    faq: [
      {
        question: "Do I need to approve anything?",
        answer: "Not to swap MON. Native MON needs no allowance.",
      },
      { question: "Where does my dUSDC go?", answer: "Straight to the wallet you connected." },
      {
        question: "Is there a protocol fee?",
        answer: "0.05% of each swap, already included in the rate.",
      },
    ],
    progress: ["Getting a quote", "Confirm in your wallet", "Swapping", "Swap complete"],
    done: {
      title: "Swap complete",
      body: "Your dUSDC is on its way to your wallet.",
    },
    footer: "NovaSwap runs on Monad. Rates are shown before you confirm.",
    attack: {
      switch: {
        label: "Suspicious swap",
        off: "Off. Review swap calls the NovaSwap router.",
        on: "On. The card sells dUSDC, and its button asks for an unlimited allowance to a look-alike router. This is the attack version.",
      },
      input: "Amount of dUSDC",
      rows: [
        { label: "You pay", value: "dUSDC" },
        { label: "You receive", value: "MON" },
        { label: "Rate", value: "Fixed test rate" },
        { label: "Route", value: "NovaSwap router" },
        { label: "Max slippage", value: "0.5%" },
      ],
      cta: "Enable dUSDC trading",
      note: "Selling dUSDC needs trading enabled once for this token.",
      errors: {
        empty: "Enter an amount of dUSDC.",
        tooHigh: "That is more dUSDC than this wallet holds.",
      },
    },
    pages: {
      sampleNote: "Sample figures. This demo site has no live market data.",
      pools: {
        title: "Pools",
        body: "Every pool NovaSwap routes through on Monad testnet. Pick one to swap through it.",
        columns: { pair: "Pool", tvl: "Liquidity", volume: "24h volume", fee: "Fee" },
        action: "Swap",
        items: [
          { pair: "MON / dUSDC", tvl: "$1.84M", volume: "$2.31M", fee: "0.05%" },
          { pair: "MON / WMON", tvl: "$962K", volume: "$648K", fee: "0.30%" },
          { pair: "dUSDC / WMON", tvl: "$1.12M", volume: "$540K", fee: "0.01%" },
          { pair: "shMON / dUSDC", tvl: "$488K", volume: "$312K", fee: "0.30%" },
          { pair: "WMON / shMON", tvl: "$406K", volume: "$221K", fee: "0.05%" },
          { pair: "MON / shMON", tvl: "$274K", volume: "$96K", fee: "0.01%" },
        ],
      },
      stats: {
        title: "Stats",
        body: "Volume and liquidity across every NovaSwap pool, updated each block.",
        chart: {
          title: "Daily volume",
          caption: "Last 14 days, in millions of dollars.",
          unit: "$M",
          days: ["19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "1", "2"],
          values: [2.1, 2.6, 2.3, 3.0, 2.8, 3.4, 3.1, 2.9, 3.6, 3.9, 3.5, 4.0, 3.8, 4.2],
        },
        top: {
          title: "Totals",
          items: [
            { label: "Total liquidity", value: "$5.09M" },
            { label: "Swaps in 24h", value: "18,420" },
            { label: "Wallets in 24h", value: "3,912" },
            { label: "Average swap", value: "$228" },
          ],
        },
      },
      docs: {
        title: "Docs",
        body: "How a NovaSwap swap works, which contract it calls, and what it costs.",
        toc: "On this page",
        contract: {
          label: "Router contract",
          note: "Every NovaSwap swap calls this address. Compare it with the one your wallet shows before you sign.",
        },
        sections: [
          {
            id: "how-it-works",
            title: "How a swap works",
            body: "You send MON to the router with the smallest amount of dUSDC you accept. The router trades it through the best pool and sends the dUSDC to your wallet, all in one transaction.",
          },
          {
            id: "slippage",
            title: "Slippage",
            body: "If the price moves past your limit before the swap lands, the transaction reverts and your MON stays in your wallet. The default limit is 0.5%.",
          },
          {
            id: "fees",
            title: "Fees",
            body: "Each pool charges its own fee, shown on the Pools page. NovaSwap adds a 0.05% protocol fee. Both are already in the rate you see.",
          },
          {
            id: "approvals",
            title: "Approvals",
            body: "Swapping native MON needs no allowance. Swapping a token asks for an allowance on that token only, for the amount you swap.",
          },
        ],
      },
    },
  },

  analysis: {
    modes: {
      safe: {
        label: "Honest version",
        body: "The swap calls the NovaSwap router. Your MON goes in, and the dUSDC comes back to your wallet.",
        asks: "NovaSwap wants you to swap MON for dUSDC on {contract}.",
        call: "swapMonForUsdc(minOut)",
        expected: "safe",
        expectedBody:
          "No rule should fire. The simulation should show MON out and dUSDC in, both in your own wallet.",
      },
      danger: {
        label: "Attack version",
        body: "The card asks you to enable dUSDC trading. That is an unlimited dUSDC allowance to a look-alike router, which can take your whole balance.",
        asks: "NovaSwap wants you to let {contract} spend all of your dUSDC.",
        call: "approve(spender, unlimited)",
        expected: "blocked",
        expectedBody:
          "Two rules should fire. The allowance has no limit, and the spender is on Baret's reported list. Balanced rules block both.",
      },
    },
    claims: [
      {
        claim: "Your dUSDC goes straight to the wallet you connected.",
        check: "Baret simulates the swap and shows which wallet receives the dUSDC.",
      },
      {
        claim: "Enable trading once, then swap freely.",
        check: "Baret reads the allowance: who can spend your dUSDC, and how much.",
      },
      {
        claim: "Routed through the NovaSwap router.",
        check: "Baret checks the contract you actually call against the reputation registry.",
      },
      {
        claim: "$4.2M traded in the last 24 hours.",
        check: "Not checked. Volume on a page is not evidence of anything.",
      },
    ],
    watch: {
      title: "Before you press Swap",
      body: "The honest swap asks for MON. The attack asks for permission over all of your dUSDC. Read who gets the allowance, and how much.",
    },
    without: {
      title: "If this were signed",
      body: 'Nothing would move at first. The next "swap" would let the look-alike take your whole dUSDC balance, and it would not come back.',
    },
    lesson: {
      title: "Permission is the payment",
      body: "An unlimited allowance lets the spender take everything, later, without asking again. Approve the amount you sell, to the contract you meant.",
    },
  },

  /**
   * Live mode only (a developer set VITE_BARET_DEMO_FROM): the page has an
   * address to simulate from but no wallet to read, so it never shows the
   * sample balance as that address's.
   */
  live: {
    wallet: "Test address",
    balance: "Balance shows once a wallet connects",
  },

  /**
   * "Sign with your wallet" on the swap card (demoFrame.sign): the request
   * Baret's panel checks, sent to the connected wallet. The attack signs two
   * steps, the allowance and then the "swap" that drains. The visitor takes
   * test dUSDC from the faucet first.
   */
  sign: {
    token: "dUSDC",
    /** One label per step, in order; {amount} is what the card holds. */
    steps: {
      safe: ["Swap {amount} MON for dUSDC"],
      danger: ["Enable dUSDC trading", "Swap {amount} dUSDC"],
    },
    faucet: {
      body: "The attack sells dUSDC, so take some first. It is free and has no value.",
      label: "Get 100 test dUSDC",
      busy: "Confirm in {wallet}...",
      pending: "Getting test dUSDC...",
      done: "100 test dUSDC received.",
    },
    /** The attack with no dUSDC in the wallet: the sign button is disabled and says this. */
    empty: "This wallet holds no dUSDC. Get 100 test dUSDC above first.",
    outcome: {
      safe: "The router paid the dUSDC into your wallet.",
      danger:
        "The look-alike router took your whole dUSDC balance and paid nothing back. It went to an address nobody holds the key to.",
      /** After the attack, or when the swap was declined after the allowance went through. */
      open: "The unlimited allowance to the look-alike stays open. It can take any dUSDC this wallet receives later.",
      next: "Press Enable dUSDC trading to see what Baret says about the same request.",
    },
    /** In Baret's panel, in place of "If this were signed", once the attack was signed here with no check. */
    panel: {
      title: "When you signed it with no check",
      body: "Your dUSDC went from {before} to {after}. The look-alike used the allowance this request asks for.",
    },
  },
} as const satisfies ScenarioSite & {
  live: { wallet: string; balance: string };
  sign: {
    token: string;
    steps: Record<"safe" | "danger", readonly string[]>;
    faucet: { body: string; label: string; busy: string; pending: string; done: string };
    empty: string;
    outcome: { safe: string; danger: string; open: string; next: string };
    panel: { title: string; body: string };
  };
};

export type NovaswapContent = typeof novaswap;
