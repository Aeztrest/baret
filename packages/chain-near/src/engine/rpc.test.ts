import { describe, expect, it } from "vitest";
import { bytesToBase64, JsonNearRpc, RpcUnavailableError, retryAfterMs } from "./rpc.js";

const block = { jsonrpc: "2.0", id: "baret", result: { header: { height: 7, hash: "h" } } };

function fetchSeq(
  answers: (number | "throw")[],
  headers: Record<string, string> = {},
): { f: typeof fetch; calls: () => number; at: number[] } {
  let n = 0;
  const at: number[] = [];
  const f = (async () => {
    at.push(Date.now());
    const a = answers[Math.min(n++, answers.length - 1)] ?? 200;
    if (a === "throw") throw new Error("socket hang up");
    return new Response(JSON.stringify(block), { status: a, headers });
  }) as unknown as typeof fetch;
  return { f, calls: () => n, at };
}

/** Short delays so the tests do not wait for the production backoff. */
const FAST = [5, 10];

describe("JsonNearRpc", () => {
  it("tries a rate-limited or failed call again", async () => {
    for (const first of [429, 503, "throw"] as const) {
      const { f, calls } = fetchSeq([first, 200]);
      const rpc = new JsonNearRpc("http://rpc", 1000, f, FAST);
      expect(await rpc.pin()).toEqual({ height: 7n, hash: "h" });
      expect(calls()).toBe(2);
    }
    const twice = fetchSeq([429, 429, 200]);
    expect(await new JsonNearRpc("http://rpc", 1000, twice.f, FAST).pin()).toEqual({
      height: 7n,
      hash: "h",
    });
    expect(twice.calls()).toBe(3);
  });

  it("gives up after the third failure, as unavailable (503), never a verdict", async () => {
    const { f, calls } = fetchSeq([503, 503, 503, 200]);
    await expect(new JsonNearRpc("http://rpc", 1000, f, FAST).pin()).rejects.toBeInstanceOf(
      RpcUnavailableError,
    );
    expect(calls()).toBe(3);
  });

  it("waits what the server asks in Retry-After, within a cap", async () => {
    const { f, at } = fetchSeq([429, 200], { "retry-after": "0.2" });
    await new JsonNearRpc("http://rpc", 1000, f, FAST).pin();
    expect((at[1] ?? 0) - (at[0] ?? 0)).toBeGreaterThanOrEqual(150);
    expect(retryAfterMs("1")).toBe(1000);
    expect(retryAfterMs("120")).toBe(2000);
    expect(retryAfterMs(new Date(10_500).toUTCString(), 10_000)).toBe(0);
    expect(retryAfterMs(new Date(11_000).toUTCString(), 10_000)).toBe(1000);
    expect(retryAfterMs("soon")).toBe(0);
    expect(retryAfterMs(null)).toBe(0);
  });

  it("does not retry a request the node rejects", async () => {
    const { f, calls } = fetchSeq([400, 200]);
    await expect(new JsonNearRpc("http://rpc", 1000, f, FAST).pin()).rejects.toThrow("HTTP 400");
    expect(calls()).toBe(1);
  });

  it("encodes view arguments outside Latin-1", () => {
    const b64 = bytesToBase64(new TextEncoder().encode('{"memo":"ödeme ğ"}'));
    expect(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).toBe(
      '{"memo":"ödeme ğ"}',
    );
  });
});
