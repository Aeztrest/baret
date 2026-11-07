/**
 * /showcase on apps/web. The index of the threat scenarios.
 *
 * Ported from Baret-Metropolis (showcase/hub.content.ts). Changes:
 *  - The six scenario cards live here (`sites`), not in each site's file, so
 *    the hub and the landing can render before the sites are ported. A site's
 *    page reads its own card from here.
 *  - Numbers come from the code (packages/chain-evm detector modules, POLICY_FIELDS).
 *  - The six sites run on Monad testnet today; that is said where it is a fact
 *    about the sites, never as a limit of Baret. Stellar and Casper scenarios
 *    join the catalogue as those adapters land (TASKS.md T3, T4).
 *  - The frame copy the scenario pages share (`frame` in Metropolis) moves with
 *    the demo kit (TASKS.md T2.4).
 *
 * Rules this page keeps:
 *  - No usage counts, no "attacks stopped".
 *  - A card's "Watch for" lines map to finding codes or rules the scenario
 *    really produces.
 *  - The expected verdict is always framed as expected.
 *  - The fake sites are fiction. They name no real company, token or person.
 */

export const hub = {
  meta: {
    title: "Threat showcase · Baret",
    description:
      "Six simulated sites on Monad testnet, each hiding a different trap in its transaction. Trigger one and see what Baret checks before you sign.",
  },

  hero: {
    title: "Six sites. Six traps. Read them before you sign.",
    body: "Each site looks finished and works like the real thing. Each one hides a different threat in the transaction it builds. Press its main button and see what Baret checks before anything is signed.",
    actions: {
      primary: { label: "See the six sites", href: "#scenarios" },
      secondary: { label: "Install the extension", href: "/install" },
    },
    notice:
      "These sites are simulations built for this showcase. They run on Monad testnet, where tokens have no value.",
  },

  stats: [
    { value: "6", label: "simulated sites" },
    { value: "3", label: "kinds of threat" },
    { value: "10", label: "detector modules on every EVM request" },
    { value: "26", label: "rules you can change" },
  ],

  /** The heading over the cards and their filter. */
  scenarios: {
    title: "Six sites, one trap each.",
  },

  /** The ids match `threatClass` on each card in `sites`. */
  filters: {
    label: "Show",
    /** Announced when the filter changes. */
    status: "{count} of 6 sites shown.",
    items: [
      { id: "all", label: "All six", body: "Every scenario on this page." },
      { id: "drainer", label: "Drainers", body: "Funds taken without consent." },
      { id: "trap", label: "Trust traps", body: "Looks legitimate, behaves otherwise." },
      { id: "agent", label: "Silent agents", body: "Pays while you sleep." },
    ],
  },

  /** Labels on every scenario card. */
  cardLabels: {
    watchFor: "Watch for",
    verdict: "Expected verdict",
    verdicts: {
      safe: "Safe",
      caution: "Caution",
      blocked: "Blocked",
      unreachable: "Can't reach Baret",
      capped: "Blocked at the cap",
    },
    open: "Open the site",
    /** Read after the site's name: every card opens the site in a new tab. */
    newTab: "(opens in a new tab)",
  },

  /**
   * One card per site, in the order the hub lists them. `slug` is the site's
   * path without the slash. `chain` is the CAIP-2 id the site's transactions
   * run on.
   */
  sites: [
    {
      slug: "scrybe",
      chain: "eip155:10143",
      name: "Scrybe",
      category: "Paid API",
      tagline: "Pay per answer, no account",
      summary:
        "A paid answer service that charges a small USDC payment per answer over x402. Nothing here is malicious. The question is what stops an agent that keeps asking.",
      watchFor: [
        "A payment above your cap per payment",
        "The payment that would take the last hour over your hourly cap",
        "The payment that would take the last day over your daily cap",
      ],
      threatClass: "agent",
      whyItMatters:
        "Agent payments repeat by design. No single payment looks wrong, so the running total is the only place a leak shows.",
      verdict: "capped",
    },
    {
      slug: "novaswap",
      chain: "eip155:10143",
      name: "NovaSwap",
      category: "Exchange",
      tagline: "Swap MON for dUSDC in one step",
      summary:
        'A clean swap page. In the attack version, "enable trading" is an unlimited dUSDC allowance to a look-alike router that can empty your balance.',
      watchFor: [
        "An unlimited allowance the swap does not need",
        "A spender one character off the real router",
        "A spender on Baret's reported list",
      ],
      threatClass: "drainer",
      whyItMatters:
        "The approval moves nothing, so the page looks fine. The drain comes later, through the allowance.",
      verdict: "blocked",
    },
    {
      slug: "pixeldrop",
      chain: "eip155:10143",
      name: "PixelDrop",
      category: "NFT mint",
      tagline: "Night Shift, 5,000 pieces, generated on Monad",
      summary:
        "A clean mint page for a generative collection. In the attack version, the mint button mints nothing. It gives a stranger access to every piece you hold in the collection.",
      watchFor: [
        "Access to a whole collection, not one piece",
        "An operator on Baret's reported list",
        "A mint where no piece arrives",
      ],
      threatClass: "drainer",
      whyItMatters:
        "One signature covers every piece you hold in the collection, including pieces you get later. It stays until you revoke it.",
      verdict: "blocked",
    },
    {
      slug: "orbityield",
      chain: "eip155:10143",
      name: "OrbitYield",
      category: "Staking",
      tagline: "Liquid staking at 14.2% APY",
      summary:
        "A staking page that pays a receipt token for every MON you stake. In the attack version, the deposit goes to a pool nobody vouches for, and no receipt comes back.",
      watchFor: [
        "A pool contract Baret does not know",
        "MON leaving with no receipt token arriving",
        "A deposit above the loss limit in your rules",
      ],
      threatClass: "trap",
      whyItMatters:
        "The page shows nothing wrong. The missing receipt is the only sign, and it shows in the balance change, not on the page.",
      verdict: "blocked",
    },
    {
      slug: "claimhub",
      chain: "eip155:10143",
      name: "ClaimHub",
      category: "Airdrop",
      tagline: "Season 2 rewards, claimed in one step",
      summary:
        "An airdrop page with a countdown and an eligibility check. In the attack version, the claim button asks for an unlimited allowance that lets a stranger take your USDC.",
      watchFor: [
        "An unlimited allowance on your USDC",
        "A spender on Baret's reported list",
        "A claim where no tokens arrive",
      ],
      threatClass: "drainer",
      whyItMatters:
        "Signing an allowance moves nothing at first. The spender takes your tokens later, whenever it decides, until you revoke it.",
      verdict: "blocked",
    },
    {
      slug: "launchpad",
      chain: "eip155:10143",
      name: "LaunchPad",
      category: "Token sale",
      tagline: "Reviewed launches on Monad",
      summary:
        "A polished token sale with a countdown and a tokenomics chart. In the attack version, your tokens still arrive, but the sale runs code its deployer can replace after you pay.",
      watchFor: [
        "A sale that runs code borrowed from another contract",
        "A sale contract Baret does not know",
        "A contribution above the loss limit in your rules",
      ],
      threatClass: "trap",
      whyItMatters:
        "Nothing goes wrong on the day you buy. The risk is what the deployer can change after the sale closes.",
      verdict: "blocked",
    },
  ],

  steps: {
    title: "Four steps, one sign request",
    /** Accessible name of the step picker. */
    legend: "Pick a step",
    /** Above the picked step's title, beside its large drawing. */
    counter: "Step {n} of {total}",
    items: [
      {
        short: "Connect",
        title: "Connect a wallet",
        body: "The Baret extension or any wallet in the picker. The sites run on Monad testnet, where tokens have no value.",
      },
      {
        short: "Pick a version",
        title: "Pick a version",
        body: "Every site has an honest version and an attack version. The page looks the same in both. Only the transaction changes.",
      },
      {
        short: "Press",
        title: "Press the main button",
        body: "Swap, mint, stake, claim, buy or ask. The site builds a real transaction and sends it to Baret's check before any wallet sees it.",
      },
      {
        short: "Read",
        title: "Read the verdict",
        body: "Baret simulates it, runs its detectors and your rules, and answers Safe, Caution or Blocked. Each finding comes with a reason.",
      },
    ],
  },

  comparison: {
    title: "Same request, with and without a check.",
    body: "On NovaSwap the attack's request can go two ways. Sign with your wallet sends it straight to the wallet you use today; sign both steps and the dUSDC leaves. The site's own button sends the same request through Baret's check first, and it is stopped before anything is signed. No wallet is singled out here. Baret is a check any wallet can call before it signs.",
    columns: { without: "A wallet with no pre-sign check", with: "With Baret's check" },
    rows: [
      {
        aspect: "The NovaSwap attack",
        without:
          "Two requests to sign. The second takes the whole dUSDC balance to the look-alike.",
        with: "Stopped at the first request: an unlimited allowance to a reported spender. Nothing is signed.",
      },
      {
        aspect: "What you see",
        without: "A contract address, an amount and a confirm button.",
        with: "What changes in your balances, and one sentence per finding.",
      },
      {
        aspect: "An unlimited allowance",
        without: "Shown like any other allowance.",
        with: "Named as unlimited, and stopped when your rules block it.",
      },
      {
        aspect: "A look-alike router or pool",
        without: "The page is all you have to go on.",
        with: "Checked against the reputation registry and the contracts Baret knows.",
      },
      {
        aspect: "A check that cannot finish",
        without: "There was no check to finish.",
        with: "Can't reach Baret. It counts as Blocked and nothing is signed.",
      },
    ],
    /** Under the table: the site where both paths run. */
    action: { label: "Try both on NovaSwap", href: "/novaswap" },
  },

  cta: {
    title: "Pick a site. Press the button.",
    body: "Each site builds a real transaction on Monad testnet. The analysis appears before anything is signed.",
    actions: {
      primary: { label: "Start with ClaimHub", href: "/claimhub" },
      secondary: { label: "Install the extension", href: "/install" },
    },
  },
} as const;

export type HubContent = typeof hub;
