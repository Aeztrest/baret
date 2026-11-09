import { describe, expect, it } from "vitest";
import { bytesToBase64, JsonNearRpc, RpcUnavailableError } from "./rpc.js";

const block = { jsonrpc: "2.0", id: "baret", result: { header: { height: 7, hash: "h" } } };

function fetchSeq(answers: (number | "throw")[]): { f: typeof fetch; calls: () => number } {
  let n = 0;
  const f = (async () => {
    const a = answers[Math.min(n++, answers.length - 1)] ?? 200;
    if (a === "throw") throw new Error("socket hang up");
    return new Response(JSON.stringify(block), { status: a });
  }) as unknown as typeof fetch;
  return { f, calls: () => n };
}

describe("JsonNearRpc", () => {
  it("tries a rate-limited or failed call once more", async () => {
    for (const first of [429, 503, "throw"] as const) {
      const { f, calls } = fetchSeq([first, 200]);
      const rpc = new JsonNearRpc("http://rpc", 1000, f);
      expect(await rpc.pin()).toEqual({ height: 7n, hash: "h" });
      expect(calls()).toBe(2);
    }
  });

  it("gives up after the second failure, as unavailable (503), never a verdict", async () => {
    const { f, calls } = fetchSeq([503, 503, 200]);
    await expect(new JsonNearRpc("http://rpc", 1000, f).pin()).rejects.toBeInstanceOf(
      RpcUnavailableError,
    );
    expect(calls()).toBe(2);
  });

  it("does not retry a request the node rejects", async () => {
    const { f, calls } = fetchSeq([400, 200]);
    await expect(new JsonNearRpc("http://rpc", 1000, f).pin()).rejects.toThrow("HTTP 400");
    expect(calls()).toBe(1);
  });

  it("encodes view arguments outside Latin-1", () => {
    const b64 = bytesToBase64(new TextEncoder().encode('{"memo":"ödeme ğ"}'));
    expect(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).toBe(
      '{"memo":"ödeme ğ"}',
    );
  });
});
