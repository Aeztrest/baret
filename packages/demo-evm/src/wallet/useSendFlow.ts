import { useCallback, useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { type SendError, sendErrorOf } from "./errors.js";
import { confirmCall, readTokenBalance, refreshBalance, type SendCall, sendCall } from "./store.js";

/**
 * A site's "Sign with your wallet": calls sent to the connected wallet in
 * order, each confirmed on Monad testnet before the next is asked for, so an
 * allowance exists before the call that spends it is estimated. Optionally
 * one token's balance is read before the first call and after the last,
 * which is how a drain shows. Starting again, a reset or an unmount drops the
 * run before; a prompt already open stays open in the wallet.
 */

/** "unconfirmed": the wallet sent it, and Monad testnet gave no receipt in time; it may still land. */
export type StepStatus =
  | "waiting"
  | "confirm"
  | "pending"
  | "done"
  | "declined"
  | "unconfirmed"
  | "failed";

export interface StepState {
  readonly status: StepStatus;
  readonly hash: Hex | null;
}

/** Why a run stopped: the wallet's reason, a call that ran and failed, or no receipt in time. */
export type FlowError = SendError | "reverted" | "timeout";

export interface FlowState {
  readonly phase: "idle" | "running" | "done" | "stopped";
  readonly steps: readonly StepState[];
  readonly error: FlowError | null;
  /** The tracked token's balance before the first step and after the last, in base units. */
  readonly before: bigint | null;
  readonly after: bigint | null;
}

export const IDLE: FlowState = { phase: "idle", steps: [], error: null, before: null, after: null };

function withStep(
  state: FlowState,
  index: number,
  patch: Partial<StepState>,
): readonly StepState[] {
  return state.steps.map((step, i) => (i === index ? { ...step, ...patch } : step));
}

/** A new run: `count` steps, all waiting. */
export function begin(count: number): FlowState {
  return {
    ...IDLE,
    phase: "running",
    steps: Array.from({ length: count }, () => ({ status: "waiting", hash: null })),
  };
}

export function measured(state: FlowState, before: bigint | null): FlowState {
  return { ...state, before };
}

/** The wallet is asked to sign the step. */
export function asking(state: FlowState, index: number): FlowState {
  return { ...state, steps: withStep(state, index, { status: "confirm" }) };
}

/** The wallet sent it; Monad testnet has not confirmed it yet. */
export function sent(state: FlowState, index: number, hash: Hex): FlowState {
  return { ...state, steps: withStep(state, index, { status: "pending", hash }) };
}

export function confirmed(state: FlowState, index: number): FlowState {
  return { ...state, steps: withStep(state, index, { status: "done" }) };
}

/**
 * The run ends at this step. A declined step says so; a step with no receipt
 * in time is unconfirmed and keeps its hash, since it may still land;
 * anything else failed.
 */
export function stopped(state: FlowState, index: number, error: FlowError): FlowState {
  const status: StepStatus =
    error === "rejected" ? "declined" : error === "timeout" ? "unconfirmed" : "failed";
  return { ...state, phase: "stopped", error, steps: withStep(state, index, { status }) };
}

export function finished(state: FlowState, after: bigint | null): FlowState {
  return { ...state, phase: "done", after };
}

/** How one step reaches a wallet: the injected provider by default, else the Baret window (baretSend.ts). */
export type Sender = (call: SendCall, index: number) => Promise<Hex>;

export function useSendFlow(): {
  state: FlowState;
  run: (
    calls: readonly SendCall[],
    track?: { token: Address; owner: Address },
    send?: Sender,
  ) => Promise<boolean>;
  reset: () => void;
} {
  const [state, setState] = useState<FlowState>(IDLE);
  const latest = useRef(0);

  useEffect(
    () => () => {
      latest.current += 1;
    },
    [],
  );

  const run = useCallback(
    async (
      calls: readonly SendCall[],
      track?: { token: Address; owner: Address },
      send: Sender = sendCall,
    ): Promise<boolean> => {
      latest.current += 1;
      const id = latest.current;
      const current = () => latest.current === id;
      // Kept locally as well as in React, so each transition builds on the last one.
      let flow = begin(calls.length);
      const set = (next: FlowState) => {
        flow = next;
        setState(next);
      };
      set(flow);

      if (track) {
        const before = await readTokenBalance(track.token, track.owner).catch(() => null);
        if (!current()) return false;
        set(measured(flow, before));
      }

      // Whatever happens next, a run that sent something has spent MON on gas.
      let sentAny = false;
      try {
        for (const [i, call] of calls.entries()) {
          set(asking(flow, i));
          let hash: Hex;
          try {
            hash = await send(call, i);
          } catch (error) {
            if (current()) set(stopped(flow, i, sendErrorOf(error)));
            return false;
          }
          sentAny = true;
          if (!current()) return false;
          set(sent(flow, i, hash));

          let status: "success" | "reverted";
          try {
            status = await confirmCall(hash);
          } catch {
            if (current()) set(stopped(flow, i, "timeout"));
            return false;
          }
          if (!current()) return false;
          if (status === "reverted") {
            set(stopped(flow, i, "reverted"));
            return false;
          }
          set(confirmed(flow, i));
        }

        const after = track
          ? await readTokenBalance(track.token, track.owner).catch(() => null)
          : null;
        if (!current()) return false;
        set(finished(flow, after));
        return true;
      } finally {
        if (sentAny) refreshBalance().catch(() => undefined);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    latest.current += 1;
    setState(IDLE);
  }, []);

  return { state, run, reset };
}
