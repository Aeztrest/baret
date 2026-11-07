import { hub } from "./hub.content.js";
import type { ScenarioSite, SiteSign } from "./types.js";

/**
 * /claimhub on apps/showcase. Drainer. The hub's first stop.
 *
 * Story: an airdrop page. The eligibility check is theatre. What the claim
 * button builds is the whole scenario.
 *
 * Honest version: claim() on the demo distributor. HUB arrives, nothing of
 * yours can be spent later. Expected Safe, no findings. Needs: the distributor
 * on a list Baret reads (or UNKNOWN_CONTRACT_EXPOSURE turns it into Caution),
 * repeat claims allowed per address (or the second try reverts), 2,410 HUB
 * sent per claim to match the page.
 *
 * Attack version: approve(spender, max uint256) on the canonical test USDC.
 * Expected Blocked. Codes:
 *   APPROVAL_UNLIMITED   always, from the calldata; blockUnlimitedApprovals
 *   KNOWN_MALICIOUS_ADDRESS    only if the demo spender is on the registry
 *                              blocklist; blockKnownMalicious
 * The approval simulates fine with a zero USDC balance, so a visitor with
 * only faucet MON still sees it.
 *
 * Watch for -> source:
 *   1 unlimited allowance         APPROVAL_UNLIMITED
 *   2 spender on the blocklist    KNOWN_MALICIOUS_ADDRESS (seeded)
 *   3 nothing arriving            What changes (estimatedChanges): no HUB in
 */

