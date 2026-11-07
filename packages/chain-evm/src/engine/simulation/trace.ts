import { type Address, getAddress, type Hex, isAddress } from "viem";
import type { RawCallFrame } from "../rpc.js";

export interface TraceFrame {
  type: string;
  from: Address;
  to: Address | null;
  value: bigint;
  input: Hex;
  depth: number;
  /** This frame or one of its parents reverted, so its effects never land. */
  reverted: boolean;
  /** This frame is a STATICCALL or runs inside one: it can only read. */
  readOnly: boolean;
  /**
   * A DELEGATECALL that forwards its parent's call unchanged (same input): a
   * proxy handing over to its implementation. Any other DELEGATECALL runs a
   * call of its own (a self-multicall item, a library batch) and is an
   * operation in its own right.
   */
  forwarded: boolean;
}

export interface TraceLog {
  address: Address;
  topics: Hex[];
  data: Hex;
}

export interface CallTrace {
  frames: TraceFrame[];
  /** Logs of frames that did not revert, in execution order. */
  logs: TraceLog[];
  /** The deepest chain of contracts calling contracts; delegatecalls add no level. */
  maxDepth: number;
  /** Every address a call frame targeted. */
  touched: Address[];
}

export const EMPTY_TRACE: CallTrace = { frames: [], logs: [], maxDepth: 0, touched: [] };

const addr = (v: string | undefined): Address | null =>
  v && isAddress(v, { strict: false }) ? getAddress(v) : null;

const amount = (v: string | undefined): bigint => {
  if (!v) return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
};

/** Flattens a `callTracer` tree. Effects of reverted subtrees are dropped. */
export function parseCallTrace(root: RawCallFrame | null): CallTrace | null {
  if (!root) return null;
  const frames: TraceFrame[] = [];
  const logs: TraceLog[] = [];
  const touched = new Set<Address>();
  let maxDepth = 0;

  // `contractDepth` is how many contracts deep a frame is. A DELEGATECALL runs
  // borrowed code inside the calling contract (a proxy and its implementation
  // are one contract to the user), so it does not add a level.
  const walk = (
    f: RawCallFrame,
    depth: number,
    contractDepth: number,
    parentReverted: boolean,
    parentReadOnly: boolean,
    parentInput: Hex | null,
  ) => {
    const reverted = parentReverted || Boolean(f.error) || Boolean(f.revertReason);
    const to = addr(f.to);
    if (to) touched.add(to);
    const type = (f.type ?? "CALL").toUpperCase();
    const level = type === "DELEGATECALL" ? Math.max(contractDepth - 1, 0) : contractDepth;
    const readOnly = parentReadOnly || type === "STATICCALL";
    const input = (f.input ?? "0x") as Hex;
    const forwarded =
      type === "DELEGATECALL" &&
      parentInput !== null &&
      input.toLowerCase() === parentInput.toLowerCase();
    maxDepth = Math.max(maxDepth, level);
    frames.push({
      type,
      from: addr(f.from) ?? ("0x0000000000000000000000000000000000000000" as Address),
      to,
      value: amount(f.value),
      input,
      depth,
      reverted,
      readOnly,
      forwarded,
    });
    if (!reverted) {
      for (const log of f.logs ?? []) {
        const a = addr(log.address);
        if (a) logs.push({ address: a, topics: log.topics as Hex[], data: log.data as Hex });
      }
    }
    for (const child of f.calls ?? []) {
      walk(child, depth + 1, level + 1, reverted, readOnly, input);
    }
  };

  walk(root, 0, 0, false, false, null);
  return { frames, logs, maxDepth, touched: [...touched] };
}
