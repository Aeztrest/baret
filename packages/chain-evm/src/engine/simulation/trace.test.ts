import { describe, expect, it } from "vitest";
import { effectsFromTrace } from "../analysis/effects.js";
import { parseCallTrace } from "./trace.js";

const A = "0x00000000000000000000000000000000000000a1";
const B = "0x00000000000000000000000000000000000000b2";
const C = "0x00000000000000000000000000000000000000c3";
const IMPL = "0x00000000000000000000000000000000000000d4";

type Raw = NonNullable<Parameters<typeof parseCallTrace>[0]>;
const call = (to: string, calls: Raw[] = [], type = "CALL"): Raw => ({ type, from: A, to, calls });

describe("contract depth", () => {
  it("counts each contract that calls the next", () => {
    expect(parseCallTrace(call(A))?.maxDepth).toBe(0);
    expect(parseCallTrace(call(A, [call(B, [call(C)])]))?.maxDepth).toBe(2);
  });

  it("does not count a proxy handing over to its implementation", () => {
    // A token proxy that asks a policy proxy: two contracts, four frames deep.
    const token = call(A, [
      call(IMPL, [call(B, [call(IMPL, [], "DELEGATECALL")], "STATICCALL")], "DELEGATECALL"),
    ]);
    const trace = parseCallTrace(token);
    expect(trace?.maxDepth).toBe(1);
    // The frames keep their real depth; only the nesting measure changes.
    expect(trace?.frames.map((f) => f.depth)).toEqual([0, 1, 2, 3]);
  });

  it("still counts the calls an implementation makes", () => {
    const viaProxy = call(A, [call(IMPL, [call(B, [call(C)])], "DELEGATECALL")]);
    expect(parseCallTrace(viaProxy)?.maxDepth).toBe(2);
  });
});

describe("read-only frames", () => {
  it("marks a STATICCALL and everything inside it, and nothing else", () => {
    // A vault that reads a credential through a proxy, then moves a token through another.
    const pay = call(A, [
      call(B, [call(IMPL, [], "DELEGATECALL")], "STATICCALL"),
      call(C, [call(IMPL, [], "DELEGATECALL")]),
    ]);
    expect(parseCallTrace(pay)?.frames.map((f) => f.readOnly)).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
  });
});
describe("operations counted from a trace", () => {
  it("counts the calls that can change something, once per contract", () => {
    // A vault reads two credentials through a proxy, asks a policy, then moves
    // a token whose proxy asks the same policy: 3 operations, 13 frames.
    const read = () => call(B, [call(IMPL, [], "DELEGATECALL")], "STATICCALL");
    const pay = call(A, [
      read(),
      read(),
      read(),
      call(C, [call(IMPL, [read(), call(B, [call(IMPL, [], "DELEGATECALL")])], "DELEGATECALL")]),
    ]);
    const trace = parseCallTrace(pay);
    expect(trace?.frames.length).toBe(13);
    expect(effectsFromTrace(trace as NonNullable<typeof trace>, A).operationCount).toBe(3);
  });
});

