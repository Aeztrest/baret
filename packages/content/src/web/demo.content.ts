/**
 * The frame every demo site shares: its wallet picker, the version switch, the
 * Baret panel, the errors and the outcome. What differs per site lives in that
 * site's own file under web/sites/.
 *
 * Ported from Baret-Metropolis (showcase/hub.content.ts `frame`) without the Baret
 * web wallet's window, which the multichain build does not carry. The sites run on
 * Monad testnet, so this copy names it; the explorer and faucet links come from the
 * chain registry, never from here.
 */
export const demoFrame = {
  pill: "Simulated site",
  notice: "A simulation on Monad testnet. Tokens here have no value.",
  back: { label: "Back to the showcase", href: "/showcase" },
  // Screen-reader headings for a demo home's figures and FAQ.
  site: { statsTitle: "Figures", faqTitle: "Questions" },

  /**
   * The wallet picker in a demo site's header and the connected wallet's
   * menu. Wallets are found with EIP-6963. {wallet} is a wallet's own name.
   */
  wallet: {
    title: "Connect a wallet",
    body: "Baret checks each request on this page from the address you connect. Nothing is signed unless you sign it in your wallet.",
    looking: "Looking for wallets in this browser...",
    others: "Wallets in this browser",
    /** The Baret extension among the wallets in this browser. */
    extension: {
      name: "Baret extension",
      body: "A wallet in this browser that checks each transaction with Baret before it signs.",
    },
    none: "No other wallet found in this browser.",
    sample: {
      label: "Use the sample wallet",
      body: "Prepared answers, no wallet needed. Nothing leaves this page.",
    },
    /** The developer fallback address (VITE_BARET_DEMO_FROM), shown in place of a wallet. */
    testAddress: "Test address",
    connecting: "Confirm in {wallet}...",
    errors: {
      rejected: "You declined in {wallet}. Nothing was connected.",
      pending: "{wallet} already has a request open. Finish it there, then try again.",
      failed: "{wallet} did not connect. Try again, or pick another wallet.",
    },
    close: "Close",
    account: {
      title: "Your wallet",
      /** The connected chip's accessible name. */
      open: "{wallet}, {address}. Open the wallet menu",
      live: "Baret checks each request on this page from this address, live.",
      network: {
        ok: "Monad testnet",
        wrong: "Your wallet is on another network. Checks still run on Monad testnet.",
      },
      switch: {
        label: "Switch to Monad testnet",
        busy: "Switching...",
        failed: "The wallet did not switch. Pick Monad testnet in the wallet itself.",
      },
      balance: "{amount} MON on Monad testnet",
      empty: "No test MON in this wallet yet. A live check of a payment needs some.",
      /** The link goes to the chain registry's faucet (faucetUrl). */
      faucet: { label: "Get test MON" },
      copy: { label: "Copy address", done: "Copied" },
      disconnect: "Disconnect",
    },
    announce: {
      connected: "{wallet} connected, {address}",
      disconnected: "Wallet disconnected",
    },
    /** Under a card's amount when a live wallet holds less than it asks. */
    short: "Your wallet holds {balance} MON on Monad testnet. Get test MON, or ask for less.",
  },

  toggle: {
    legend: "Which version to build",
    hint: "Same page, different transaction. Switch versions, then press the site's main button.",
  },

  claims: {
    title: "The site says",
    check: "Baret checks",
    note: "Nothing a page says about itself is verified. Baret reads the transaction instead.",
  },

  panel: {
    title: "Baret analysis",
    /** Shown on a prepared answer: no wallet is connected. */
    sample:
      "A prepared sample of what Baret returns for this request. Connect a wallet to get Baret's live answer for your own address.",
    asks: "What the site asks for",
    call: "The call",
    expected: "Expected verdict",
    expectedNote:
      "Expected under the Balanced rules, the default. Your own rules can change the result.",
    live: "Live verdict",
    changes: "What changes",
    findings: "Findings",
    noFindings: "No findings. Nothing in this request broke a rule.",
    phases: [
      "Reading the transaction",
      "Simulating on Monad testnet",
      "Running the detectors",
      "Applying your rules",
    ],
    match: "The live verdict matches the expected one.",
    mismatch:
      "The live verdict differs from the expected one. Your rules may differ from Balanced, or a check may not have finished.",
    lesson: "Take this with you",
    /** Under the title when the answer came from Baret's server. */
    liveNote: "Baret's answer from its server, for this exact request on Monad testnet.",
    /**
     * On a prepared answer: the same request through Baret's server from a
     * fixed testnet address, for a visitor with no wallet.
     */
    checkLive: {
      label: "Check it live",
      /** {address} is Baret's demo account, shortened. */
      note: "Checked live from Baret's demo account {address}, not your wallet. Balances and changes are that account's.",
    },
    /** When the check did not finish: no answer means Blocked. */
    failed: {
      title: "The check did not finish",
      body: "Baret did not answer in time: its server was busy or out of reach. With no answer, the verdict is Blocked. Do not sign.",
    },
  },

  empty: {
    title: "Nothing to read yet",
    body: "Press the site's main button. The analysis of that transaction appears here before anything is signed.",
  },

  errors: {
    noWallet: {
      title: "No wallet connected",
      body: "Connect a wallet so the site can build its transaction. Any wallet in the picker works.",
      action: { label: "Connect a wallet" },
    },
    wrongNetwork: {
      title: "Wrong network",
      body: "These sites run on Monad testnet. Switch your wallet to Monad testnet and press the button again.",
      action: { label: "Switch to Monad testnet" },
    },
    buildFailed: {
      title: "The site could not build its transaction",
      body: "Monad testnet did not answer. Nothing was sent. Try again in a moment.",
      action: { label: "Try again" },
    },
    unreachable: {
      title: "Can't reach Baret",
      body: "The check could not run, so this counts as Blocked. Nothing was signed. Try again in a moment.",
      action: { label: "Check again" },
    },
  },

  outcome: {
    stopped: {
      title: "Nothing was signed",
      body: "Through Baret, this transaction was never sent, so nothing moved.",
    },
    declined: {
      title: "You declined",
      body: "Nothing was signed and nothing moved.",
    },
    sent: {
      title: "Signed and sent",
      body: "The transaction is on Monad testnet.",
      action: { label: "View it on the explorer" },
    },
    again: { label: "Try the other version" },
    share: { label: "Copy the result", done: "Copied" },
  },

  /**
   * A site's second button beside its main one: the same request, sent
   * straight to the connected wallet with no Baret check first. Shared by
   * every site that has it, NovaSwap first. {wallet} is the wallet's own name.
   * When that wallet is the Baret extension, it checks the request itself
   * (D-040), so `noteChecked` replaces `note`.
   */
  sign: {
    /** Above the second button: what the site's main button does instead. */
    checked: "The site's button above goes through Baret's check first.",
    action: "Sign with your wallet",
    note: "Sends this request straight to your wallet, with no Baret check. These are real transactions on Monad testnet, with test tokens that have no value.",
    noteChecked:
      "Sends this request to the Baret extension, which checks it with Baret before it signs. These are real transactions on Monad testnet, with test tokens that have no value.",
    title: "In your wallet",
    status: {
      waiting: "Next",
      confirm: "Confirm in {wallet}...",
      pending: "Waiting for Monad testnet...",
      done: "Confirmed",
      declined: "Declined",
      unconfirmed: "Not confirmed yet",
      failed: "Failed",
    },
    view: "View {hash} on the explorer",
    balance: "{token} in your wallet: {before} before, {after} after.",
    /** Why a press did not start: shown under the button with the action that fixes it. */
    needs: {
      wallet:
        "Connect a wallet to sign: the Baret extension or any wallet in the picker. The sample wallet cannot sign.",
      network: "Your wallet is on another network. Switch it to Monad testnet to sign.",
    },
    errors: {
      rejected: "You declined in {wallet}. Nothing more was sent.",
      pending: "{wallet} already has a request open. Finish it there, then try again.",
      network: "Your wallet is on another network. Switch it to Monad testnet, then try again.",
      funds:
        "This account does not hold enough MON for this amount and its fee. Lower the amount or get test MON.",
      account: "The connected account changed. Press the button again.",
      reverted: "Monad testnet ran the transaction and it failed. Nothing more was sent.",
      timeout: "Monad testnet has not confirmed it yet. Follow it on the explorer.",
      failed: "The wallet did not send it. Try again in a moment.",
    },
    /** Read out when a step changes: "Step 1 of 2, Confirmed". */
    announce: "Step {n} of {total}, {status}",
    /**
     * Above the buttons on the attack version: what each path does with the
     * same request. Kept modest about other wallets: MetaMask's own
     * security alerts may warn in general terms, and the visitor can still
     * approve. It does not run Baret's checks on this request.
     */
    paths: {
      title: "Same request, two paths",
      baret: {
        label: "With Baret",
        body: "The Baret extension checks it first. It declines before anything is signed and says why.",
      },
      plain: {
        label: "Without a pre-sign check, such as MetaMask",
        body: "Its own prompt opens. It may warn in general terms, such as about an unlimited spending cap. It cannot tell you what Baret found, and if you approve, the attack goes through.",
      },
    },
    /** Heading of the result once the attack was signed with no check. */
    through: "The attack went through",
    /** Heading of the result once the honest request was signed. */
    done: "Done",
  },
} as const;

export type DemoFrameContent = typeof demoFrame;
