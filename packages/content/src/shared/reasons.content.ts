/**
 * Why a simulation failed, in plain words. A SIMULATION_FAILED finding carries the
 * refusal code in `details.reason`: the code a vault contract returns (its `errors`
 * module) or the one the family adapter sets before simulating (missing key, missing
 * account, not enough balance). The finding's own `body` says only "it failed"; these
 * say what was refused and why, so a reader who is not a developer can follow.
 *
 * Each entry is written out in full, nothing interpolated: the reason carries no values.
 * A code not listed here falls back to the finding's `body`, never to a guess.
 * Chain-neutral: "the vault", "the key", "the native coin", never a chain's name.
 *
 *   body   what was refused and the rule behind it. One or two sentences.
 *   fix    what the reader can do, when there is something to do.
 */

interface Reason {
  body: string;
  fix?: string;
}

export const simulationReasons = {
  // the vault's refusals ----------------------------------------------------

  E_RECEIVER_NOT_ALLOWED: {
    body: "The vault refuses to pay this receiver: it is not on the list of accounts the vault's owner approved. A receiver named in a prompt, a web page or another agent's message is how an agent is usually tricked into paying the wrong account.",
    fix: "Decline. Only the vault's owner can add a receiver to the list.",
  },
  E_PER_TRANSFER_LIMIT: {
    body: "The vault refuses this amount: it is more than the owner allows in a single payment.",
    fix: "Decline, or pay a smaller amount. Only the owner can raise the limit.",
  },
  E_DAILY_LIMIT: {
    body: "The vault refuses this payment: with it, today's payments would add up to more than the owner's daily limit.",
    fix: "Decline. Try again after the daily limit resets, or ask the owner.",
  },
  E_ASSET_NOT_ALLOWED: {
    body: "The vault refuses to pay in this asset: the owner has not allowed it.",
    fix: "Decline, or pay in an asset the owner allowed.",
  },
  E_PAUSED: {
    body: "The vault refuses every payment right now: its owner has paused it.",
    fix: "Decline. Only the owner can resume payments.",
  },
  E_NOT_AGENT: {
    body: "The vault refuses this request: only the agent account its owner named may ask it to pay, and this request comes from another account.",
    fix: "Decline.",
  },
  E_NOT_OWNER: {
    body: "The vault refuses this change: only its owner may change its settings, and this request comes from another account.",
    fix: "Decline. A change to the vault's rules must come from its owner.",
  },
  E_NOT_PENDING_OWNER: {
    body: "The vault refuses this request: only the account its owner offered the vault to may accept it.",
    fix: "Decline.",
  },
  E_AMOUNT_ZERO: {
    body: "The vault refuses a payment of zero.",
  },
  E_BAD_LIMIT: {
    body: "The vault refuses these limits: they are not valid together.",
  },
  E_BAD_EVM_TX: {
    body: "The vault refuses to sign this transaction for another chain: it cannot read it, or the transaction is not a plain payment it may sign.",
    fix: "Decline.",
  },

  // refused before the vault is reached --------------------------------------

  E_KEY_NOT_ALLOWED: {
    body: "The key signing this may not do it. It is a limited key: it may only call certain methods of one contract, with no money attached. Anything else, such as adding a key or moving funds directly, is refused by the chain itself.",
    fix: "Decline. An agent that asks for more than its key allows is doing something it was not set up to do.",
  },
  E_KEY_MISSING: {
    body: "The key signing this is not on the account, so the chain would reject the transaction.",
  },
  E_SIGNER_MISSING: {
    body: "The account that would sign this does not exist.",
  },
  E_RECEIVER_MISSING: {
    body: "The account this transaction is sent to does not exist.",
    fix: "Check the account name for a typo.",
  },
  E_NO_CONTRACT: {
    body: "This transaction calls a contract, but no contract is deployed at that account.",
    fix: "Check the account name for a typo.",
  },
  E_INSUFFICIENT_NEAR: {
    body: "The account does not hold enough of the native coin to cover this.",
  },
  E_INSUFFICIENT_TOKEN: {
    body: "The account does not hold enough of this token to cover the payment.",
  },
  E_VAULT_UNREADABLE: {
    body: "Baret could not read the vault's settings, so it cannot tell whether the vault would pay. A check that cannot run counts as failed.",
    fix: "Check again in a minute.",
  },
} as const satisfies Record<string, Reason>;

export type SimulationReasonsContent = typeof simulationReasons;
