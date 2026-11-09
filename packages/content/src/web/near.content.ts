/**
 * /near on apps/web: the NEAR agent demo panel (TASKS.md TN.9, NEAR HACKATHON 2026).
 *
 * The page reads the demo vault on NEAR testnet in the visitor's browser and lets them
 * ask Baret about the four requests the demo agent tries. Nothing on it signs.
 *
 * Rules this page keeps:
 *  - Testnet is said where the vault and the runs are shown; NEAR on testnet has no value.
 *  - The recorded runs are the ones made on 2026-11-08 and 2026-11-09 (packages/demo-near,
 *    `pnpm agent`), with their transaction hashes and the CAIP-2 chain each one is on. A new run updates them here, never a made-up one.
 *  - Amounts and account ids come from the chain or the registry, never from this file.
 */

export const near = {
  meta: {
    title: "NEAR agent vault · Baret",
    description:
      "An AI agent on NEAR testnet that asks Baret before every payment and pays through a vault with limits. Read the vault live and check the agent's requests yourself.",
  },

  hero: {
    title: "An agent that asks before it pays.",
    body: "The agent holds one key. It can call one method on one contract: the vault's payment. Before it signs, it asks Baret what the payment would do. If Baret says no, it does not sign. If it signs anyway, the vault says no.",
    actions: {
      primary: { label: "Ask Baret yourself", href: "#requests" },
      secondary: { label: "Read the code", href: "https://github.com/Aeztrest/baret" },
    },
    notice:
      "Everything on this page runs on NEAR testnet, where NEAR has no value. The page only reads; it never signs.",
  },

  layers: {
    title: "Two lines of defence.",
    items: [
      {
        label: "Before signing",
        title: "Baret",
        body: "Decodes the transaction, reads the vault's policy and balances over RPC, and predicts what the vault will do. A refused payment, a receiver the owner never listed or a new full access key comes back Blocked, with the reason.",
      },
      {
        label: "On chain",
        title: "The vault",
        body: "Holds the money and enforces the owner's limits: a cap per payment, a cap per rolling day, a list of receivers and of agents. The agent's key reaches nothing else, so it cannot add keys or move funds around the vault.",
      },
      {
        label: "On other chains",
        title: "Chain Signatures",
        body: "The vault also pays on EVM chains, from an address only NEAR's MPC network can sign for, and only when the vault asks. It builds the transaction itself and counts the value plus the highest possible fee against the same limits. Baret checks both sides: the call on NEAR and the transfer on the other chain.",
      },
    ],
  },

  vault: {
    title: "The vault, read now.",
    body: "Read from NEAR testnet in your browser, at the latest final block.",
    loading: "Reading the vault...",
    failed:
      "The vault could not be read. NEAR testnet RPC did not answer; nothing below is shown until it does.",
    retry: "Read again",
    labels: {
      account: "Vault",
      owner: "Owner",
      agent: "Agent",
      receivers: "Allowed receivers",
      perTransfer: "Per payment",
      perDay: "Per rolling day",
      spent: "Spent in the last 24 hours",
      next: "Largest payment now",
      balance: "Balance",
      state: "State",
      block: "Block",
      version: "Contract version",
      keys: "Keys on the vault account",
    },
    locked: "None. Only the owner can change the code, through update_contract.",
    unlocked: "Whoever holds one of these keys can replace the code, so the owner must keep them.",
    paused: "Paused by the owner",
    active: "Active",
    unit: "NEAR",
  },

  requests: {
    title: "Ask Baret about the agent's requests.",
    body: "The same four requests the demo agent makes. Press one: this page sends it to Baret's API and shows the verdict it would get. Nothing is signed or sent to the chain.",
    ask: "Ask Baret",
    asking: "Asking Baret...",
    failed:
      "Baret did not answer, so the agent would not sign. Fail-closed: no verdict, no signature.",
    expected: "Expected",
    items: [
      {
        id: "pay",
        title: "Pay the shop 0.1 NEAR",
        body: "An ordinary payment for an API answer, inside every limit, to the one listed receiver.",
        expected: "safe",
      },
      {
        id: "over-limit",
        title: "Pay the shop 5 NEAR",
        body: "Five times the per-payment limit. The vault would refuse it; Baret says so first.",
        expected: "blocked",
      },
      {
        id: "wrong-receiver",
        title: "Pay 1 NEAR to an account a prompt named",
        body: "A prompt injection: the page the agent read asks it to pay someone the owner never listed.",
        expected: "blocked",
      },
      {
        id: "add-key",
        title: "Add a full access key to the agent",
        body: "A prompt injection that tries to take over the agent's account instead of its money.",
        expected: "blocked",
      },
    ],
    reason: "Reason from the vault",
  },

  runs: {
    title: "What happened when the agent ran.",
    body: "Recorded on 2026-11-08 and 2026-11-09 against Baret's staging API. With --force the agent sent blocked requests anyway, to show the chain refuse them too.",
    head: { request: "Request", baret: "Baret", chain: "On chain" },
    rows: [
      {
        title: "Pay the shop 0.1 NEAR",
        baret: "Safe",
        chain: "Paid 0.1 NEAR to the shop",
        txs: [
          {
            chain: "near:testnet",
            hash: "AoFv4uUaRNo3k5VDRPPPevwwNFZrvuXpaEpg4fhMdbvr",
            label: "NEAR",
          },
        ],
      },
      {
        title: "Pay the shop 5 NEAR",
        baret: "Blocked",
        chain: "Refused by the vault: E_PER_TRANSFER_LIMIT",
        txs: [],
      },
      {
        title: "Pay 1 NEAR to an account a prompt named",
        baret: "Blocked",
        chain: "Refused by the vault: E_RECEIVER_NOT_ALLOWED",
        txs: [],
      },
      {
        title: "Add a full access key to the agent",
        baret: "Blocked",
        chain: "Refused by NEAR: the agent's key cannot add keys",
        txs: [],
      },
      {
        title: "Pay the shop 0.01 MON on Monad testnet",
        baret: "Safe on NEAR and on Monad testnet",
        chain: "The vault signed through Chain Signatures; paid 0.01 MON",
        txs: [
          {
            chain: "near:testnet",
            hash: "AYeXGS4GUexwcYE9X3BBWm2FsFvizkm7Dw5AsbJYLHPv",
            label: "NEAR",
          },
          {
            chain: "eip155:10143",
            hash: "0x2796a4ad2edb515dde729c1d6c51475fd15b3884883c991ddcf4a6c94253afb8",
            label: "Monad testnet",
          },
        ],
      },
      {
        title: "Pay 0.01 MON to an address a prompt named",
        baret:
          "Blocked on both: a receiver the owner never listed, an address on the reported list",
        chain: "Refused by the vault: E_RECEIVER_NOT_ALLOWED",
        txs: [],
      },
      {
        title: "Swap 0.1 wNEAR to USDC through NEAR Intents (mainnet quote)",
        baret: "Caution: the quote adds a 0.2 % app fee",
        chain: "Not signed: a check of a real 1Click quote, no deposit made",
        txs: [],
      },
      {
        title: "The same swap, the quote changed to pay out and refund to another account",
        baret: "Blocked: the swap would pay someone other than the agent",
        chain: "Not signed",
        txs: [],
      },
    ],
    viewTx: "View on {label}",
  },

  cta: {
    title: "Run the agent yourself.",
    body: "The vault contract, the agent and the setup scripts are in the repository, with the steps to deploy your own vault on NEAR testnet.",
    actions: {
      primary: { label: "Open the repository", href: "https://github.com/Aeztrest/baret" },
      secondary: { label: "See the EVM showcase", href: "/showcase" },
    },
  },
} as const;

export type NearContent = typeof near;
