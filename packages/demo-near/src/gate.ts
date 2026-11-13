/**
 * What the agent does with Baret's verdicts (track 06: block → refuse, warn → ask a human).
 * Pure, so the rule is tested without a network or a terminal.
 *
 * - every verdict Safe → sign;
 * - any Blocked, or no verdict at all (timeout, error, bad answer) → refuse (fail-closed);
 * - otherwise (at least one Caution) → ask a human, and sign only on an explicit yes.
 */

export type Verdict = "safe" | "caution" | "blocked" | null;
export type Gate = "sign" | "ask" | "refuse";

export function gate(verdicts: readonly (string | null)[]): Gate {
  if (verdicts.length === 0) return "refuse";
  if (verdicts.some((v) => v !== "safe" && v !== "caution")) return "refuse";
  return verdicts.every((v) => v === "safe") ? "sign" : "ask";
}

/**
 * Where the human's answer comes from. A terminal asks; `--approve` / `--deny` answer for
 * a recorded demo; with neither and no terminal there is nobody to ask, so the answer is no.
 */
export type HumanAnswer = "approve" | "deny" | "ask" | "nobody";

export function humanAnswerSource(argv: readonly string[], isTTY: boolean): HumanAnswer {
  if (argv.includes("--deny")) return "deny";
  if (argv.includes("--approve")) return "approve";
  return isTTY ? "ask" : "nobody";
}

/** Only an explicit yes signs; anything else, an empty line included, is no. */
export function isYes(line: string): boolean {
  return /^\s*(y|yes)\s*$/i.test(line);
}
