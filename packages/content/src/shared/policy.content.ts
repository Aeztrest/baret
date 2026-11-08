/**
 * One entry per GuardPolicy v2 rule (POLICY_FIELDS in @baret/core), plus the templates and
 * the editor chrome. The `satisfies` below makes the compiler refuse a missing or unknown
 * rule. Ported from Baret-Metropolis and moved to v2's dotted rule paths.
 *
 * Rendered by the rule editors (web app, extension options) and the onboarding step that
 * picks a template.
 *
 * Each field:
 *   group     a key of `groups` below.
 *   label     the row label. UI copy says "rules", never "policy".
 *   hint      what happens when the rule fires.
 *   unit      for numeric fields, the unit the value is entered in. "{native}" and
 *             "{asset}" are filled from the chain registry.
 *   families  only for family rules: the families the row is shown on.
 *   options   for level fields: the word for each level. For core.minReputationTrust these
 *             words are also the {actual} and {limit} values of REPUTATION_TRUST_BELOW_MINIMUM.
 *   display   for list and level fields: how the current value reads in a row.
 *
 * Which finding codes a rule decides is not listed here (Metropolis listed it and kept it in
 * sync by test): the UI reads FINDING_SPECS in @baret/core, the single source.
 *
 * Fail-closed is not a field. When Baret cannot finish a check, the request counts as
 * Blocked whatever these rules say.
 */
import type { Family, PolicyField as PolicyFieldName } from "@baret/core";

type PolicyGroup =
  | "simulation"
  | "contracts"
  | "approvals"
  | "dangerous"
  | "limits"
  | "reputation"
  | "compliance"
  | "fees"
  | "x402"
  | "general";

interface PolicyField {
  group: PolicyGroup;
  label: string;
  hint: string;
  unit?: string;
  families?: readonly Family[];
  options?: Readonly<Record<string, { label: string; hint: string }>>;
  display?: Readonly<Record<string, string>>;
}

interface PolicyContentShape {
  intro: Readonly<Record<string, string>>;
  templates: unknown;
  groups: Readonly<Record<PolicyGroup, { title: string; body: string }>>;
  fields: Readonly<Record<PolicyFieldName, PolicyField>>;
  editor: unknown;
}

