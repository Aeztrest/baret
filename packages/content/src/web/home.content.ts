/**
 * / on apps/web. The landing page.
 *
 * Ported from Baret-Metropolis (showcase/home.content.ts), with these changes:
 *  - Chain-neutral where the claim is about Baret, chain-named where it is a
 *    fact about one deployment: NEAR testnet and Monad testnet are live;
 *    Stellar and Casper are named as being ported, never as live.
 *  - Agent first (2026-11-14, owner): the opener, the hero, the agents block
 *    (moved up, right under the hero) and the closing speak to someone giving
 *    an AI agent money; the wallet showcase follows, for people who sign.
 *  - No provider is named (Alchemy, Nansen, Chainlink CRE, Envio, Dynamic,
 *    Mera): providers are optional per deployment (docs/architecture/providers.md).
 *  - Blocks Metropolis kept but no longer rendered (comparison, privacy, faq
 *    and the unrendered fields) are dropped.
 *  - Numbers come from the code: detector modules in packages/chain-evm, rules
 *    in POLICY_FIELDS, finding codes in FINDING_CODES (both @baret/core).
 *
 * Positioning, from the Metropolis competitor research: "before" is table
 * stakes; ours is WHOSE RULES ("Your rules, not ours"), the middle verdict
 * (Caution), and that a block is a block (decide once, in advance).
 *
 * Copy draft for the multichain site: the owner reviews it before production
 * (TASKS.md T2.4).
 */

