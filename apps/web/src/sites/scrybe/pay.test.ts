import { SendRefused } from "@baret/demo-evm/wallet";
import { type Hex, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { type PayDeps, type PayState, PayStopped, payAndAsk, termsOf } from "./pay.js";

// A throwaway test key (the first Anvil account); it guards nothing.
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const MERCHANT = "0x1365566191bAA9872A64AcDce963751d5343ff49";
const USDC = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const HASH = `0x${"ab".repeat(32)}`;
const NONCE = `0x${"07".repeat(32)}` as Hex;

const ASKED = {
  x402Version: 1,
  accepts: [
    {
      scheme: "exact",
      network: "monad-testnet",
      maxAmountRequired: "50000",
      payTo: MERCHANT,
      asset: USDC,
      maxTimeoutSeconds: 600,
      extra: { name: "USDC", version: "2" },
    },
  ],
};

function setup(over: Partial<PayDeps> & { paid?: () => Response } = {}) {
  const headers: string[] = [];
  const steps: PayState["phase"][] = [];
  const sign = vi.fn(over.sign ?? ((request) => account.signTypedData(request as never)));
  const deps: PayDeps = {
    fetch: (async (_url: unknown, init?: RequestInit) => {
      const header = new Headers(init?.headers).get("x-payment");
      if (!header) return Response.json(ASKED, { status: 402 });
      headers.push(header);
      return over.paid
        ? over.paid()
        : Response.json({ answer: "It settles in one block.", payment: { transaction: HASH } });
    }) as typeof fetch,
    balance: over.balance ?? (async () => 1_000_000n),
    now: () => 1_000,
    nonce: () => NONCE,
    ...(over.fetch ? { fetch: over.fetch } : {}),
    sign,
  };
  const run = () => payAndAsk(account.address, "how?", (s) => steps.push(s.phase), deps);
  return { run, headers, steps, sign };
}

describe("Scrybe's paid question", () => {
  it("reads the 402, has the wallet sign exactly its terms, and returns the answer with its transaction", async () => {
    const t = setup();
    const end = await t.run();
    expect(end).toEqual({
      phase: "done",
      error: null,
      answer: "It settles in one block.",
      hash: HASH,
      amount: 50_000n,
    });
    expect(t.steps).toEqual(["asking", "signing", "settling", "done"]);

    const sent = JSON.parse(atob(t.headers[0] ?? ""));
    expect(sent).toMatchObject({ x402Version: 1, scheme: "exact", network: "monad-testnet" });
    expect(sent.payload.authorization).toEqual({
      from: account.address,
      to: MERCHANT,
      value: "50000",
      validAfter: "0",
      validBefore: "1600",
      nonce: NONCE,
    });
    const signer = await recoverTypedDataAddress({
      domain: { name: "USDC", version: "2", chainId: 10143, verifyingContract: USDC },
      types: {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: {
        from: account.address,
        to: MERCHANT,
        value: 50_000n,
        validAfter: 0n,
        validBefore: 1_600n,
        nonce: NONCE,
      },
      signature: sent.payload.signature,
    });
    expect(signer).toBe(account.address);
  });

  it("asks the wallet for nothing when it holds less than the price", async () => {
    const t = setup({ balance: async () => 49_999n });
    expect(await t.run()).toMatchObject({ phase: "stopped", error: "balance", amount: 50_000n });
    expect(t.sign).not.toHaveBeenCalled();
  });

  it("stops with the wallet's reason, and sends no payment", async () => {
    const declined = setup({ sign: () => Promise.reject({ code: 4001 }) });
    expect(await declined.run()).toMatchObject({ phase: "stopped", error: "rejected" });
    expect(declined.headers).toHaveLength(0);
    const elsewhere = setup({ sign: () => Promise.reject(new SendRefused("network")) });
    expect(await elsewhere.run()).toMatchObject({ phase: "stopped", error: "network" });
    // The Baret wallet's window checked the payment and refused it.
    const blocked = setup({ sign: () => Promise.reject(new PayStopped("blocked")) });
    expect(await blocked.run()).toMatchObject({ phase: "stopped", error: "blocked" });
    expect(blocked.headers).toHaveLength(0);
  });

  it("never shows an unreachable signer as Blocked: no check ran", async () => {
    const unreachable = setup({ sign: () => Promise.reject(new PayStopped("unreachable")) });
    expect(await unreachable.run()).toMatchObject({ phase: "stopped", error: "unreachable" });
    expect(unreachable.headers).toHaveLength(0);
  });

  it("never reads a refusal or a failed settlement as an answer", async () => {
    const status = (code: number) =>
      setup({ paid: () => Response.json({ error: "x" }, { status: code }) });
    expect(await status(402).run()).toMatchObject({ phase: "stopped", error: "refused" });
    expect(await status(502).run()).toMatchObject({ phase: "stopped", error: "unsettled" });
    expect(await status(429).run()).toMatchObject({ phase: "stopped", error: "unavailable" });
    const odd = setup({ paid: () => Response.json({ answer: "free?" }) });
    expect(await odd.run()).toMatchObject({ phase: "stopped", error: "unavailable", answer: null });
  });

  it("stops when the server asks for no payment it can make", async () => {
    const down = setup({ fetch: (async () => Response.json({}, { status: 503 })) as typeof fetch });
    expect(await down.run()).toMatchObject({ phase: "stopped", error: "unavailable" });
    expect(down.sign).not.toHaveBeenCalled();
    expect(termsOf({ accepts: [{ ...ASKED.accepts[0], network: "elsewhere" }] })).toBeNull();
    expect(termsOf({ accepts: [{ ...ASKED.accepts[0], payTo: "nobody" }] })).toBeNull();
    expect(termsOf(null)).toBeNull();
  });
});