describe("DELEGATECALL frames that are operations of their own", () => {
  const ops = (root: Raw) => {
    const trace = parseCallTrace(root);
    return effectsFromTrace(trace as NonNullable<typeof trace>, A).operationCount;
  };
  const frame = (
    from: string,
    to: string,
    input: string,
    calls: Raw[] = [],
    type = "CALL",
    error?: string,
  ): Raw => ({ type, from, to, input, calls, ...(error ? { error } : {}) });
  const item = (k: number) => `0x095ea7b3${k.toString(16).padStart(64, "0")}`;

  it("counts every item of a self-multicall (OZ Multicall, Uniswap periphery)", () => {
    // USER -> token.multicall(bytes[12]); the token delegatecalls itself once per item.
    const items = Array.from({ length: 12 }, (_, k) => frame(B, B, item(k), [], "DELEGATECALL"));
    const root = frame(A, B, "0xac9650d8", items);
    expect(parseCallTrace(root)?.frames.length).toBe(13);
    expect(ops(root)).toBe(13);
    expect(ops(root)).toBeGreaterThan(10); // HIGH_OPERATION_COUNT still fires
  });

  it("does not count a proxy handing its own call to the implementation twice", () => {
    // USER -> proxy, which forwards the same calldata to IMPL, which makes 12 CALLs.
    const inner = Array.from({ length: 12 }, () => frame(C, B, "0xa9059cbb"));
    const root = frame(A, C, "0x12345678", [frame(C, IMPL, "0x12345678", inner, "DELEGATECALL")]);
    expect(ops(root)).toBe(13);
    // A lone call to a proxy is one operation, not two.
    expect(ops(frame(A, C, "0x12345678", [frame(C, IMPL, "0x12345678", [], "DELEGATECALL")]))).toBe(
      1,
    );
  });

  it("counts nothing from a reverted subtree", () => {
    const items = Array.from({ length: 12 }, (_, k) => frame(B, B, item(k), [], "DELEGATECALL"));
    const failed = frame(B, C, "0x11111111", items, "CALL", "execution reverted");
    expect(ops(frame(A, B, "0xac9650d8", [failed]))).toBe(1);
    expect(ops(frame(A, B, "0xac9650d8", items, "CALL", "execution reverted"))).toBe(0);
  });

  it("counts nothing from a STATICCALL subtree", () => {
    const reads = Array.from({ length: 12 }, (_, k) =>
      frame(B, C, item(k), [frame(C, IMPL, item(k), [], "DELEGATECALL")], "STATICCALL"),
    );
    expect(ops(frame(A, B, "0x12345678", reads))).toBe(1);
  });

  it("keeps the Cleanverse settlement under the threshold", () => {
    // The shape of the real settlement (tx 0x2dd872a2..., 31 frames): the vault
    // reads balances and credentials through proxies (STATICCALL + forwarding
    // DELEGATECALL), then moves the asset through its proxy, whose code reads
    // the policy again. Two operations: the call and the token transfer.
    const VAULT = "0x00000000000000000000000000000000000000f1";
    const APASS = "0x00000000000000000000000000000000000000f2";
    const APASS_IMPL = "0x00000000000000000000000000000000000000f3";
    const POLICY = "0x00000000000000000000000000000000000000f4";
    const POLICY_IMPL = "0x00000000000000000000000000000000000000f5";
    const ASSET = "0x00000000000000000000000000000000000000f6";
    const ASSET_IMPL = "0x00000000000000000000000000000000000000f7";
    const read = (from: string, proxy: string, impl: string, input: string, calls: Raw[] = []) =>
      frame(from, proxy, input, [frame(proxy, impl, input, calls, "DELEGATECALL")], "STATICCALL");
    const policyRead = (from: string) =>
      read(from, POLICY, POLICY_IMPL, "0x6d62a4fe", [
        read(POLICY, APASS, APASS_IMPL, "0x7a28eae6"),
        read(POLICY, APASS, APASS_IMPL, "0x6a069f61"),
        read(POLICY, APASS, APASS_IMPL, "0x7a28eae6"),
        read(POLICY, APASS, APASS_IMPL, "0x6a069f61"),
      ]);
    const root = frame(A, VAULT, "0x5e5571ac", [
      read(VAULT, APASS, APASS_IMPL, "0x70a08231"),
      read(VAULT, APASS, APASS_IMPL, "0x6a069f61"),
      read(VAULT, APASS, APASS_IMPL, "0x70a08231"),
      read(VAULT, APASS, APASS_IMPL, "0x6a069f61"),
      policyRead(VAULT),
      frame(VAULT, ASSET, "0x23b872dd", [
        frame(ASSET, ASSET_IMPL, "0x23b872dd", [policyRead(ASSET)], "DELEGATECALL"),
      ]),
    ]);
    expect(parseCallTrace(root)?.frames.length).toBe(31);
    expect(ops(root)).toBe(2);
  });
});
