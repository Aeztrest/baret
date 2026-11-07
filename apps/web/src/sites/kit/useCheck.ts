import type { Address } from "@baret/demo-evm/wallet";
import { runCheck } from "@baret/web-ui/lib/check";
import type { CheckResult, CheckSource } from "@baret/web-ui/lib/check-types";
import { useReduce } from "@baret/web-ui/lib/useReduce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_CHECK_FROM, isDemoAddress } from "./wallet/useDemoWallet.js";

/**
 * The panel's state: idle, then a walk through the analysis phases, then the
 * result. The phases mirror what Baret does (read, simulate, run the
 * detectors, apply the rules) at 160 ms each. The result shows once the walk
 * is over and the answer is in: a fast answer waits for the walk, a slow one
 * keeps the last phase lit until it lands or the check times out. Reduced
 * motion skips the walk and waits on the last phase.
 *
 * A prepared sample (no address to simulate from) offers "Check it live":
 * the same input again from DEMO_CHECK_FROM, so a visitor with no wallet
 * still sees Baret's server answer, and KIMI's plain words with it. Nothing
 * is fetched until that press.
 */

export type CheckState =
  | { readonly phase: "idle" }
  | { readonly phase: "checking"; readonly step: number; readonly result: CheckResult | null }
  | {
      readonly phase: "done";
      readonly result: CheckResult;
      /** True when this answer was simulated from the demo address, not the visitor's. */
      readonly demo?: boolean;
      /** Set on a sample whose input had no address: runs it live from the demo address. */
      readonly checkLive?: () => void;
    };

/** What every site's input carries: the address a live check simulates from, null for the sample. */
export interface FromInput {
  readonly from: Address | null;
}

/** The same input, simulated from the demo address. Pure, exported for tests. */
export function demoInput<I extends FromInput>(input: I): I {
  return { ...input, from: DEMO_CHECK_FROM };
}

/**
 * An input that carries `from: null`: a site check with no address. Inputs
 * of another shape (the agents playground's) never offer the live check.
 */
function noAddress(input: unknown): input is FromInput {
  return typeof input === "object" && input !== null && "from" in input && input.from === null;
}

/** Whether a site's input simulates from Baret's demo account (no wallet, DEMO_FROM set). Pure, exported for tests. */
export function fromDemo(input: unknown): boolean {
  return (
    typeof input === "object" &&
    input !== null &&
    "from" in input &&
    isDemoAddress((input as { from: unknown }).from as Address | null)
  );
}

/** Whether "Check it live" is offered: a sample answer to an input with no address. */
export function offersLive(state: CheckState, input: unknown): boolean {
  return state.phase === "done" && state.result.source === "sample" && noAddress(input);
}

export const STEP_MS = 450;

/** The phase timer ticked. Pure, exported for tests. */
export function advance(state: CheckState, steps: number): CheckState {
  if (state.phase !== "checking") return state;
  if (state.step + 1 < steps) return { ...state, step: state.step + 1 };
  return state.result ? { phase: "done", result: state.result } : state;
}

/** The answer arrived. Pure, exported for tests. */
export function settle(state: CheckState, result: CheckResult, steps: number): CheckState {
  if (state.phase !== "checking") return state;
  return state.step >= steps - 1 ? { phase: "done", result } : { ...state, result };
}

export function useCheck<I>(
  steps: number,
  source: CheckSource<I>,
): {
  state: CheckState;
  start: (input: I) => void;
  reset: () => void;
} {
  const reduce = useReduce();
  const [state, setState] = useState<CheckState>({ phase: "idle" });
  // Only the latest run may write its answer; starting again or closing
  // aborts the one before.
  const run = useRef(0);
  const controller = useRef<AbortController | null>(null);
  // The input of the last run, which "Check it live" sends again.
  const last = useRef<I | null>(null);
  const [demo, setDemo] = useState(false);

  const stop = useCallback(() => {
    run.current += 1;
    controller.current?.abort();
    controller.current = null;
  }, []);

  const begin = useCallback(
    (input: I, fromDemo: boolean) => {
      stop();
      last.current = input;
      setDemo(fromDemo);
      const id = run.current;
      const ctrl = new AbortController();
      controller.current = ctrl;
      setState({ phase: "checking", step: reduce ? Math.max(steps - 1, 0) : 0, result: null });
      void runCheck(source, input, ctrl).then((result) => {
        if (run.current === id) setState((s) => settle(s, result, steps));
      });
    },
    [reduce, steps, source, stop],
  );

  // A site with no wallet simulates from the demo account: the answer is marked so the panel says it.
  const start = useCallback((input: I) => begin(input, fromDemo(input)), [begin]);

  const checkLive = useCallback(() => {
    const input = last.current;
    // Same shape as the input, only `from` changed, so it is still an I.
    if (noAddress(input)) begin(demoInput(input) as I, true);
  }, [begin]);

  const reset = useCallback(() => {
    stop();
    setState({ phase: "idle" });
  }, [stop]);

  useEffect(() => {
    if (state.phase !== "checking") return;
    const id = window.setTimeout(() => setState((s) => advance(s, steps)), STEP_MS);
    return () => window.clearTimeout(id);
  }, [state, steps]);

  useEffect(() => stop, [stop]);

  const shown = useMemo<CheckState>(() => {
    if (state.phase !== "done") return state;
    return offersLive(state, last.current) ? { ...state, demo, checkLive } : { ...state, demo };
  }, [state, demo, checkLive]);

  return { state: shown, start, reset };
}
