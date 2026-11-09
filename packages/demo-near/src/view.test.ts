import { describe, expect, it } from "vitest";
import { demoAccounts, demoAnalyzeBody, explorerAccount, formatNear, readVault } from "./view.js";

const NEAR = 10n ** 24n;
const bytes = (v: unknown) => [...new TextEncoder().encode(JSON.stringify(v))];

/** A fake NEAR RPC answering the four reads readVault makes. */
function fakeRpc(calls: unknown[]): typeof fetch {
  return (async (_url: string, init: { body: string }) => {
    const req = JSON.parse(init.body) as { method: string; params: Record<string, unknown> };
    calls.push(req);
    const ok = (result: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
    if (req.method === "block") return ok({ header: { height: 42 } });
    if (req.params.request_type === "view_account") return ok({ amount: (3n * NEAR).toString() });
    if (req.params.request_type === "view_access_key_list") return ok({ keys: [] });
    switch (req.params.method_name) {
      case "get_policy":
        return ok({
          result: bytes({
            owner: "o.testnet",
            paused: false,
            agents: ["a.o.testnet"],
            receivers: [
              ["native", ["s.o.testnet"]],
              ["eip155:10143", ["0x5bb6ff1fcbe31ed8fbce6805852ce279475522fc"]],
            ],
            limits: [
              ["native", { per_transfer: NEAR.toString(), per_day: (3n * NEAR).toString() }],
            ],
          }),
        });
      case "get_spent_today":
        return ok({ result: bytes((NEAR / 10n).toString()) });
      case "get_remaining":
        return ok({ result: bytes(((29n * NEAR) / 10n).toString()) });
      case "get_version":
        return ok({ result: bytes("0.2.0") });
    }
    return new Response("{}", { status: 500 });
  }) as unknown as typeof fetch;
}

describe("readVault", () => {
  it("reads policy, spending and balance at one block", async () => {
    const calls: { params: { block_id?: number } }[] = [];
    const s = await readVault("v.o.testnet", "http://rpc", fakeRpc(calls));
    expect(s.limits).toEqual([{ asset: "native", perTransfer: NEAR, perDay: 3n * NEAR }]);
    expect(s.spentToday).toBe(NEAR / 10n);
    expect(s.nextTransferMax).toBe((29n * NEAR) / 10n);
    expect(s.balance).toBe(3n * NEAR);
    expect(s.block).toBe(42);
    expect(s.receivers).toEqual(["s.o.testnet"]);
    expect(s.receiversByAsset).toHaveLength(2);
    expect(s.version).toBe("0.2.0");
    expect(s.accessKeys).toBe(0);
    expect(calls.slice(1).every((c) => c.params.block_id === 42)).toBe(true);
  });

  it("fails on an RPC error instead of showing a made-up state", async () => {
    const broken = (async () =>
      new Response(JSON.stringify({ error: { name: "X" } }))) as unknown as typeof fetch;
    await expect(readVault("v.o.testnet", "http://rpc", broken)).rejects.toThrow();
  });
});

describe("panel helpers", () => {
  it("formats yoctoNEAR", () => {
    expect(formatNear(0n)).toBe("0");
    expect(formatNear((29n * NEAR) / 10n)).toBe("2.9");
    expect(formatNear(NEAR / 3n)).toBe("0.3333");
    expect(formatNear(-1n)).toBe("0");
  });

  it("takes the demo accounts from the registry", () => {
    const a = demoAccounts();
    expect(a.vault).toBe("baret-vault.aeztrest-baret.testnet");
    expect(a.owner).toBe("aeztrest-baret.testnet");
    expect(explorerAccount(a.vault)).toContain("nearblocks.io/address/baret-vault.");
  });

  it("builds the four requests the agent tries", () => {
    expect(demoAnalyzeBody("pay").request.tx.receiverId).toBe(demoAccounts().vault);
    expect(demoAnalyzeBody("add-key").request.tx.actions[0]?.type).toBe("AddKey");
  });
});
