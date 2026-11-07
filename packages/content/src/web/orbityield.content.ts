import { hub } from "./hub.content.js";
import type { ScenarioSite, SiteSign } from "./types.js";

/**
 * /orbityield on apps/showcase. Trust trap. Blocked under Balanced since
 * D-033 (2026-10-09); it was Caution before.
 *
 * Story: a staking page that promises a receipt token for every MON staked.
 * The page shows nothing wrong. The missing receipt is the only sign, and it
 * shows in the balance change, not on the page.
 *
 * Old versions claimed a check for "no unstake function" and "inflated TVL".
 * No detector does either, so this version is built on what the detectors
 * really see: which contract is called and what arrives.
 *
 * Honest version: stake(), payable, on the demo OrbitYield pool. oMON arrives
 * one to one; the pool has a working unstake. Expected Safe, no findings.
 * Needs: the pool on a list Baret reads.
 *
 * Attack version: the same button calls a second pool that is on no list,
 * keeps the MON and sends no oMON. Expected Blocked under Balanced: a
 * payment an unknown contract keeps is blocked by blockRiskyContracts (D-033).
 * Caution under Permissive. Codes:
 *   VALUE_KEPT_BY_UNKNOWN_CONTRACT  MON out, nothing in, from a contract on
 *                                no list; blockRiskyContracts
 *   UNKNOWN_CONTRACT_EXPOSURE    needs the known-contract list to be in use;
 *                                blockUnknownContractExposure (off in Balanced)
 *   ESTIMATED_LOSS_EXCEEDS_MAX   only when the amount typed crosses the
 *                                visitor's loss limit; then Blocked
 *
 * Watch for -> source:
 *   1 a pool Baret does not know  UNKNOWN_CONTRACT_EXPOSURE
 *   2 MON out, no oMON in         What changes (estimatedChanges)
 *   3 loss above your limit       ESTIMATED_LOSS_EXCEEDS_MAX (amount-dependent)
 */