export const home = {
  meta: {
    title: "Give your AI agent money, not the keys · Baret",
    description:
      "Baret checks every transaction before your AI agent signs it: Safe, it pays; Caution, it asks you; Blocked, it stops. Limits live on chain, where the agent cannot reach them. Live on NEAR testnet and Monad testnet.",
    /** og:image:alt for the static share card in index.html. */
    imageAlt: "The Baret logo: an orange helmet beside the BARET wordmark on a light grid",
  },

  /** The opener: a short loop that plays by itself, one line per frame. Scrolling is
   *  never held: the first scroll reaches the hero. The page works without it. */
  opener: {
    lines: [
      "Your AI agent holds a key and pays on its own.",
      "Baret reads every payment before the agent signs it.",
      "Safe, it pays. Caution, it asks you. Blocked, it stops.",
    ],
    /** The loop's pause control (WCAG 2.2.2: moving content can be stopped). */
    pause: "Pause the intro",
    play: "Play the intro",
    /** Accessible name of the step dots under the lines. `{n}` is 1 to 3. */
    step: "Show line {n}",
    /** Accessible name of the opener region. */
    regionLabel: "Intro",
  },

  hero: {
    status: "Live on NEAR testnet and Monad testnet.",
    title: "Check it first. Then let it pay.",
    body: "An AI agent that pays needs a key, and one bad prompt can empty it. Baret reads each transaction before the agent signs and says what it would really do, in plain words. Its limits live in a vault on chain, so even an agent that skips the check cannot overspend.",
    actions: {
      primary: { label: "Watch an agent pay on NEAR", href: "/near" },
      secondary: {
        label: "Hire Baret on Agent Market",
        /** Below 768 px, same link. */
        labelPhone: "Hire on Agent Market",
        href: "/near#market",
      },
    },
    /** Next to every sample widget on the landing. */
    previewLabel: "An example request with sample data, not a\u00a0live check.",
  },

  /** The scrolling strip. Every item is a finding an EVM detector in
   *  packages/chain-evm emits (code in the comment). Add nothing no detector emits. */
  marquee: {
    label: "Checks Baret runs before you sign",
    /** Accessible name of the screen-reader list behind the moving rows.
     *  The detectors emit more codes than this list, so it never claims "all". */
    listLabel: "Some of the checks Baret runs before you sign",
    items: [
      "A transaction that would fail", // SIMULATION_FAILED
      "A simulation with gaps", // LOW_CONFIDENCE_INCOMPLETE_DATA
      "Unlimited allowance", // APPROVAL_UNLIMITED
      "Operator grant on a whole collection", // NFT_OPERATOR_GRANTED
      "Allowance hidden in a signature", // PERMIT_SIGNATURE_DETECTED
      "Reported contract", // RISKY_CONTRACT_INTERACTION
      "Unknown contract", // UNKNOWN_CONTRACT_EXPOSURE
      "Self-destructing contract", // SELFDESTRUCT_CALL
      "Code run from another contract", // DELEGATECALL_DETECTED
      "Ownership handover", // AUTHORITY_CHANGE
      "Address on Baret's reported list", // KNOWN_MALICIOUS_ADDRESS
      "Brand-new counterparty", // REPUTATION_FRESH_ACCOUNT
      "Transfer without a verified identity", // COMPLIANCE_NO_CREDENTIAL
      "Calls nested deeper than they look", // DEEP_CALL_NESTING
      "Fee far above the need", // EXCESSIVE_FEE
      "Look-alike payment token", // X402_NON_CANONICAL_ASSET
      "Payment to the wrong address", // X402_DESTINATION_MISMATCH
    ],
  },

  /** Three layers, one verb each. `label` is the verb, `title` the layer. */
  pillars: {
    title: "Reads it. Caps it. Watches it.",
    body: "Three layers around one signature: before you sign, while a permission stays open, and after it is used. Each layer works on its own.",
    /** Accessible name of the three tabs that switch the layer. */
    tabsLabel: "The three layers",
    /** The live sketch in each layer's stage, as short mono lines. Sample data,
     *  never a live check. */
    sketch: {
      reads: {
        tx: "approve(spender, unlimited)",
        steps: ["Simulate", "Read changes", "Run checks"],
        verdict: "Blocked",
      },
      caps: {
        label: "Daily cap",
        used: "18 of 20 USDC",
        next: "Next payment: 4 USDC",
        verdict: "Blocked at the cap",
      },
      watches: {
        label: "Allowance used",
        detail: "USDC spender moved 40 USDC",
        alert: "Alert sent",
      },
    },
    items: [
      {
        label: "Reads it",
        title: "Pre-sign Guard",
        body: "Before your wallet signs, Baret simulates the transaction against the chain as it is right now. Its detectors read the result, and your rules turn it into one verdict.",
        points: [
          "Runs without sending",
          "Many detectors, one verdict",
          "One plain sentence per finding",
        ],
      },
      {
        label: "Caps it",
        title: "Authorization Ledger",
        body: "Some signatures leave a permission behind, like a site allowed to spend your tokens next year. Baret keeps every one in a single list: who can spend, how much, and a Revoke button.",
        points: [
          "Allowances, operator grants and connected sites",
          "Revoke in one step",
          "Hourly and daily caps for agents",
        ],
      },
      {
        label: "Watches it",
        title: "Post-sign Monitor",
        body: "Baret keeps watching after you sign. You get an alert when an allowance is used or funds leave without your signature.",
        points: [
          "Alerts when an allowance is used",
          "Alerts on transfers you did not sign",
          "A history for every account",
        ],
      },
    ],
  },

  /** The middle verdict. `impact` is one sentence on what actually moves if the
   *  request is signed. */
  caution: {
    title: "Between Safe and Blocked, there is Caution.",
    body: "A check with two answers has to round. Round down, and a contract nobody verified passes as fine. Round up, and every swap looks alarming until you stop reading. Baret has a third answer. You can sign, and the reason comes first.",
    labels: { impact: "If signed" },
    /** The verdict check row. Sample data, never a live check. Each sample links
     *  to a showcase site that runs a related request for real. No site answers
     *  Caution under Balanced, so the swap sample's link says what OrbitYield
     *  shows: an unknown pool, blocked because it keeps what you send. */
    demo: {
      legend: "Try a sample request",
      samples: [
        {
          id: "send",
          label: "Send 25 USDC to the address you typed",
          tryLabel: "Try a swap on NovaSwap",
          href: "/novaswap",
        },
        {
          id: "swap",
          label: "Swap 100 USDC via an unknown contract",
          tryLabel: "See an unknown pool blocked on OrbitYield",
          href: "/orbityield",
        },
        {
          id: "approve",
          label: "Approve unlimited USDC",
          tryLabel: "Try it on ClaimHub",
          href: "/claimhub",
        },
      ],
      checked: "Checked: simulation · approvals · recipient",
      /** The switch label is `policy.fields["core.blockUnlimitedApprovals"].label`
       *  and never changes; only the state word beside it does. */
      rule: { on: "On", off: "Off", stopped: "A rule you set stopped it." },
      /** The finding that still shows when the rule is off. Values fill the
       *  `findings` template. */
      finding: {
        code: "APPROVAL_UNLIMITED",
        values: { spender: "this site's contract", asset: "USDC", amount: "100" },
      },
      /** What the status region announces. `{verdict}` is the verdict label. */
      announce: {
        sample: "{verdict}. {impact}",
        ruleOn: "Rule on. Blocked.",
        ruleOff: "Rule off. Caution.",
      },
    },
    examples: [
      {
        verdict: "safe",
        title: "Safe",
        body: "No rule was broken and no check found a problem. You still see exactly what changes before you sign.",
        impact: "25 USDC goes to the address you typed. Nothing else moves.",
      },
      {
        verdict: "caution",
        title: "Caution",
        body: "No rule was broken, but a check found something worth a look. For example, a contract nobody verified, a brand-new wallet, or a fee far above the need.",
        impact: "You swap 100 USDC through a contract nobody has verified.",
      },
      {
        verdict: "blocked",
        title: "Blocked",
        body: "A rule you set stopped it. Baret names the rule, not a score. In the extension, signing anyway takes a separate press\u2011and\u2011hold, and it is logged.",
        impact: "A site could spend all of your USDC, today or next year.",
      },
    ],
    honesty: {
      title: "The fourth verdict: Can't reach Baret",
    },
  },

  /** The x402 wedge: what an agent should check before it pays. The three stories
   *  map to the leash, the budget and the kill switch. */
  agents: {
    title: "Give an agent money. Not the keys.",
    body: "An agent that pays by itself, for an API through x402 or a shop on NEAR, keeps no running total and asks nobody. Baret keeps the count, checks every payment before it is signed, and holds the limits where the agent cannot change them. Your agent gets a budget, a leash, a second opinion and a kill switch.",
    /** Daily-cap presets inside "The budget" row. A deterministic sample run, no
     *  timers. `{amount}`, `{actual}` and `{cap}` are formatted with the asset. The
     *  capped sentence is the filled `X402_DAILY_CAP_EXCEEDED` finding. */
    demo: {
      legend: "Daily cap",
      sample: "A sample run: an agent asks Scrybe {count} questions at {amount} each.",
      asset: "USDC",
      price: 2,
      run: 20,
      presets: [10, 20, 30, 50],
      initial: 20,
      /** Segment label, for example "20 USDC". A no-break space keeps the number
       *  and its unit on one line. */
      preset: "{cap}\u00a0{asset}",
      fits: "All {count} payments fit under this cap.",
      /** Same label as `check.capped` in shared/check. */
      capped: "Blocked at the cap",
      findingCode: "X402_DAILY_CAP_EXCEEDED",
      /** What the status region announces when the run is capped. */
      announceCapped: "{tag}. {finding}",
      /** How far a capped run got, before the finding. */
      progress: "{paid} of {count} paid.",
      /** The honesty line under the result: a run, not a single request. */
      previewLabel: "A sample run with sample data, not a\u00a0live payment.",
    },
    gaps: [
      {
        control: "The budget",
        answer:
          "Caps for each merchant, per payment, per hour and per day. Every payment counts against a real number. The one that crosses it does not go out.",
      },
      {
        control: "The leash",
        answer:
          "The agent pays only the receivers and assets you listed. A receiver named in a prompt, or a look-alike token with a perfect name, is refused.",
      },
      {
        control: "The second opinion",
        answer:
          "Before it signs, the agent asks Baret what the transaction would do. Safe, it pays. Caution, such as a receiver it has never paid, it stops and asks you. Blocked, it refuses.",
      },
      {
        control: "The kill switch",
        answer:
          "The agent's key can only pay from your vault, inside your caps. Pause the vault or revoke the key in one transaction, and every later payment fails on chain.",
      },
    ],
    note: "The caps live on chain: in the Baret vault on NEAR testnet, which also bounds EVM payments through Chain Signatures, and in PaymentGuard on Monad testnet. Stellar and Casper are being ported.",
    action: { label: "Watch the NEAR agent", href: "/near" },
  },

  /** Only numbers that come from the code. No usage stats, ever. */
  stats: {
    title: "Counted, not claimed.",
    items: [
      { value: "10", label: "detector modules read every EVM transaction" },
      { value: "26", label: "rules you can switch on, off or tune" },
      { value: "78", label: "findings, each with a plain sentence" },
      {
        value: "4",
        label: "chain families: EVM and NEAR on testnet, Stellar and Casper being ported",
      },
    ],
    note: "No user counts and no totals. Baret is on testnet, so it counts only what it ships.",
  },

  /** Six cards, one per threat site. `hook` is an invitation, not a result: the
   *  live analysis on each site says what it found. */
  showcase: {
    title: "Six fake sites. Six real attacks.",
    body: "Each site looks like a real product and builds a real transaction on Monad testnet. Connect any wallet, press the main button, and read the verdict before anything is signed.",
    notice:
      "These sites are fakes built for the showcase. They run on testnet and cannot touch real money.",
    labels: { verdict: "Expected verdict", open: "Open the site" },
    /** The card's verdict tag. Same words as common.verdicts and check.capped, kept
     *  here so the landing loads one file. */
    verdicts: {
      safe: "Safe",
      caution: "Caution",
      blocked: "Blocked",
      unreachable: "Can't reach Baret",
      capped: "Blocked at the cap",
    },
    cards: [
      {
        name: "Scrybe",
        category: "Paid API",
        hook: "Let an agent pay per question. Watch the cap hold.",
        verdict: "capped",
        href: "/scrybe",
      },
      {
        name: "NovaSwap",
        category: "Token swap",
        hook: "Swap tokens. See where the output really lands.",
        verdict: "blocked",
        href: "/novaswap",
      },
      {
        name: "PixelDrop",
        category: "NFT mint",
        hook: "Mint one item. See what else the button grants.",
        verdict: "blocked",
        href: "/pixeldrop",
      },
      {
        name: "OrbitYield",
        category: "Staking",
        hook: "Stake for yield. See who has verified the pool.",
        verdict: "blocked",
        href: "/orbityield",
      },
      {
        name: "ClaimHub",
        category: "Airdrop",
        hook: "Claim a free airdrop. See what you are really signing.",
        verdict: "blocked",
        href: "/claimhub",
      },
      {
        name: "LaunchPad",
        category: "Token sale",
        hook: "Buy into a token sale. See who still holds the controls.",
        verdict: "blocked",
        href: "/launchpad",
      },
    ],
    action: { label: "Open the showcase", href: "/showcase" },
  },

  cta: {
    title: "Give your agent a budget, not your keys.",
    body: "Watch an agent on NEAR ask Baret before every payment, or hire Baret on Agent Market to check one transaction. Signing yourself? The showcase has six fake sites to try.",
    actions: {
      primary: { label: "Watch the NEAR agent", href: "/near" },
      secondary: {
        label: "Open the showcase",
        /** Below 768 px, same link. */
        labelPhone: "Open the showcase",
        href: "/showcase",
      },
    },
    /** The trust line as facts. A fact links only where it has a real destination.
     *  No audit is done or booked, so the line says so. */
    facts: [
      { label: "SDKs under the MIT licence" },
      { label: "Not audited yet" },
      { label: "Testnet only" },
      { label: "Fails closed" },
    ],
  },
} as const;

export type HomeContent = typeof home;
