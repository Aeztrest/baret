/**
 * The Baret analysis panel on the demo sites (apps/web/src/sites/kit/panel). Ported
 * from Baret-Metropolis (showcase/panel.content.ts). The older panel labels
 * (expected, live, findings, changes, the phases of the walk) stay in
 * demoFrame.panel; this adds what the panel's layout says on top of them.
 */
export const analysisPanel = {
  /**
   * The four stages shown while one request is checked. Each site's
   * useCheck walks demoFrame.panel.phases, so this list has the same length.
   */
  stages: [
    {
      title: "Simulating on Monad testnet",
      note: "Running the transaction on a copy of the chain.",
    },
    { title: "Reading what changes", note: "Tokens in, tokens out and every allowance." },
    { title: "Running the checks", note: "Spender, contract, amounts and known drainers." },
    { title: "Applying your rules", note: "Your caps and limits decide the verdict." },
  ],
  /** Above the stages while the check runs. */
  checking: "Checking before you sign",
  /** Read out once per stage. {stage} is the stage title. */
  stageAria: "Checking: {stage}",
  /** The skeleton under the stages. */
  pendingVerdict: "Verdict comes next",

  /** The small label above the big verdict. */
  verdictKicker: {
    live: "Baret's verdict",
    sample: "Expected verdict",
    failed: "Baret's verdict",
  },
  /** The one-line comparison under a live verdict, for judges. */
  compare: {
    expected: "Expected",
    live: "Live",
    match: "Matches",
    mismatch: "Differs",
  },
  /** The collapsed block at the end of the panel. */
  details: {
    summary: "Details for the curious",
    hint: "The call, what the site claims and how the verdict was reached.",
  },
  findingsCount: {
    one: "1 finding",
    many: "{count} findings",
  },
} as const;

export type AnalysisPanelContent = typeof analysisPanel;