export const orbityield = {
  meta: {
    title: "OrbitYield staking scenario · Baret",
    description:
      "A simulated staking pool on Monad testnet that keeps your deposit and sends no receipt token. See what Baret checks before you stake.",
  },

  /** The card on the hub and the landing (web/hub.content.ts `sites`). */
  scenario: hub.sites[3],

  site: {
    brand: "OrbitYield",
    hostname: "orbityield.example",
    nav: ["Stake", "Rewards", "Stats", "Security"],
    /** The fake site's wallet control. Pressing it fills in a sample address. */
    connect: { label: "Connect wallet", connected: "Sample wallet" },
    hero: {
      badge: "Rewards every block",
      title: "Stake MON. Keep it liquid.",
      body: "Stake MON and receive oMON one to one. Trade or lend your oMON while the stake keeps earning. No lock-up.",
      cta: "Stake MON",
    },
    panel: {
      title: "Stake",
      input: "Amount of MON",
      rows: [
        { label: "You stake", value: "MON" },
        { label: "You receive", value: "oMON, one to one" },
        { label: "Current APY", value: "14.2%" },
        { label: "Unstaking period", value: "None" },
      ],
      cta: "Stake",
      note: "oMON arrives in your wallet in the same transaction.",
      balance: "Balance",
      max: "Max",
      /** Under most faucet grants, so a judge's fresh account can stake it. */
      start: "0.02",
      errors: {
        empty: "Enter an amount of MON.",
        tooHigh: "That is more MON than this wallet holds.",
      },
    },
    stats: [
      { value: "$18.7M", label: "total staked" },
      { value: "14.2%", label: "current APY" },
      { value: "2,104", label: "stakers" },
    ],
    sections: [
      {
        title: "Built on audited code",
        body: "OrbitYield forks a staking design that has run for two years. The core logic is unchanged.",
      },
      {
        title: "Where the yield comes from",
        body: "Staking rewards, paid out every block and added to the value of your oMON.",
      },
    ],
    faq: [
      { question: "Can I unstake at any time?", answer: "Yes. There is no lock-up." },
      {
        question: "Is the contract audited?",
        answer: "The original design was audited. Our fork keeps the same core.",
      },
      {
        question: "What is oMON?",
        answer: "A receipt for your stake. Hold it, trade it, or return it to unstake.",
      },
    ],
    progress: ["Preparing your stake", "Confirm in your wallet", "Staking", "Staked"],
    done: {
      title: "Staked",
      body: "Your MON is earning. Your oMON will show in your wallet shortly.",
    },
    footer: "OrbitYield is a liquid staking pool on Monad.",
    attack: {
      switch: {
        label: "Suspicious pool",
        off: "Off. Stake sends your MON to the OrbitYield pool Baret knows.",
        on: "On. The same button sends your MON to a second pool that is on no list. This is the attack version.",
      },
    },
    pages: {
      sampleNote: "Sample figures. This demo site has no live staking data.",
      views: [
        {
          id: "rewards",
          kind: "table",
          title: "Rewards",
          body: "Rewards are paid every block and added to the value of your oMON. Here are the last five epochs.",
          columns: ["Epoch", "APY", "Paid out", "Stakers"],
          rows: [
            ["41", "14.2%", "21,840 MON", "2,104"],
            ["40", "13.9%", "20,970 MON", "2,051"],
            ["39", "14.6%", "20,310 MON", "1,987"],
            ["38", "15.1%", "19,450 MON", "1,902"],
            ["37", "14.8%", "18,120 MON", "1,844"],
          ],
        },
        {
          id: "stats",
          kind: "chart",
          title: "Stats",
          body: "Total staked in the pool, by day.",
          chart: {
            title: "Total staked",
            caption: "Last 14 days, in millions of dollars.",
            unit: "$M",
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
              14.1, 14.6, 15, 15.2, 15.9, 16.1, 16.4, 16.8, 17, 17.3, 17.9, 18.2, 18.4, 18.7,
            ],
          },
          top: {
            title: "Totals",
            items: [
              { label: "Total staked", value: "$18.7M" },
              { label: "Stakers", value: "2,104" },
              { label: "oMON in circulation", value: "6.24M" },
              { label: "Rewards paid in 30 days", value: "$212K" },
            ],
          },
        },
        {
          id: "security",
          kind: "docs",
          title: "Security",
          body: "How OrbitYield keeps your stake safe, in our own words.",
          toc: "On this page",
          sections: [
            {
              id: "audits",
              title: "Audits",
              body: "OrbitYield forks a staking design that two firms audited. We kept the core logic and changed the fee settings.",
            },
            {
              id: "unstaking",
              title: "Unstaking",
              body: "Return oMON to the pool at any time and your MON comes back in the same transaction. There is no queue.",
            },
            {
              id: "admin-keys",
              title: "Admin keys",
              body: "A three of five multisig can pause new deposits. It cannot move staked MON.",
            },
            {
              id: "bug-bounty",
              title: "Bug bounty",
              body: "Report a bug in the pool contract and we pay up to 50,000 MON from the treasury.",
            },
          ],
        },
      ],
    },
  },

  analysis: {
    modes: {
      safe: {
        label: "Honest version",
        body: "The deposit goes to the OrbitYield pool Baret knows. oMON comes back one to one, and the pool lets you unstake.",
        asks: "OrbitYield wants you to stake MON on {contract}.",
        call: "stake()",
        expected: "safe",
        expectedBody:
          "No rule should fire. The simulation should show MON out and the same amount of oMON in.",
      },
      danger: {
        label: "Attack version",
        body: "The same button sends your MON to a second pool that is on no list. It keeps the deposit and sends no oMON.",
        asks: "OrbitYield wants you to stake MON on {contract}.",
        call: "stake()",
        expected: "blocked",
        expectedBody:
          "Balanced rules block a payment to an unknown contract that gives nothing back. The simulation should show MON out and no oMON in. Under Permissive it is a Caution.",
      },
    },
    claims: [
      {
        claim: "You receive oMON one to one.",
        check: "Baret simulates the deposit and lists every token that arrives.",
      },
      {
        claim: "Built on audited code.",
        check: "Not checked. An audit of the original says nothing about this deployment.",
      },
      {
        claim: "14.2% APY.",
        check:
          "Not checked. Baret reads what the transaction does now, not what a page promises later.",
      },
    ],
    watch: {
      title: "Before you press Stake",
      body: "The page shows nothing wrong, and that is the point. Look at what arrives for what you send: here nothing does, so Balanced rules block it.",
    },
    without: {
      title: "If this were signed",
      body: "Your MON would sit in a pool with no receipt to show for it. Getting it back would depend on whoever controls that pool.",
    },
    lesson: {
      title: "Check the receipt",
      body: "When a deposit promises a receipt, check that the receipt arrives. A missing receipt is the first sign of a one-way door.",
    },
  },
  /** Live mode, with no wallet: the sample's 25 MON is never shown. */
  live: { balance: "Connect a wallet to see your balance" },

  sign: {
    token: "oMON",
    steps: {
      safe: ["Stake {amount} MON"],
      danger: ["Stake {amount} MON"],
    },
    outcome: {
      safe: "The pool paid oMON into your wallet, one for each MON.",
      danger:
        "The pool kept your MON and paid nothing back: the oMON balance did not move. Press Stake to see what Baret says about the same request.",
    },
  },
} as const satisfies ScenarioSite & { sign: SiteSign; live: { balance: string } };

export type OrbityieldContent = typeof orbityield;

/** Token unit the stake box prints beside its figures. */
export const orbityieldUnits = { stake: "MON" } as const;