export const policy = {
  intro: {
    title: "Your rules",
    body: "Baret checks every sign request against these rules. You set them. Baret only runs them.",
    note: "A change applies from the next sign request. Nothing you already signed is affected.",
    failClosed: "Whatever you set here, a request Baret cannot finish checking counts as Blocked.",
  },

  /** Descriptions say only what the rules can express. Values live in @baret/core templates. */
  templates: {
    strict: {
      name: "Strict",
      body: "For an account that holds more than you want to lose. Of the three sets, it blocks the most.",
      highlights: [
        "Blocks unknown contracts as well as reported ones",
        "Blocks every finding, so a Caution stops the request too",
        "The lowest loss limit and payment caps of the three",
      ],
    },
    balanced: {
      name: "Balanced",
      body: "The starting point. Blocks broad allowances and listed addresses, and lets you sign a Caution after you read why.",
      highlights: [
        "Blocks unlimited allowances, collection-wide access and signed allowances",
        "Blocks listed addresses, reported contracts and handovers of control",
        "An unknown contract shows as Caution, unless it keeps what you send or runs borrowed code",
      ],
    },
    permissive: {
      name: "Permissive",
      body: "For a test account you do not mind losing. Every check still runs and every finding still shows. Fewer rules block.",
      highlights: [
        "Still blocks listed addresses, requests that would fail and anything that empties or closes an account",
        "Unlimited allowances show as Caution. Read them before you sign.",
        "The highest payment caps of the three",
      ],
    },
    /** Shown instead of the template name once any field differs from it. */
    custom: {
      name: "Custom",
      body: "Started from {template}. At least one rule is different now.",
    },
    footnote:
      "Start from any set and change a single rule later. The other rules stay as they were.",
  },

  groups: {
    simulation: {
      title: "Simulation",
      body: "Whether a request must run cleanly before you can sign it.",
    },
    contracts: {
      title: "Contracts",
      body: "Which contracts a request may touch.",
    },
    approvals: {
      title: "Allowances",
      body: "What a site may spend from your wallet, now and later.",
    },
    dangerous: {
      title: "Dangerous actions",
      body: "Actions that can hand over or empty a contract or your account.",
    },
    limits: {
      title: "Loss limits",
      body: "The most one request may cost you, and what it must leave behind.",
    },
    reputation: {
      title: "Reputation",
      body: "What the reputation provider and the Baret reputation registry say about the other address.",
    },
    compliance: {
      title: "Compliance",
      body: "Identity rules for transfers, checked against verified identity credentials.",
    },
    fees: {
      title: "Fees",
      body: "The most a request may cost in network fees.",
    },
    x402: {
      title: "Payments",
      body: "Caps and lists for the payments your agents make over x402.",
    },
    general: {
      title: "Caution",
      body: "What happens when a check finds something that no rule above blocks.",
    },
  },

  fields: {
    "core.requireSuccessfulSimulation": {
      group: "simulation",
      label: "Block requests that would fail",
      hint: "Baret runs each request without sending it. If it fails, the request is blocked, because a failed transaction still costs a fee.",
    },

    "core.blockRiskyContracts": {
      group: "contracts",
      label: "Block risky contracts",
      hint: "Blocks a request that touches a contract on the risky list in the Baret reputation registry, or that pays an unknown contract and gets nothing back. Also blocks an address that copies another one, and an allowance to a plain account.",
    },
    "core.blockUnknownContractExposure": {
      group: "contracts",
      label: "Block unknown contracts",
      hint: "Blocks a request that touches a contract on no list Baret reads. Expect new apps to trip it.",
    },

    "core.blockUnlimitedApprovals": {
      group: "approvals",
      label: "Block unlimited allowances",
      hint: "Blocks an allowance with no limit, which lets a contract take all of a token, now and later.",
    },
    "evm.blockSetApprovalForAll": {
      group: "approvals",
      label: "Block collection-wide access",
      hint: "Blocks a request that lets someone move every item in a collection, including items you get later.",
      families: ["evm"],
    },
    "evm.blockPermit": {
      group: "approvals",
      label: "Block signed allowances",
      hint: "Blocks a permit, a signature that grants an allowance without a transaction. Also blocks an order that pays you nothing for what it gives away.",
      families: ["evm"],
    },

    "core.blockAuthorityChanges": {
      group: "dangerous",
      label: "Block handovers of control",
      hint: "Blocks a request that moves admin rights over a contract, or that adds or removes a signer on your account, to another address.",
    },
    "evm.blockSelfdestruct": {
      group: "dangerous",
      label: "Block self-destruct calls",
      hint: "Blocks a call that makes a contract send all the coins it holds to another address.",
      families: ["evm"],
    },
    "evm.blockDelegatecall": {
      group: "dangerous",
      label: "Block borrowed code",
      hint: "Blocks a call where a contract runs another contract's code with its own funds. Upgradeable apps do this too.",
      families: ["evm"],
    },
    "stellar.blockAccountMerge": {
      group: "dangerous",
      label: "Block closing the account",
      hint: "Blocks an account merge, which moves everything to another account and deletes yours.",
      families: ["stellar"],
    },
    "stellar.blockTrustlineRemoval": {
      group: "dangerous",
      label: "Block removing a trustline",
      hint: "Blocks a request that removes a trustline, after which your account cannot receive that asset.",
      families: ["stellar"],
    },
    "casper.blockSessionCode": {
      group: "dangerous",
      label: "Block session code",
      hint: "Blocks a request that runs session code with your account's full authority. Many Casper apps use it for payable calls.",
      families: ["casper"],
    },
    "near.blockDeleteAccount": {
      group: "dangerous",
      label: "Block deleting the account",
      hint: "Blocks a request that deletes your account and sends everything in it to another account.",
      families: ["near"],
    },
    "near.blockContractDeploy": {
      group: "dangerous",
      label: "Block deploying code",
      hint: "Blocks a request that deploys contract code to an account, which then runs with that account's funds.",
      families: ["near"],
    },
    "near.blockIntentsMismatch": {
      group: "dangerous",
      label: "Block swaps that pay someone else",
      hint: "Blocks a NEAR Intents swap whose quote pays out or refunds to another account, or whose deposit does not match the quote.",
      families: ["near"],
    },

    "core.maxLossPercent": {
      group: "limits",
      label: "Largest loss per request",
      hint: "Baret compares your balance before and after. A request that would lose a larger share than this is blocked.",
      unit: "percent of balance",
    },
    "core.minPostBalances": {
      group: "limits",
      label: "Balances to keep",
      hint: "Blocks a request that would leave you with less of an asset than its floor, so you can always pay a fee.",
      unit: "{asset}",
      display: {
        empty: "No floor",
        some: "{count} floors",
        someOne: "{count} floor",
      },
    },

    "core.blockKnownMalicious": {
      group: "reputation",
      label: "Block listed addresses",
      hint: "Blocks a request that touches an address on the Baret registry blocklist or flagged by the reputation provider.",
    },
    "core.minReputationTrust": {
      group: "reputation",
      label: "Lowest trust level you accept",
      hint: "Blocks a request to an address the reputation provider rates below this level.",
      options: {
        new: {
          label: "New",
          hint: "Any address, including an account made today. This sets no minimum.",
        },
        known: {
          label: "Known",
          hint: "Has a history. Blocks brand new accounts.",
        },
        trusted: {
          label: "Trusted",
          hint: "Named by the provider, such as an exchange, a fund or a known app.",
        },
      },
    },

    "core.compliance.required": {
      group: "compliance",
      label: "Require a verified identity",
      hint: "Blocks a transfer unless both accounts hold a valid identity credential.",
    },
    "core.compliance.allowedCountries": {
      group: "compliance",
      label: "Countries you send to",
      hint: "Blocks a transfer to an account verified in a country not on this list. The country comes from its identity credential.",
      display: {
        empty: "Any country",
        some: "{count} countries",
        someOne: "{count} country",
      },
    },
    "core.compliance.minTier": {
      group: "compliance",
      label: "Lowest verification level",
      hint: "Blocks a transfer to an account verified below this level. A higher level means a stronger check.",
      display: {
        any: "Any level",
        some: "Level {limit} or higher",
      },
    },

    "core.maxFee": {
      group: "fees",
      label: "Highest network fee",
      hint: "Blocks a request whose fee could be higher than this.",
      unit: "{native}",
    },
    "evm.maxGas": {
      group: "fees",
      label: "Highest gas limit",
      hint: "Blocks a request that sets a gas limit above this. On some chains, such as Monad, you pay for the whole limit.",
      unit: "gas",
      families: ["evm"],
    },

    "core.x402.requireMemo": {
      group: "x402",
      label: "Require a payment reference",
      hint: "Blocks an agent payment that carries no reference, so every payment can be matched to an invoice.",
    },
    "core.x402.caps": {
      group: "x402",
      label: "Payment caps",
      hint: "Per asset: the most one payment, the last 60 minutes and the last 24 hours may total. The windows roll with each payment.",
      unit: "{asset}",
      display: {
        empty: "No caps",
        some: "Caps on {count} assets",
        someOne: "Caps on {count} asset",
      },
    },
    "core.x402.allowedAssets": {
      group: "x402",
      label: "Assets an agent may pay with",
      hint: "Blocks a payment in any asset not on this list. Assets match by contract, so a look-alike token is blocked too.",
      display: {
        empty: "None, so every payment is blocked",
        some: "{count} assets",
        someOne: "{count} asset",
      },
    },
    "core.x402.allowedMerchantOrigins": {
      group: "x402",
      label: "Sites an agent may pay",
      hint: "Blocks a payment to any site not on this list. Leave it empty to let any site ask, within your caps.",
      display: {
        empty: "Any site, within your caps",
        some: "{count} sites",
        someOne: "{count} site",
      },
    },

    "core.allowWarnings": {
      group: "general",
      label: "Let me sign a Caution",
      hint: "On: you can sign a Caution after you read its findings. Off: any finding blocks the request. Either way, Can't reach Baret counts as Blocked.",
    },
  },

  editor: {
    tabs: { form: "Rules", json: "JSON" },
    jsonHint: "This is the exact rule object Baret evaluates. Edit it here if you prefer.",
    save: "Save rules",
    saved: "Saved. Your rules apply from the next sign request.",
    invalid: "Baret cannot read these rules. Fix the field named in the error, then save.",
    reset: "Back to the template",
    unsaved: "You have unsaved changes.",
  },
} as const satisfies PolicyContentShape;

export type PolicyContent = typeof policy;
