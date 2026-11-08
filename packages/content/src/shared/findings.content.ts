/**
 * One entry per finding code in @baret/core (FINDING_CODES). The `satisfies` below makes
 * the compiler refuse a missing or unknown code. Ported from Baret-Metropolis and made
 * chain-neutral: no chain, coin or provider is named unless the code is family-only.
 *
 * The server returns a `code` and the values to fill in, never a sentence. The
 * sign request (wallet, popup, landing mockup) renders the words from here.
 *
 * Each entry:
 *   emitter   the detector that emits the code (today in
 *             packages/chain-evm/src/engine/detectors/<emitter>.ts, D9), "policy-engine"
 *             for the owner's limits (policy-rules.ts), or the family adapter
 *             ("stellar", "casper") for family-only codes not ported yet.
 *   values    every placeholder the strings of this entry use. The server must
 *             send each one. Nothing else is interpolated.
 *   title     the line in the findings list.
 *   body      what this request does, with its numbers.
 *   bodySelf  only on compliance codes: rendered instead of `body` when the
 *             account in question is the user's own. The server says which
 *             side it is in the finding's details.
 *   bodyAsset, bodySelfAsset  only on compliance codes: rendered instead of
 *             `body` / `bodySelf` when the finding's `details.asset` is set.
 *             A compliant asset's own policy demands the credential there,
 *             not a rule the user chose, so the sentence names the asset's
 *             rule instead of "your rules". `details.asset` is the asset's
 *             address, so these sentences say "this asset" and never print
 *             it. `bodyOf()` in `@baret/web-ui/components/CheckBlocks` picks
 *             the right one.
 *   bodyReason  only on KNOWN_MALICIOUS_ADDRESS: rendered instead of `body`
 *             when the registry's `reasonCode` (`details.registry`) is one
 *             `bodyOf()` recognises (today, `SCAMSNIFFER_BLACKLIST`):
 *             written out in full, nothing interpolated, so an unmapped
 *             reasonCode safely falls back to `body` instead of guessing.
 *   why       opens on "Why this matters". One or two sentences.
 *   fix       what the reader can do, when there is something to do.
 *
 * Placeholders. One vocabulary for findings, the wallet sign body and the popup
 * sign request. A name never means two things.
 *   {spender}    who may spend under an allowance
 *   {operator}   who may move items of an NFT collection
 *   {contract}   a contract address
 *   {recipient}  who receives funds, rights or a transfer
 *   {address}    an address whose role the finding does not name (reputation)
 *   {origin}     the site that made the request
 *   {amount}     an amount of an asset, formatted without the symbol
 *   {asset}      an asset symbol
 *   {cap}        a spend cap: a threshold on money an agent may pay
 *   {limit}      any other rule threshold
 *   {actual}     the observed value that was compared with {cap} or {limit}
 *   {expected}   what the other side asked for, compared with {actual}; or,
 *                on LOOKALIKE_ADDRESS, the address the copy imitates
 *   {country}    the country on a verified identity
 *   {tier}       the verification level on a verified identity
 *   {count}      a number of things
 *   {path}       a Chain Signatures derivation path (which derived key signs)
 * Findings that compare numbers always quote both sides.
 *
 * Which rule decides each code is not repeated here: it is FINDING_SPECS in @baret/core.
 */

type Placeholder =
  | "spender"
  | "operator"
  | "contract"
  | "recipient"
  | "address"
  | "origin"
  | "amount"
  | "asset"
  | "cap"
  | "limit"
  | "actual"
  | "expected"
  | "country"
  | "tier"
  | "count"
  | "path";

type Emitter =
  | "stellar"
  | "casper"
  | "near"
  | "simulation"
  | "approvals"
  | "programs"
  | "evm-danger"
  | "reputation"
  | "lookalike"
  | "compliance"
  | "cpi"
  | "compute"
  | "x402"
  | "policy-engine";

interface Finding {
  emitter: Emitter;
  values: readonly Placeholder[];
  title: string;
  body: string;
  bodySelf?: string;
  /** Rendered instead of `body` (or `bodySelf`) when `details.asset` is set. */
  bodyAsset?: string;
  bodySelfAsset?: string;
  /** Rendered instead of `body` on KNOWN_MALICIOUS_ADDRESS when the registry
   *  names a known source (`bodyOf()`). */
  bodyReason?: string;
  why: string;
  fix?: string;
}