export const claimhub = {
  meta: {
    title: "ClaimHub airdrop scenario · Baret",
    description:
      "A simulated airdrop on Monad testnet whose claim button asks for an unlimited allowance on your USDC. See what Baret checks before you sign.",
  },

  /** The card on the hub and the landing (web/hub.content.ts `sites`). */
  scenario: hub.sites[4],

  site: {
    brand: "ClaimHub",
    hostname: "claimhub.example",
    nav: ["Claim", "Eligibility", "Distribution", "FAQ"],
    /** The fake site's wallet control. Pressing it fills in a sample address. */
    connect: { label: "Connect wallet", connected: "Sample wallet" },
    hero: {
      badge: "Season 2 is live",
      title: "Your HUB rewards are ready",
      body: "Early ClaimHub users share a pool of 12,000,000 HUB. Check your wallet and claim before the window closes.",
      cta: "Check eligibility",
    },
    panel: {
      title: "Your allocation",
      input: "Or paste a wallet address",
      rows: [
        { label: "Status", value: "Eligible" },
        { label: "Allocation", value: "2,410 HUB" },
        { label: "Claim fee", value: "None, only the network fee" },
        { label: "Window", value: "Closes in 3 days" },
      ],
      cta: "Claim 2,410 HUB",
      note: "One signature. Your HUB arrives in the same transaction.",
      label: "Wallet address",
      hint: "Leave it empty to check the sample wallet.",
      /** The same hint once a real wallet is connected. */
      hintConnected: "Leave it empty to check the wallet you connected.",
      errors: {
        invalid: "That is not a wallet address. It starts with 0x and has 42 characters.",
      },
    },
    stats: [
      { value: "48,213", label: "wallets eligible" },
      { value: "12M", label: "HUB in the pool" },
      { value: "3 days", label: "left to claim" },
    ],
    sections: [
      {
        title: "How claiming works",
        body: "Connect the wallet you used before the snapshot. We read its activity and show your allocation. One signature sends the tokens to you.",
      },
      {
        title: "Why season 2 has a deadline",
        body: "Unclaimed HUB goes back to the community pool when the window closes. Claim early to keep your share.",
      },
    ],
    faq: [
      { question: "Is there a fee to claim?", answer: "No. You only pay the network fee in MON." },
      {
        question: "Why does my wallet ask for a permission?",
        answer: "The distributor needs it to deliver your tokens. Every claim works this way.",
      },
      {
        question: "What if I miss the window?",
        answer: "Unclaimed HUB returns to the pool for season 3.",
      },
    ],
    progress: ["Checking your wallet", "Confirm in your wallet", "Claiming", "Claimed"],
    done: {
      title: "Claim submitted",
      body: "Your 2,410 HUB are on the way. They can take a few minutes to show in your wallet.",
    },
    footer: "ClaimHub distributes season rewards to early users. Allocations are final.",
    attack: {
      switch: {
        label: "Suspicious claim",
        off: "Off. Claim calls claim on the ClaimHub distributor.",
        on: "On. The same button asks for an unlimited allowance on your USDC and sends no HUB. This is the attack version.",
      },
    },
    pages: {
      sampleNote: "Sample figures. This demo site has no live distribution data.",
      views: [
        {
          id: "eligibility",
          kind: "list",
          title: "Eligibility",
          body: "Season 2 rewards early ClaimHub users. Meet any one of these before the snapshot and you are in.",
          items: [
            {
              label: "Bridged",
              title: "Moved funds to Monad",
              body: "Any bridge transfer of 10 MON or more before the snapshot on September 1.",
            },
            {
              label: "Active",
              title: "Five or more transactions",
              body: "Five transactions on Monad testnet in the three months before the snapshot.",
            },
            {
              label: "Held",
              title: "A position for 30 days",
              body: "A token or NFT position held for 30 days in a row, in any app on Monad.",
            },
          ],
        },
        {
          id: "distribution",
          kind: "table",
          title: "Distribution",
          body: "How the 12,000,000 HUB in season 2 are split. Your tier depends on how many criteria you meet.",
          columns: ["Tier", "Criteria met", "Wallets", "HUB each"],
          rows: [
            ["Gold", "3", "1,245", "2,410"],
            ["Silver", "2", "3,983", "1,205"],
            ["Bronze", "1", "42,985", "97"],
          ],
        },
        {
          id: "faq",
          kind: "faq",
          title: "FAQ",
          body: "More about season 2, the snapshot and claiming.",
          items: [
            {
              question: "When was the snapshot?",
              answer: "On September 1. Activity after that date counts toward season 3.",
            },
            {
              question: "Can I claim to a different wallet?",
              answer: "No. HUB goes to the wallet that met the criteria.",
            },
            {
              question: "Can I move HUB right away?",
              answer: "Yes. HUB is transferable as soon as it is in your wallet.",
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
        body: "The claim button calls claim. HUB arrives in your wallet, and nothing of yours can be spent later.",
        asks: "ClaimHub wants you to claim HUB from {contract}.",
        call: "claim()",
        expected: "safe",
        expectedBody:
          "No rule should fire. The simulation should show HUB arriving and nothing leaving but the network fee.",
      },
      danger: {
        label: "Attack version",
        body: "The same button asks for an unlimited allowance on your USDC. No HUB is sent.",
        asks: "ClaimHub wants you to let {spender} spend all of your USDC.",
        call: "approve(spender, unlimited)",
        expected: "blocked",
        expectedBody:
          "Balanced rules block unlimited allowances, so that rule should fire. For this demo, the spender is also on Baret's reported list.",
      },
    },
    claims: [
      {
        claim: "One signature. Your HUB arrives in the same transaction.",
        check: "Baret simulates the signature and lists what arrives and what leaves.",
      },
      {
        claim: "The distributor needs a permission. Every claim works this way.",
        check: "Baret checks the size of every allowance and the address that receives it.",
      },
      {
        claim: "You are eligible for 2,410 HUB.",
        check: "Not checked. Eligibility is something the page says about itself.",
      },
    ],
    watch: {
      title: "Before you press Claim",
      body: "Look at what leaves your wallet, not at the button. A claim sends tokens to you. It never needs permission to take yours.",
    },
    without: {
      title: "If this were signed",
      body: "Nothing would leave at first. The spender could then take all of your USDC at any time, until you revoke the allowance.",
    },
    lesson: {
      title: "A claim sends, it never takes",
      body: "A real claim sends tokens to you. If a claim asks to spend your tokens, it is not a claim.",
    },
  },
  sign: {
    token: "HUB",
    steps: {
      safe: ["Claim 2,410 HUB"],
      danger: ["Verify your wallet to claim", "Take the allowance back"],
    },
    outcome: {
      safe: "The distributor sent the HUB to your wallet.",
      danger:
        "Between the two steps a reported address could take all the USDC in this wallet, and no HUB arrived. The second step set the allowance back to zero, which no attack site would do. Press Claim to see what Baret says about the first request.",
    },
  },
} as const satisfies ScenarioSite & { sign: SiteSign };

export type ClaimhubContent = typeof claimhub;
