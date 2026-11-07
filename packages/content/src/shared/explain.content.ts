/**
 * The plain-words block: KIMI's reading of a verdict, shown under Baret's own
 * findings in the showcase panel and the wallet's sign screens.
 *
 * The byline says who wrote it and that it cannot change the verdict (D-028):
 * the server copies the decision from Baret, the model only words it. The
 * language names are the three the /v1/explain route accepts.
 */
export const explain = {
  title: "In plain words",
  byline:
    "Written by KIMI, a language model, from Baret's findings. It explains the verdict and cannot change it.",
  languageLabel: "Language",
  languages: { en: "English", tr: "Turkish", zh: "Chinese" },
  loading: "KIMI is writing it in plain words...",
  unavailable: "KIMI is not available right now. Try again in a minute.",
} as const;

export type ExplainContent = typeof explain;
