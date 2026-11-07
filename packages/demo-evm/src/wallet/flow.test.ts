import { act, renderHook, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { afterEach, describe, expect, it } from "vitest";
import { type Engine, resetForTests, type SendCall } from "./store.js";
import {
  asking,
  begin,
  confirmed,
  finished,
  IDLE,
  measured,
  sent,
  stopped,
  useSendFlow,
} from "./useSendFlow.js";
import { useTokenBalance } from "./useTokenBalance.js";

const OWNER: Address = "0x1111111111111111111111111111111111111111";
const TOKEN: Address = "0x2222222222222222222222222222222222222222";
const hashOf = (n: number): Hex => `0x${n.toString(16).padStart(64, "0")}`;
const call = (n: number): SendCall => ({ from: OWNER, to: TOKEN, value: "0", data: `0x0${n}` });

/** A deferred promise, so a test can hold a step open. */
function later<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

interface Fake {
  send?: (call: SendCall, n: number) => Promise<Hex>;
  confirm?: (hash: Hex) => Promise<"success" | "reverted">;
  balances?: bigint[];
}

/** A full engine that signs nothing: each send answers with a numbered hash. */
function fakeEngine(fake: Fake = {}): { sent: SendCall[]; reads: number; refreshed: number } {
  const log = { sent: [] as SendCall[], reads: 0, refreshed: 0 };
  const balances = fake.balances ?? [100_000_000n, 0n];
  const engine: Engine = {
    connect: async () => undefined,
    disconnect: async () => undefined,
    switchToMonad: async () => undefined,
    refreshBalance: async () => {
      log.refreshed += 1;
    },
    send: (c) => {
      log.sent.push(c);
      const n = log.sent.length;
      return fake.send ? fake.send(c, n) : Promise.resolve(hashOf(n));
    },
    signTyped: async () => hashOf(0),
    confirm: (hash) => (fake.confirm ? fake.confirm(hash) : Promise.resolve("success")),
    balanceOf: async () => 0n,
    tokenBalance: async () => {
      const value = balances[Math.min(log.reads, balances.length - 1)] ?? 0n;
      log.reads += 1;
      return value;
    },
  };
  resetForTests(async () => engine);
  return log;
}

afterEach(() => {
  resetForTests();
});

describe("flow transitions", () => {
  it("walks a step from waiting to done", () => {
    let s = begin(2);
    expect(s.phase).toBe("running");
    expect(s.steps).toEqual([
      { status: "waiting", hash: null },
      { status: "waiting", hash: null },
    ]);
    s = measured(s, 5n);
    s = asking(s, 0);
    expect(s.steps[0]?.status).toBe("confirm");
    s = sent(s, 0, hashOf(1));
    expect(s.steps[0]).toEqual({ status: "pending", hash: hashOf(1) });
    s = confirmed(s, 0);
    expect(s.steps[0]?.status).toBe("done");
    expect(s.steps[1]?.status).toBe("waiting");
    s = finished(s, 0n);
    expect(s).toMatchObject({ phase: "done", before: 5n, after: 0n, error: null });
  });

  it("marks a declined step declined", () => {
    const s = stopped(asking(begin(1), 0), 0, "rejected");
    expect(s).toMatchObject({ phase: "stopped", error: "rejected" });
    expect(s.steps[0]?.status).toBe("declined");
  });

  it("marks a step with no receipt unconfirmed, with its hash", () => {
    const s = stopped(sent(begin(1), 0, hashOf(1)), 0, "timeout");
    expect(s).toMatchObject({ phase: "stopped", error: "timeout" });
    expect(s.steps[0]).toEqual({ status: "unconfirmed", hash: hashOf(1) });
  });

  it("marks a reverted step failed", () => {
    const s = stopped(sent(begin(1), 0, hashOf(1)), 0, "reverted");
    expect(s.error).toBe("reverted");
    expect(s.steps[0]).toEqual({ status: "failed", hash: hashOf(1) });
  });
});

describe("useSendFlow", () => {
  it("confirms each call in order and reads the balance around them", async () => {
    const log = fakeEngine();
    const { result } = renderHook(() => useSendFlow());
    let ok = false;
    await act(async () => {
      ok = await result.current.run([call(1), call(2)], { token: TOKEN, owner: OWNER });
    });
    expect(ok).toBe(true);
    expect(log.sent).toEqual([call(1), call(2)]);
    expect(result.current.state).toEqual({
      phase: "done",
      steps: [
        { status: "done", hash: hashOf(1) },
        { status: "done", hash: hashOf(2) },
      ],
      error: null,
      before: 100_000_000n,
      after: 0n,
    });
    await waitFor(() => expect(log.refreshed).toBe(1));
  });

  it("stops at a declined second call", async () => {
    fakeEngine({
      send: (_c, n) =>
        n === 2 ? Promise.reject({ cause: { code: 4001 } }) : Promise.resolve(hashOf(n)),
    });
    const { result } = renderHook(() => useSendFlow());
    let ok = true;
    await act(async () => {
      ok = await result.current.run([call(1), call(2)]);
    });
    expect(ok).toBe(false);
    expect(result.current.state.phase).toBe("stopped");
    expect(result.current.state.error).toBe("rejected");
    expect(result.current.state.steps.map((s) => s.status)).toEqual(["done", "declined"]);
  });

  it("stops at a call that reverted", async () => {
    fakeEngine({ confirm: async () => "reverted" });
    const { result } = renderHook(() => useSendFlow());
    await act(async () => {
      await result.current.run([call(1), call(2)]);
    });
    expect(result.current.state.error).toBe("reverted");
    expect(result.current.state.steps.map((s) => s.status)).toEqual(["failed", "waiting"]);
  });

  it("reports a call with no receipt as a timeout, unconfirmed", async () => {
    fakeEngine({ confirm: () => Promise.reject(new Error("timed out")) });
    const { result } = renderHook(() => useSendFlow());
    await act(async () => {
      await result.current.run([call(1)]);
    });
    expect(result.current.state.error).toBe("timeout");
    expect(result.current.state.steps[0]).toEqual({ status: "unconfirmed", hash: hashOf(1) });
  });

  it("drops a run that was reset", async () => {
    const held = later<Hex>();
    fakeEngine({ send: () => held.promise });
    const { result } = renderHook(() => useSendFlow());
    let running: Promise<boolean> = Promise.resolve(true);
    act(() => {
      running = result.current.run([call(1), call(2)]);
    });
    await waitFor(() => expect(result.current.state.steps[0]?.status).toBe("confirm"));
    act(() => {
      result.current.reset();
    });
    let ok = true;
    await act(async () => {
      held.resolve(hashOf(1));
      ok = await running;
    });
    expect(ok).toBe(false);
    expect(result.current.state).toEqual(IDLE);
  });
});

describe("useTokenBalance", () => {
  it("reads on mount and again on refresh", async () => {
    const log = fakeEngine({ balances: [100_000_000n, 40n] });
    const { result } = renderHook(() => useTokenBalance(TOKEN, OWNER));
    await waitFor(() => expect(result.current.value).toBe(100_000_000n));
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.value).toBe(40n));
    expect(log.reads).toBe(2);
  });

  it("is null with no owner", () => {
    const log = fakeEngine();
    const { result } = renderHook(() => useTokenBalance(TOKEN, null));
    expect(result.current.value).toBeNull();
    expect(log.reads).toBe(0);
  });
});
