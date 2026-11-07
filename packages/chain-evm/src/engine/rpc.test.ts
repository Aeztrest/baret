import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { RpcUnavailableError, ViemEvmRpc } from "./rpc.js";

let server: Server | null = null;

/** A node that refuses the first `refusals` requests with `status`, then answers. */
async function node(refusals: number, status = 429): Promise<{ url: string; hits: () => number }> {
  let hits = 0;
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      hits += 1;
      if (hits <= refusals) {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "slow down" }));
        return;
      }
      const parsed = JSON.parse(body);
      const answer = (r: { id: number }) => ({ jsonrpc: "2.0", id: r.id, result: "0x279f" });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(Array.isArray(parsed) ? parsed.map(answer) : answer(parsed)));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, hits: () => hits };
}

const rpcFor = (rpcUrl: string) =>
  new ViemEvmRpc({ chainId: 10143, rpcUrl, traceRpcUrl: rpcUrl, timeoutMs: 5000, batch: true });

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

describe("a node that is busy", () => {
  it("is asked again instead of failing the check", async () => {
    const busy = await node(2);
    const rpc = rpcFor(busy.url);
    expect(await rpc.getChainId()).toBe(10143);
    expect(busy.hits()).toBe(3);
  });

  it("is asked again after a server error too", async () => {
    const flaky = await node(1, 503);
    expect(await rpcFor(flaky.url).getChainId()).toBe(10143);
  });

  it("still fails, with no answer, when it never recovers", async () => {
    const down = await node(1000);
    const rpc = rpcFor(down.url);
    await expect(rpc.getChainId()).rejects.toBeInstanceOf(RpcUnavailableError);
    // The first try and four more: it does not ask for ever.
    expect(down.hits()).toBe(5);
  }, 15_000);
});
