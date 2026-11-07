import type { CheckResult, CheckSource } from "./check-types.js";

/**
 * Running one check, fail-closed. Whatever the source does (answers,
 * rejects, never settles), `runCheck` resolves with a result: the answer, or
 * FAILED, whose verdict is Blocked. A demo that cannot hear from Baret never
 * shows a green light.
 */

/** Long enough for a simulation plus the reputation lookups on testnet. */
export const CHECK_TIMEOUT_MS = 15_000;

export const FAILED: CheckResult = {
  source: "failed",
  verdict: "blocked",
  findings: [],
  changes: [],
  approvals: [],
};

export function runCheck<I>(
  source: CheckSource<I>,
  input: I,
  controller: AbortController,
  timeoutMs: number = CHECK_TIMEOUT_MS,
): Promise<CheckResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CheckResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(FAILED);
    }, timeoutMs);
  });
  const answer = Promise.resolve()
    .then(() => source(input, controller.signal))
    .catch(() => FAILED);
  return Promise.race([answer, timeout]).finally(() => clearTimeout(timer));
}