import type { FindingCode } from "@baret/core";

export const findings = {
  // simulation detector ----------------------------------------------------

  SIMULATION_FAILED: {
    emitter: "simulation",
    values: [],
    title: "This would fail",
    body: "Baret ran this request without sending it, and it failed. Sent now, it would fail the same way.",
    why: "A failed transaction changes nothing and still costs the network fee. On some chains, such as Monad, that fee covers the whole gas limit.",
    fix: "Decline. Check the amount and the balance, then try again.",
  },
  LOW_CONFIDENCE_INCOMPLETE_DATA: {
    emitter: "simulation",
    values: [],
    title: "Baret saw less than usual",
    body: "The simulation ran without a trace of the calls inside it, so some checks had less to work with.",
    why: "A clean result here covers less than a full check does. Baret tells you so rather than give an answer it cannot back up.",
    fix: "Check again. If this stays, sign only if you know what the request does.",
  },

  // approvals detector -----------------------------------------------------

  APPROVAL_GRANTED: {
    emitter: "approvals",
    values: ["spender", "amount", "asset"],
    title: "New allowance for {spender}",
    body: "This lets {spender} take up to {amount} {asset} from your wallet until you revoke it.",
    why: "An allowance is a standing permission, not a one-time payment. {spender} can use it later without asking you again.",
    fix: "Revoke it once {spender} no longer needs it, so no standing permission is left behind.",
  },
  APPROVAL_UNLIMITED: {
    emitter: "approvals",
    values: ["spender", "asset", "amount"],
    title: "Unlimited allowance",
    body: "This lets {spender} take all of your {asset}, including any you receive later, until you revoke it.",
    why: "An unlimited allowance never runs out. If {spender} is compromised next month, it can still take everything.",
    fix: "Approve only {amount} {asset}, the amount this needs.",
  },
  NFT_OPERATOR_GRANTED: {
    emitter: "approvals",
    values: ["operator", "contract"],
    title: "Access to a whole collection",
    body: "This lets {operator} move every item you hold from {contract}, and any you get later, until you revoke it.",
    why: "Marketplaces ask for this to list your items. Drainers ask for it too, because one signature covers the whole collection.",
    fix: "Approve only if {operator} is the marketplace you meant to use. Revoke it when you stop selling there.",
  },
  APPROVAL_TO_WALLET: {
    emitter: "approvals",
    values: ["spender", "contract"],
    title: "A wallet gets the right to spend",
    body: "This lets {spender} move your tokens from {contract}, and {spender} is a wallet, not an app's contract.",
    why: "Apps take allowances through contracts. A wallet with an allowance is how ice phishing works: nothing moves now, and the thief empties the account later.",
    fix: "Decline. No real app asks you to approve a personal wallet.",
  },
  PERMIT_SIGNATURE_DETECTED: {
    emitter: "approvals",
    values: ["spender", "amount", "asset"],
    title: "A signature that grants an allowance",
    body: "Signing this lets {spender} take up to {amount} {asset}. Nothing shows in your history until they use it.",
    why: "A permit is a signed message, not a transaction. It costs no fee and leaves no record when you sign, so it is easy to miss.",
    fix: "Decline unless you meant to give {spender} this allowance.",
  },

  SIGNATURE_NOT_UNDERSTOOD: {
    emitter: "approvals",
    values: [],
    title: "Baret cannot clear this signature",
    body: "Its kind is one Baret does not know, its fields do not say what it grants, or it is meant for another chain. A signature can give away funds without a transaction.",
    why: "Baret only clears a signature when it can say what it does on this chain. This one it cannot, so it is stopped under every set of rules.",
    fix: "Decline. If the site needs it, ask what the signature authorises and use a transaction Baret can simulate.",
  },

  SIGNATURE_UNRECOGNISED: {
    emitter: "approvals",
    values: [],
    title: "Baret does not know this kind of signature",
    body: "Nothing in this message names another account or a token amount, but Baret cannot say what signing it does.",
    why: "Votes, profiles and sign-ins are signed this way and move no funds. Baret tells you when it cannot read one, so its silence never passes for a check.",
    fix: "Sign only if you know what this site uses the signature for.",
  },

  SIGNED_ORDER_DETECTED: {
    emitter: "approvals",
    values: ["count"],
    title: "A marketplace order",
    body: "Signing this places an order that offers {count} of your tokens or items. Nothing moves now. Anyone can fill it later, at any time before it ends.",
    why: "An order is a standing offer, not a transfer. It stays valid after you close the page, until it ends or you cancel it on-chain.",
    fix: "Check what you give and what you are paid before you sign.",
  },
  ORDER_PAYS_NOTHING: {
    emitter: "approvals",
    values: ["count"],
    title: "This order pays you nothing",
    body: "The order gives away {count} of your tokens or items and pays you nothing. Whoever fills it takes them for free.",
    why: "Drainers ask for an order priced at nothing because it looks like a listing and costs no fee to sign.",
    fix: "Decline. A real listing names what you are paid.",
  },

  // programs detector ------------------------------------------------------

  RISKY_CONTRACT_INTERACTION: {
    emitter: "programs",
    values: ["contract"],
    title: "This contract has been reported",
    body: "{contract} is on the risky list in the Baret reputation registry on this chain.",
    why: "The registry is fed by threat feeds through Chainlink CRE and written on-chain, so you can read the entry yourself. A report can be wrong, but read it before you go on.",
    fix: "Decline unless you know this contract and trust it.",
  },
  CALL_TO_ADDRESS_WITHOUT_CODE: {
    emitter: "programs",
    values: ["address"],
    title: "No contract at {address}",
    body: "This call sends data to {address}, and nothing is deployed there. Whatever the site says the call does will not happen.",
    why: "A token or app address with no code behind it is usually a typo, a wrong network or a poisoned address. The call goes through and does nothing, and the fee is still paid.",
    fix: "Check the address against the project's own docs before you sign. On the wrong network, switch first.",
  },
  UNKNOWN_CONTRACT_EXPOSURE: {
    emitter: "programs",
    values: ["contract"],
    title: "Baret does not know this contract",
    body: "{contract} is on no list Baret reads, so nothing vouches for it.",
    why: "Unknown does not mean harmful. Every new contract starts here. It means nobody Baret trusts has looked at it yet.",
    fix: "Compare the address with the one in the project's own docs before you sign.",
  },
  VALUE_KEPT_BY_UNKNOWN_CONTRACT: {
    emitter: "programs",
    values: ["contract", "amount", "asset"],
    title: "Nothing comes back for what you send",
    body: "{contract} is on no list Baret reads. In the simulation it takes {amount} {asset} from you and you receive nothing.",
    why: "A deposit, a stake or a purchase gives you something in the same transaction: a receipt token, the thing you bought. Here nothing arrives, and nobody vouches for the contract that keeps your funds.",
    fix: "Decline. If the app says something arrives later, check that against its own docs first.",
  },

  // evm-danger detector ----------------------------------------------------

  SELFDESTRUCT_CALL: {
    emitter: "evm-danger",
    values: ["contract"],
    title: "A contract empties itself",
    body: "This call runs a self-destruct in {contract}, which sends all the native coin it holds to another address.",
    why: "If you have coins deposited in {contract}, they leave in this same transaction. Normal apps rarely do this.",
    fix: "Decline unless you deployed {contract} and mean to shut it down.",
  },
  DELEGATECALL_DETECTED: {
    emitter: "evm-danger",
    values: ["contract"],
    title: "Borrowed code runs here",
    body: "{contract} runs code from another contract, with its own funds and permissions.",
    why: "Upgradeable contracts do this for good reasons. Attacks do it too, because the code that runs is not the code you were shown.",
    fix: "Decline unless the project documents an upgradeable contract at {contract}.",
  },
  ACCOUNT_CODE_DELEGATION: {
    emitter: "evm-danger",
    values: ["contract"],
    title: "This hands your account to a contract",
    body: "The transaction makes your account run the code at {contract}. Whoever controls that code can then move everything the account holds.",
    why: "The simulation does not apply this change, so Baret cannot show what happens after it. It is stopped under every set of rules.",
    fix: "Decline. A wallet upgrade is something you start yourself, never something a site sends you.",
  },
  AUTHORITY_CHANGE: {
    emitter: "evm-danger",
    values: ["contract", "recipient"],
    title: "Control changes hands",
    body: "Admin rights over {contract} move to {recipient}.",
    why: "Whoever holds these rights can often pause, upgrade or empty the contract or the account. On some chains this is a new signer or a changed threshold on your own account. A handover you did not start is a reason to stop.",
    fix: "Decline unless you own {contract} and chose {recipient} yourself.",
  },

  // reputation detector (a reputation provider and the on-chain ReputationRegistry)

  KNOWN_MALICIOUS_ADDRESS: {
    emitter: "reputation",
    values: ["address"],
    title: "This address is on a blocklist",
    body: "{address} is on the blocklist in the Baret reputation registry or is flagged by a reputation provider.",
    /** Rendered instead of `body` when the registry's reasonCode is
     *  SCAMSNIFFER_BLACKLIST (`bodyOf()`), naming the actual list instead of
     *  the generic "the blocklist ... or is flagged by a reputation provider". */
    bodyReason: "{address} is on ScamSniffer's public blacklist.",
    why: "An address on that list was reported for taking funds it should not take. Anything this request gives it may be gone for good.",
    fix: "Decline. If you are sure the listing is wrong, confirm the address with the project first.",
  },
  LOOKALIKE_ADDRESS: {
    emitter: "lookalike",
    values: ["address", "expected"],
    title: "This address copies another one",
    body: "{address} starts and ends like {expected}, but it is a different address.",
    why: "Wallets show the first and last characters, so a copy looks the same at a glance. Scammers grind addresses like this to pose as an app, a token or your own account.",
    fix: "Decline. Copy the address from the project's own docs, never from your history or a link.",
  },
  REPUTATION_FRESH_ACCOUNT: {
    emitter: "reputation",
    values: ["address"],
    title: "A brand new wallet",
    body: "{address} is a fresh account with almost no history.",
    why: "People and businesses usually leave a trail. Scams often collect money in wallets made days before.",
    fix: "Confirm the address with the person or site you are paying, through a second channel.",
  },
  REPUTATION_WHALE_COUNTERPARTY: {
    emitter: "reputation",
    values: ["address"],
    title: "A very large holder",
    body: "{address} is a whale, an address with a very large balance.",
    why: "This is information, not an accusation. In a trade, a holder this size can move the price before your order fills.",
  },
  REPUTATION_TRUST_BELOW_MINIMUM: {
    emitter: "reputation",
    values: ["address", "actual", "limit"],
    title: "Below your trust level",
    body: "{address} is rated {actual}. Your rules need {limit} or higher.",
    why: "Your trust level rule keeps money away from addresses little is known about. This one is below the level you chose.",
    fix: "Confirm the address another way, or lower your trust level rule.",
  },
  REPUTATION_DATA_UNAVAILABLE: {
    emitter: "reputation",
    values: [],
    title: "Reputation data did not load",
    body: "The reputation provider or the Baret reputation registry did not answer, so the addresses in this request were not checked.",
    why: "A rule that cannot be checked counts as failed, not passed. No rule turns this off.",
    fix: "Check again in a moment.",
  },

  // compliance detector (Cleanverse identity credentials) --------------------

  COMPLIANCE_NO_CREDENTIAL: {
    emitter: "compliance",
    values: ["recipient"],
    title: "No verified identity",
    body: "{recipient} has no Cleanverse identity credential, and your rules require one.",
    bodySelf: "Your account has no Cleanverse identity credential, and your rules require one.",
    /** Shown instead of `body` when the finding's `details.asset` is set: the
     *  asset's own policy demands this, not a rule the user chose. */
    bodyAsset:
      "{recipient} has no Cleanverse identity credential, and this asset only moves between verified wallets.",
    bodySelfAsset:
      "Your account has no Cleanverse identity credential, and this asset only moves between verified wallets.",
    why: "A compliant asset checks the identity on both sides of every transfer itself, and your own compliance rule can ask for the same check on other assets. Cleanverse issues the credential and Baret reads it.",
    fix: "The account without a credential needs to verify with Cleanverse first.",
  },
  COMPLIANCE_EXPIRED: {
    emitter: "compliance",
    values: ["recipient"],
    title: "Verification has expired",
    body: "The Cleanverse credential on {recipient} has expired.",
    bodySelf: "The Cleanverse credential on your account has expired.",
    bodyAsset:
      "The Cleanverse credential on {recipient} has expired, and this asset only moves between verified wallets.",
    bodySelfAsset:
      "The Cleanverse credential on your account has expired, and this asset only moves between verified wallets.",
    why: "Credentials have an end date. Until it is renewed, a compliant asset or your own rule treats the account as unverified.",
    fix: "The account owner renews it with Cleanverse. The transfer can go through after that.",
  },
  COMPLIANCE_TIER_INSUFFICIENT: {
    emitter: "compliance",
    values: ["recipient", "tier", "limit"],
    title: "Verification level too low",
    body: "{recipient} is verified at level {tier}. Your rules need level {limit} or higher.",
    why: "A higher level means a stronger identity check. You chose the lowest level you accept.",
    fix: "Send to an account verified at level {limit} or higher, or lower your minimum level.",
  },
  COMPLIANCE_COUNTRY_DISALLOWED: {
    emitter: "compliance",
    values: ["recipient", "country"],
    title: "Country not on your list",
    body: "{recipient} is verified in {country}, which is not on your list of allowed countries.",
    why: "Your country rule limits transfers to accounts verified in the countries you chose. The country comes from the Cleanverse credential.",
    fix: "Add {country} to your allowed countries if you mean to send there.",
  },
  COMPLIANCE_DATA_UNAVAILABLE: {
    emitter: "compliance",
    values: [],
    title: "Identity check did not load",
    body: "Cleanverse did not answer, so the identity on each side of this transfer was not checked.",
    bodyAsset:
      "Cleanverse did not answer, so the identity check this asset requires on each side of the transfer did not run.",
    why: "A rule that cannot be checked counts as failed, not passed. No rule turns this off.",
    fix: "Check again in a moment.",
  },

  // cpi detector ------------------------------------------------------------

  DEEP_CALL_NESTING: {
    emitter: "cpi",
    values: ["count"],
    title: "Calls go deeper than they look",
    body: "One contract calls the next, {count} levels deep. The site showed you only the first.",
    why: "Depth alone is not an attack. The deeper it goes, the less the site's summary tells you about what runs.",
    fix: "Read What changes before you sign. It shows the result of every level.",
  },
  HIGH_OPERATION_COUNT: {
    emitter: "cpi",
    values: ["count"],
    title: "Many actions in one signature",
    body: "This request bundles {count} separate operations.",
    why: "Batching is normal. It is also how one extra transfer hides between the ones you expected.",
    fix: "Check each line in What changes before you sign.",
  },

  // compute detector --------------------------------------------------------

  EXCESSIVE_FEE: {
    emitter: "compute",
    values: ["actual", "limit"],
    title: "Fee above your rule",
    body: "This request can cost up to {actual}. Your rules allow up to {limit}.",
    why: "A fee or gas limit far above normal costs more and leaves room for a heavier path. On some chains, such as Monad, you pay for the whole gas limit even if the transaction never uses it.",
    fix: "Decline, or raise your fee rule if you expected a heavy transaction.",
  },

  // policy engine: loss limits ------------------------------------------------

  ESTIMATED_LOSS_EXCEEDS_MAX: {
    emitter: "policy-engine",
    values: ["actual", "limit"],
    title: "Loss above your limit",
    body: "This request would cost you {actual} of your balance. Your rules allow {limit}.",
    why: "Baret compares your balance before and after the simulation. The difference includes the network fee.",
    fix: "Lower the amount, or raise your loss limit if you meant to move this much.",
  },
  LOSS_PERCENT_UNAVAILABLE: {
    emitter: "policy-engine",
    values: [],
    title: "Could not measure the loss",
    body: "Baret could not read your balance before or after this request, so your loss limit was not checked.",
    why: "A rule that cannot be checked counts as failed, not passed. No rule turns this off.",
    fix: "Check again in a moment.",
  },
  POST_BALANCE_TOO_LOW: {
    emitter: "policy-engine",
    values: ["actual", "limit", "asset"],
    title: "Below your {asset} floor",
    body: "You would have {actual} {asset} left. Your rules keep at least {limit} {asset}.",
    why: "The floor keeps enough in the account to pay fees and move your funds later.",
    fix: "Send less, or add {asset} to this account first.",
  },
  POST_BALANCE_UNAVAILABLE: {
    emitter: "policy-engine",
    values: ["asset"],
    title: "Could not check your floor",
    body: "Baret could not work out how much {asset} you would have left, so your floor was not checked.",
    why: "A rule that cannot be checked counts as failed, not passed. No rule turns this off.",
    fix: "Check again in a moment.",
  },

  // x402 detector -------------------------------------------------------------

  X402_DESTINATION_MISMATCH: {
    emitter: "x402",
    values: ["expected", "actual"],
    title: "Payment goes to a different address",
    body: "The server asked to be paid at {expected}. This payment goes to {actual}.",
    why: "An agent paying a 402 response rarely compares the two. A mismatch is what a tampered payment request looks like.",
    fix: "Decline, then load the payment request again from the merchant.",
  },
  X402_ASSET_MISMATCH: {
    emitter: "x402",
    values: ["expected", "actual"],
    title: "Paid in a different asset",
    body: "The server asked for {expected}. This payment sends {actual}.",
    why: "Swapping the asset at the last step turns a small, known payment into something else.",
    fix: "Decline, then load the payment request again from the merchant.",
  },
  X402_NON_CANONICAL_ASSET: {
    emitter: "x402",
    values: ["asset", "contract"],
    title: "Not the real {asset}",
    body: "This token is named {asset}, but its contract {contract} is not the {asset} on your allowed list.",
    why: "Anyone can deploy a token and give it a famous name. Baret compares the contract address, not the name.",
    fix: "Decline. Pay only with the {asset} on your allowed list.",
  },
  X402_ASSET_NOT_ALLOWED: {
    emitter: "x402",
    values: ["asset"],
    title: "{asset} is not on your list",
    body: "This payment is in {asset}, which is not on your list of assets an agent may pay with.",
    why: "Your agent pays only in the assets you listed. Anything else is blocked, whatever the amount.",
    fix: "Add {asset} to your allowed assets if you trust it.",
  },
  X402_MEMO_MISSING: {
    emitter: "x402",
    values: [],
    title: "No payment reference",
    body: "Your rules require a reference on every payment, and this request has none.",
    why: "Without a reference, neither you nor the merchant can match this payment to an invoice later.",
    fix: "Ask the merchant for a payment request that carries a reference.",
  },

  // policy engine: payments (merchant list, caps, spend history) -------------

  X402_MERCHANT_NOT_ALLOWED: {
    emitter: "policy-engine",
    values: ["origin"],
    title: "Site not on your payment list",
    body: "{origin} asked for a payment, and it is not on your list of sites an agent may pay.",
    why: "The list stops an agent from paying anyone who answers with a 402. Every site not on it is blocked.",
    fix: "Add {origin} to your allowed sites if you trust it.",
  },
  X402_PER_TX_CAP_EXCEEDED: {
    emitter: "policy-engine",
    values: ["origin", "actual", "cap", "asset"],
    title: "Above your cap per payment",
    body: "{origin} asked for {actual} {asset}. Your cap per payment is {cap} {asset}.",
    why: "The cap limits what a single request can take, however the request was written.",
    fix: "Raise the cap if this price is what you expected.",
  },
  X402_HOURLY_CAP_EXCEEDED: {
    emitter: "policy-engine",
    values: ["amount", "actual", "cap", "asset"],
    title: "Hourly cap reached",
    body: "This payment of {amount} {asset} would bring the last hour to {actual} {asset}. Your hourly cap is {cap} {asset}.",
    why: "The hour rolls with each payment, it is not a clock hour. An agent stuck in a loop hits this cap long before it empties the account.",
    fix: "Wait until earlier payments are more than an hour old, or raise the cap.",
  },
  X402_DAILY_CAP_EXCEEDED: {
    emitter: "policy-engine",
    values: ["amount", "actual", "cap", "asset"],
    title: "Daily cap reached",
    body: "This payment of {amount} {asset} would bring the last 24 hours to {actual} {asset}. Your daily cap is {cap} {asset}.",
    why: "The day rolls with each payment. It sets the most an agent can spend while nobody is watching.",
    fix: "Wait until earlier payments are more than 24 hours old, or raise the cap.",
  },
  X402_SPEND_HISTORY_UNAVAILABLE: {
    emitter: "policy-engine",
    values: [],
    title: "Could not check your caps",
    body: "Baret could not read your recent payments, so your hourly and daily caps were not checked.",
    why: "A rule that cannot be checked counts as failed, not passed. No rule turns this off.",
    fix: "Check again in a moment.",
  },
  // x402 detector, new in v2 (from the Stellar and Casper builds) ---------------

  X402_AMOUNT_MISMATCH: {
    emitter: "x402",
    values: ["expected", "actual"],
    title: "Pays more than was asked",
    body: "The server asked for {expected}. This payment sends {actual}.",
    why: "An agent rarely checks the amount it signs. Paying more than the 402 asked for is what a tampered request looks like.",
    fix: "Decline, then load the payment request again from the merchant.",
  },
  X402_NETWORK_MISMATCH: {
    emitter: "x402",
    values: ["expected", "actual"],
    title: "Payment request for another network",
    body: "The server asked to be paid on {expected}. This payment is on {actual}.",
    why: "The same address can exist on many chains. A payment on the wrong one may never reach the merchant.",
    fix: "Decline, then switch to the network the merchant asked for.",
  },
  X402_SHAPE_INVALID: {
    emitter: "x402",
    values: [],
    title: "Baret cannot read this payment request",
    body: "The server's 402 answer names an asset or a payee Baret cannot read on this chain, so the payment cannot be checked against it.",
    why: "A payment that cannot be compared with what was asked is not checked at all. It is stopped under every set of rules.",
    fix: "Decline, and tell the merchant its payment request is malformed.",
  },
  X402_FACILITATOR_MISMATCH: {
    emitter: "x402",
    values: ["expected", "actual"],
    title: "A different payment processor",
    body: "The payment would be settled by {actual}, not by {expected}.",
    why: "The facilitator settles the payment on chain. One you did not expect may hold or redirect it.",
    fix: "Decline unless you know this facilitator.",
  },

  // Stellar only (adapter not ported yet: TASKS.md T3.1) ----------------------

  ACCOUNT_MERGE_DETECTED: {
    emitter: "stellar",
    values: ["recipient"],
    title: "This closes your account",
    body: "This merges your account into {recipient}: everything it holds moves there and the account is deleted.",
    why: "A merge cannot be undone and leaves nothing behind. Drainers ask for it because one signature takes the whole balance.",
    fix: "Decline unless you mean to close this account and chose {recipient} yourself.",
  },
  MASTER_KEY_REMOVED: {
    emitter: "stellar",
    values: [],
    title: "Your key stops controlling the account",
    body: "This sets your own key's weight to zero. After it, only the other signers can act for the account.",
    why: "Whoever holds the remaining signers then owns the account. It is how a Stellar account is taken over in one step.",
    fix: "Decline unless you set up the other signers yourself and meant to do this.",
  },
  TRUSTLINE_CHANGE_DETECTED: {
    emitter: "stellar",
    values: ["asset"],
    title: "A change to what your account can hold",
    body: "This changes your account's trustline for {asset}.",
    why: "A trustline lets an asset reach your account. Adding one for an unknown asset is how spam and fake tokens arrive.",
    fix: "Sign only if you meant to hold {asset}.",
  },
  TRUSTLINE_REMOVED: {
    emitter: "stellar",
    values: ["asset"],
    title: "A trustline is removed",
    body: "This removes your account's trustline for {asset}.",
    why: "Without the trustline your account cannot receive {asset} any more.",
    fix: "Sign only if you no longer want to hold {asset}.",
  },
  UNLIMITED_TRUSTLINE: {
    emitter: "stellar",
    values: ["asset"],
    title: "No limit on an asset",
    body: "This lets your account hold any amount of {asset}.",
    why: "It is common and usually fine. It also means nothing caps how much of an unknown asset can be sent to you.",
  },
  UNSIGNED_AUTH_ENTRY: {
    emitter: "stellar",
    values: ["address"],
    title: "Another signature is still needed",
    body: "Part of this request needs a signature from {address}, which this signature does not cover.",
    why: "A contract call can carry approvals from several accounts. Until all of them sign, Baret cannot be sure what finally runs.",
    fix: "Sign only if you know who adds the other signature and why.",
  },

  // Casper only (adapter not ported yet: TASKS.md T4.2) -----------------------

  SESSION_CODE_EXECUTION: {
    emitter: "casper",
    values: [],
    title: "Your account runs code you were not shown",
    body: "This request runs session code with your account's full authority, not a call to a deployed contract.",
    why: "Session code can do anything your key can do. Many Casper apps use it for payable calls, which is why only Strict blocks it.",
    fix: "Sign only if this is the app you meant to use and its code is published.",
  },

  // NEAR only (ADR-0011) -------------------------------------------------------

  ACCOUNT_DELETE_DETECTED: {
    emitter: "near",
    values: ["recipient"],
    title: "This deletes your account",
    body: "This request deletes your account and sends everything in it to {recipient}.",
    why: "A deleted account cannot be recovered. Its balance goes to {recipient}, whoever that is.",
    fix: "Do not sign unless you meant to close this account and you know {recipient}.",
  },
  CONTRACT_DEPLOY_DETECTED: {
    emitter: "near",
    values: ["address"],
    title: "This replaces the code on an account",
    body: "This request deploys new contract code to {address}. Whatever that code does, it then does with the account's funds.",
    why: "New code can move everything the account holds. Apps rarely ask a person to deploy code.",
    fix: "Sign only if you wrote or reviewed the code and meant to deploy it.",
  },
  FUNCTION_CALL_KEY_ADDED: {
    emitter: "near",
    values: ["contract", "amount", "asset"],
    title: "A limited key for {contract}",
    body: "This request adds a key that can call {contract} for you, with up to {amount} {asset} for fees. It cannot move your other funds.",
    why: "Apps add keys like this so you do not sign every call. Check that {contract} is the app you are using.",
  },
  CHAIN_SIGNATURE_REQUEST: {
    emitter: "near",
    values: ["path", "contract"],
    title: "A signature for another chain",
    body: "This request asks {contract} to sign a transaction on another chain with the key at path {path}.",
    why: "Baret checks the NEAR side of this request. The transaction on the other chain is signed, not simulated here.",
  },
  INTENTS_RECIPIENT_MISMATCH: {
    emitter: "near",
    values: ["recipient", "address"],
    title: "The swap pays someone else",
    body: "The quote for this swap sends the output or the refund to {recipient}, not to {address}.",
    why: "A NEAR Intents swap pays whoever the quote names. A quote changed by a page, a prompt or an app sends your money to that account.",
    fix: "Decline. Ask for a new quote that names your own account.",
  },
  INTENTS_DEPOSIT_MISMATCH: {
    emitter: "near",
    values: ["address"],
    title: "The deposit does not match the quote",
    body: "This request does not send the quote's amount and asset to its deposit address {address}.",
    why: "The swap starts only from the deposit the quote expects. Anything else is lost, refunded late, or paid to another swap.",
    fix: "Decline, then build the deposit again from the quote.",
  },
  INTENTS_QUOTE_INVALID: {
    emitter: "near",
    values: [],
    title: "The swap quote cannot be checked",
    body: "A quote came with this request, but Baret could not read it, it has expired, or it has no deposit address.",
    why: "Without a readable quote, Baret cannot tell who the swap pays. A check that cannot run counts as failed.",
    fix: "Get a fresh quote and try again.",
  },
  INTENTS_APP_FEE: {
    emitter: "near",
    values: ["amount", "recipient"],
    title: "An app fee of {amount}",
    body: "The quote takes {amount} of the swap for {recipient}.",
    why: "Apps may add a fee to a swap. A fee you did not expect is worth a look before you sign.",
  },
} as const satisfies Record<FindingCode, Finding>;

export type FindingsContent = typeof findings;
