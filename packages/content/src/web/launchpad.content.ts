import { hub } from "./hub.content.js";
import type { ScenarioSite, SiteSign } from "./types.js";

/**
 * /launchpad on apps/showcase. Trust trap. Blocked under Balanced since
 * D-033 (2026-10-09); it was Caution before.
 *
 * Story: a polished token sale. The tokens really arrive. The risk is what the
 * deployer can change after the sale, and that shows in the call trace, not
 * on the page.
 *
 * Old versions claimed checks for "admin key kept" and "LP not locked". No
 * detector reads either, so this version uses what the evm-danger detector
 * does see: the sale runs borrowed code (a proxy the deployer can repoint).
 *
 * Honest version: contribute(), payable, on a plain sale contract with fixed
 * code. LNTL arrives in the same transaction. Expected Safe, no findings.
 * Needs: the sale contract on a list Baret reads; 0.001 MON per LNTL,
 * minimum 0.01 MON, maximum 1 MON per wallet to match the page.
 *
 * Attack version: the same button calls a sale proxy that delegatecalls into
 * an implementation its deployer can replace. LNTL still arrives. Expected
 * Blocked under Balanced, which blocks borrowed code since D-033; Caution
 * under Permissive. Codes:
 *   DELEGATECALL_DETECTED        needs a call trace (debug_traceCall on the
 *                                Monad RPC); blockDelegatecall, on in Balanced
 *   UNKNOWN_CONTRACT_EXPOSURE    proxy and implementation on no list;
 *                                blockUnknownContractExposure (off in Balanced)
 *   ESTIMATED_LOSS_EXCEEDS_MAX   only when the amount typed crosses the
 *                                visitor's loss limit; then Blocked
 * If no trace is available, expect LOW_CONFIDENCE_INCOMPLETE_DATA instead of
 * DELEGATECALL_DETECTED.
 *
 * Watch for -> source:
 *   1 borrowed code              DELEGATECALL_DETECTED
 *   2 a sale Baret does not know UNKNOWN_CONTRACT_EXPOSURE
 *   3 loss above your limit      ESTIMATED_LOSS_EXCEEDS_MAX (amount-dependent)
 */

