import { hub } from "./hub.content.js";
import type { ScenarioSite, SiteSign } from "./types.js";

/**
 * /pixeldrop on apps/showcase. Drainer.
 *
 * Story: a mint page. Buyers expect to sign fast during a drop, which is why
 * a drainer dresses up as one.
 *
 * Honest version: mint(1), payable, 0.01 MON, on the demo Night Shift
 * collection. One piece in, no lasting permission. Expected Safe, no findings.
 * Needs: the collection on a list Baret reads; price 0.01 MON and 10 per
 * wallet to match the page.
 *
 * Attack version: the same button calls setApprovalForAll(operator, true) on
 * the same collection. Nothing is minted. Expected Blocked. Codes:
 *   NFT_OPERATOR_GRANTED       always, from the calldata; blockSetApprovalForAll
 *   KNOWN_MALICIOUS_ADDRESS    only if the demo operator is on the blocklist
 * A visitor who holds no piece yet still sees it: the grant covers pieces
 * minted later.
 *
 * Watch for -> source:
 *   1 access to a whole collection  NFT_OPERATOR_GRANTED
 *   2 operator on the blocklist     KNOWN_MALICIOUS_ADDRESS (seeded)
 *   3 a mint where no piece arrives What changes (estimatedChanges)
 */

export const pixeldrop = {
  meta: {
    title: "PixelDrop mint scenario · Baret",
    description:
      "A simulated NFT mint on Monad testnet whose mint button hands a stranger your whole collection. See what Baret checks before you sign.",
  },

  /** The card on the hub and the landing (web/hub.content.ts `sites`). */
  scenario: hub.sites[2],

  site: {
    brand: "PixelDrop",
    hostname: "pixeldrop.example",
    nav: ["Mint", "Collection", "Roadmap", "Team"],
    /** The fake site's wallet control. Pressing it fills in a sample address. */
    connect: { label: "Connect wallet", connected: "Sample wallet" },
    hero: {
      badge: "Public mint is open",
      title: "Night Shift",
      body: "Five thousand city scenes after dark, generated on-chain. The metadata lives on Monad, not on a server.",
      cta: "Mint for 0.01 MON",
    },
    panel: {
      title: "Mint",
      input: "Quantity",
      rows: [
        { label: "Price", value: "0.01 MON" },
        { label: "Per wallet", value: "Up to 10" },
        { label: "Minted", value: "3,847 of 5,000" },
      ],
      cta: "Mint",
      note: "One signature. Your piece lands in your wallet in the same transaction.",
      start: "1",
      errors: { empty: "Enter how many to mint, from 1 to 10.", tooHigh: "Up to 10 per wallet." },
    },
    stats: [
      { value: "5,000", label: "pieces" },
      { value: "214", label: "traits" },
      { value: "0.01 MON", label: "mint price" },
    ],
    sections: [
      {
        title: "Generated at mint",
        body: "Each piece is drawn the moment you mint it. The contract combines the traits and stores the result on-chain.",
      },
      {
        title: "Roadmap",
        body: "Public mint first. A rarity explorer next. Holders vote on the second drop.",
      },
    ],
    faq: [
      {
        question: "Why does minting need a signature?",
        answer: "Every mint is a transaction, so your wallet asks you to confirm it.",
      },
      {
        question: "Can I list right after minting?",
        answer: "Yes. Marketplaces can list your piece as soon as it lands.",
      },
      { question: "How many can I mint?", answer: "Up to 10 per wallet." },
    ],
    progress: ["Preparing your mint", "Confirm in your wallet", "Minting", "Minted"],
    done: {
      title: "Minted",
      body: "Your Night Shift piece is in your wallet. Welcome to the collection.",
    },
    footer: "Night Shift is a PixelDrop collection on Monad.",
    attack: {
      switch: {
        label: "Suspicious mint",
        off: "Off. Mint calls mint on the Night Shift contract.",
        on: "On. The same button asks for access to your whole Night Shift collection and mints nothing. This is the attack version.",
      },
    },
    pages: {
      sampleNote: "Sample figures. This demo site has no live collection data.",
      views: [
        {
          id: "collection",
          kind: "table",
          title: "Collection",
          body: "Five thousand pieces, each drawn at mint from these traits. A rare trait shows up in fewer pieces.",
          columns: ["Trait", "Variants", "Rarest", "Share"],
          rows: [
            ["Skyline", "38", "Crane at dusk", "0.8%"],
            ["Weather", "22", "Sodium fog", "1.2%"],
            ["Light", "30", "One window lit", "0.6%"],
            ["Street", "46", "Night bus", "1.9%"],
            ["Figure", "64", "Watchman", "0.4%"],
            ["Frame", "14", "Steel", "4.1%"],
          ],
        },
        {
          id: "roadmap",
          kind: "list",
          title: "Roadmap",
          body: "What comes after the public mint. Holders decide the last step.",
          items: [
            {
              label: "Now",
              title: "Public mint",
              body: "5,000 pieces at 0.01 MON, up to 10 per wallet. Each piece is drawn the moment it is minted.",
            },
            {
              label: "Next",
              title: "Rarity explorer",
              body: "Search the collection by trait and see how many pieces share each one.",
            },
            {
              label: "Later",
              title: "Second drop",
              body: "Holders vote on the theme of the second collection. One piece, one vote.",
            },
          ],
        },
        {
          id: "team",
          kind: "list",
          title: "Team",
          body: "Three people make Night Shift. All three work on it full time.",
          items: [
            {
              label: "Generative art",
              title: "Ines Varga",
              body: "Writes the trait system and the drawing code that runs at mint.",
            },
            {
              label: "Contracts",
              title: "Tomas Reyes",
              body: "Wrote the mint contract and the on-chain metadata store.",
            },
            {
              label: "Community",
              title: "Mara Lind",
              body: "Runs the holder votes and answers questions about the drop.",
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
        body: "The button calls mint. You pay 0.01 MON and one piece arrives. No lasting permission is granted.",
        asks: "PixelDrop wants you to mint one piece on {contract} for 0.01 MON.",
        call: "mint(1)",
        many: {
          asks: "PixelDrop wants you to mint {count} pieces on {contract} for {price} MON.",
          call: "mint({count})",
          expectedBody:
            "No rule should fire. The simulation should show {price} MON out and {count} pieces in.",
        },
        expected: "safe",
        expectedBody:
          "No rule should fire. The simulation should show 0.01 MON out and one piece in.",
      },
      danger: {
        label: "Attack version",
        body: "The same button gives another address access to every Night Shift piece you hold. Nothing is minted.",
        asks: "PixelDrop wants you to give {operator} access to your whole collection.",
        call: "setApprovalForAll(operator, true)",
        expected: "blocked",
        expectedBody:
          "Balanced rules block collection-wide access, so that rule should fire. For this demo, the operator is also on Baret's reported list.",
      },
    },
    claims: [
      {
        claim: "One signature, one piece.",
        check: "Baret simulates the call and shows what arrives and what leaves.",
      },
      {
        claim: "Marketplaces can list your piece right away.",
        check: "Baret flags any signature that lets another address move your pieces.",
      },
      {
        claim: "The metadata lives on Monad, not on a server.",
        check: "Not checked. Baret reads the transaction, not the art.",
      },
    ],
    watch: {
      title: "Before you press Mint",
      body: "A mint moves a price out and one piece in. Any line about access to the collection is not part of minting.",
    },
    without: {
      title: "If this were signed",
      body: "No piece would arrive. The other address could move every Night Shift piece you hold, now and later, until you revoke it.",
    },
    lesson: {
      title: "A mint gives, it never borrows",
      body: "A mint sends one piece to you. Access to your whole collection is never part of minting.",
    },
  },
  sign: {
    token: "Night Shift pieces",
    steps: {
      safe: ["Mint {count} for {price} MON"],
      danger: ["Approve the collection to list it", "Take the approval back"],
    },
    outcome: {
      safe: "The collection sent your Night Shift mint to your wallet.",
      danger:
        "Between the two steps a reported address could move every Night Shift piece in this wallet. The second step closed it again, which no attack site would do. Press Mint to see what Baret says about the first request.",
    },
  },
} as const satisfies ScenarioSite & { sign: SiteSign };

export type PixeldropContent = typeof pixeldrop;
