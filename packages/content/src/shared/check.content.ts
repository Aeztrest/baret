/**
 * The result of one check, as every surface lays it out: the expected and live
 * verdicts, what the site asks for, what changes and the findings. Rendered by the
 * shared blocks in @baret/web-ui (CheckBlocks), so the showcase's Baret panel and the
 * web wallet read the same. Finding titles and sentences live in shared/findings, the
 * verdict words in shared/common.
 *
 * Ported from Baret-Metropolis, where these strings sat in showcase/hub (frame.panel,
 * frame.claims, cardLabels) and wallet/sign (changes). Chain-neutral: the chain's name
 * is never written here.
 */

export const check = {
  panel: {
    asks: "What the site asks for",
    call: "The call",
    expected: "Expected verdict",
    expectedNote:
      "Expected under the Balanced rules, the default. Your own rules can change the result.",
    live: "Live verdict",
    match: "The live verdict matches the expected one.",
    mismatch:
      "The live verdict differs from the expected one. Your rules may differ from Balanced, or a check may not have finished.",
    findings: "Findings",
    noFindings: "No findings. Nothing in this request broke a rule.",
  },

  /** An agent payment stopped because it would cross a cap. It counts as Blocked. */
  capped: "Blocked at the cap",

  claims: {
    title: "The site says",
    check: "Baret checks",
    note: "Nothing a page says about itself is verified. Baret reads the transaction instead.",
  },

  changes: {
    title: "What changes",
    out: "You send",
    in: "You receive",
    allow: "You allow",
    revoke: "You revoke",
    unlimited: "Unlimited",
    none: "Nothing leaves your wallet.",
    disclaimer:
      "Simulated against the chain as it is right now. If the chain changes before this lands, the result can differ.",
  },
} as const;

export type CheckContent = typeof check;