export const launchpad = {
  meta: {
    title: "LaunchPad token sale scenario · Baret",
    description:
      "A simulated token sale on Monad testnet whose contract runs code its deployer can replace after you pay. See what Baret checks before you buy.",
  },

  /** The card on the hub and the landing (web/hub.content.ts `sites`). */
  scenario: hub.sites[5],

  site: {
    brand: "LaunchPad",
    hostname: "launchpad.example",
    nav: ["Sale", "Tokenomics", "Vesting", "Team"],
    /** The fake site's wallet control. Pressing it fills in a sample address. */
    connect: { label: "Connect wallet", connected: "Sample wallet" },
    hero: {
      badge: "Reviewed launch",
      title: "Lintel public sale",
      body: "Fixed price, no tiers, no allowlist. LNTL arrives in your wallet the moment you contribute.",
      cta: "Buy LNTL",
    },
    panel: {
      title: "Contribute",
      input: "Amount of MON",
      rows: [
        { label: "Price", value: "0.001 MON per LNTL" },
        { label: "Minimum", value: "0.01 MON" },
        { label: "Maximum per wallet", value: "1 MON" },
        { label: "Raised", value: "8,420 of 10,000 MON" },
      ],
      cta: "Contribute",
      note: "LNTL is sent to you in the same transaction.",
      receive: "You receive",
      /** Under most faucet grants, so a judge's fresh account can contribute it. */
      start: "0.02",
      errors: {
        empty: "Enter an amount of MON.",
        tooLow: "The minimum is 0.01 MON.",
        tooHigh: "The maximum is 1 MON per wallet.",
      },
    },
    stats: [
      { value: "8,420 MON", label: "raised" },
      { value: "1,318", label: "contributors" },
      { value: "2 days", label: "left in the sale" },
    ],
    sections: [
      {
        title: "Tokenomics",
        body: "40% public sale, 25% liquidity, 20% team, 15% treasury.",
      },
      {
        title: "Team tokens vest over 24 months",
        body: "The team allocation is locked for six months, then releases monthly.",
      },
      {
        title: "Every launch is reviewed",
        body: "Projects submit their contracts before listing. We check the supply, the vesting and the liquidity plan.",
      },
    ],
    faq: [
      {
        question: "When do I get my tokens?",
        answer: "In the same transaction as your contribution.",
      },
      {
        question: "Can the contract change after the sale?",
        answer: "The sale follows the contract we reviewed.",
      },
      { question: "Is there a minimum?", answer: "Yes, 0.01 MON per wallet." },
    ],
    progress: ["Preparing your order", "Confirm in your wallet", "Buying", "Contribution received"],
    done: {
      title: "Contribution received",
      body: "Your LNTL is in your wallet. Trading opens when the sale closes.",
    },
    footer: "LaunchPad lists reviewed token sales on Monad.",
    attack: {
      switch: {
        label: "Suspicious sale",
        off: "Off. Contribute pays a plain sale contract with fixed code.",
        on: "On. The same button pays a sale contract that runs code its deployer can replace. This is the attack version.",
      },
    },
    pages: {
      sampleNote: "Sample figures. This demo site has no live sale data.",
      views: [
        {
          id: "tokenomics",
          kind: "shares",
          title: "Tokenomics",
          body: "Lintel has a fixed supply of 25,000,000 LNTL. Here is where it goes.",
          items: [
            {
              label: "Public sale",
              value: 40,
              body: "10,000,000 LNTL at 0.001 MON each, sold on this page.",
            },
            {
              label: "Liquidity",
              value: 25,
              body: "Paired with MON when trading opens, so there is a market on day one.",
            },
            {
              label: "Team",
              value: 20,
              body: "Locked for six months, then released monthly over 18 months.",
            },
            {
              label: "Treasury",
              value: 15,
              body: "Held for grants and listings, and spent by a holder vote.",
            },
          ],
        },
        {
          id: "vesting",
          kind: "table",
          title: "Vesting",
          body: "When each allocation unlocks. Month zero is the day trading opens.",
          columns: ["Allocation", "At launch", "Cliff", "Release"],
          rows: [
            ["Public sale", "100%", "None", "All at launch"],
            ["Liquidity", "100%", "None", "Added to the pool"],
            ["Team", "0%", "6 months", "Monthly over 18 months"],
            ["Treasury", "10%", "None", "By holder vote"],
          ],
        },
        {
          id: "team",
          kind: "list",
          title: "Team",
          body: "The people behind Lintel. Every launch on LaunchPad names its team.",
          items: [
            {
              label: "Founder",
              title: "Ada Morel",
              body: "Built payment tools for small shops before Lintel.",
            },
            {
              label: "Contracts",
              title: "Jonas Vik",
              body: "Wrote the sale contract and the vesting contract.",
            },
            {
              label: "Growth",
              title: "Noor Haddad",
              body: "Runs the listings and the treasury votes.",
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
        body: "The contribution goes to a plain sale contract with fixed code. LNTL arrives in the same transaction.",
        asks: "LaunchPad wants you to buy LNTL on {contract}.",
        call: "contribute()",
        expected: "safe",
        expectedBody:
          "No rule should fire. The simulation should show MON out, LNTL in, and no code borrowed from another contract.",
      },
      danger: {
        label: "Attack version",
        body: "The same button pays a sale contract that runs code from another contract. Its deployer can swap that code at any time. LNTL still arrives.",
        asks: "LaunchPad wants you to buy LNTL on {contract}.",
        call: "contribute()",
        expected: "blocked",
        expectedBody:
          "Borrowed code and an unknown contract should both show up. Balanced rules block borrowed code, so nothing is signed. Under Permissive it is a Caution.",
      },
    },
    claims: [
      {
        claim: "Every launch is reviewed.",
        check: "Not checked. A review badge is something the page says about itself.",
      },
      {
        claim: "The sale follows the contract we reviewed.",
        check: "Baret traces the call and flags code that runs from another contract.",
      },
      {
        claim: "LNTL arrives in the same transaction.",
        check: "Baret simulates the purchase and lists what arrives.",
      },
    ],
    watch: {
      title: "Before you press Contribute",
      body: "Tokens that arrive today say little about next week. Read why Baret blocks it: the code that ran can be replaced after you pay.",
    },
    without: {
      title: "If this were signed",
      body: "LNTL would arrive and the page would look fine. Your MON would sit behind code the deployer can replace whenever they choose.",
    },
    lesson: {
      title: "Ask who can change it",
      body: "A sale page describes launch day. Check whether the code that holds your money can change after it.",
    },
  },
  sign: {
    token: "LNTL",
    steps: {
      safe: ["Contribute {amount} MON"],
      danger: ["Contribute {amount} MON"],
    },
    outcome: {
      safe: "The sale sent LNTL to your wallet.",
      danger:
        "This sale paid LNTL today. Its code is borrowed from a contract its owner can replace, so it may not pay for the next contribution. Press Contribute to see what Baret says about the same request.",
    },
  },
} as const satisfies ScenarioSite & { sign: SiteSign };

export type LaunchpadContent = typeof launchpad;

/** Token units the contribution box prints beside its figures. */
export const launchpadUnits = { pay: "MON", receive: "LNTL" } as const;
