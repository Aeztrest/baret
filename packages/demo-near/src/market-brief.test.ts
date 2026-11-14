import { briefToBody } from "@baret/agent-market";
import { near } from "@baret/content";
import { describe, expect, it } from "vitest";
import { isNearAccount, marketBrief, nearToYocto, transferBody } from "./market-brief.js";
import { demoAnalyzeBody } from "./view.js";

describe("the Agent Market brief built on /near", () => {
  it("is read back by the market agent exactly as built, for every request on /near", () => {
    for (const { id } of near.requests.items) {
      const body = demoAnalyzeBody(id);
      expect(briefToBody(marketBrief(body, "Should my agent sign this?"))).toEqual(body);
    }
  });

  it("turns a plain transfer into the body Baret analyses", () => {
    const r = transferBody({
      network: "near:mainnet",
      signer: " Alice.near ",
      receiver: "bob.near",
      amount: "0.1",
    });
    expect(r).toEqual({
      ok: true,
      body: {
        chain: "near:mainnet",
        request: {
          kind: "transaction",
          tx: {
            signerId: "alice.near",
            receiverId: "bob.near",
            actions: [{ type: "Transfer", deposit: "100000000000000000000000" }],
          },
        },
      },
    });
    if (r.ok) {
      expect(briefToBody(marketBrief(r.body, "Check this transfer."))).toEqual({
        ...r.body,
        policyTemplate: "balanced",
      });
    }
  });

  it("names the first wrong field instead of building a brief", () => {
    const base = {
      network: "near:testnet",
      signer: "a.testnet",
      receiver: "b.testnet",
      amount: "1",
    } as const;
    expect(transferBody({ ...base, signer: "not an account" })).toEqual({
      ok: false,
      problem: "signer",
    });
    expect(transferBody({ ...base, receiver: "x" })).toEqual({ ok: false, problem: "receiver" });
    expect(transferBody({ ...base, amount: "0" })).toEqual({ ok: false, problem: "amount" });
    expect(transferBody({ ...base, amount: "-1" })).toEqual({ ok: false, problem: "amount" });
  });

  it("converts NEAR to yoctoNEAR without floating point", () => {
    expect(nearToYocto("1")).toBe(10n ** 24n);
    expect(nearToYocto("0.000000000000000000000001")).toBe(1n);
    expect(nearToYocto("2.5")).toBe(25n * 10n ** 23n);
    expect(nearToYocto("1e3")).toBeNull();
    expect(nearToYocto("0.0000000000000000000000001")).toBeNull();
  });

  it("accepts named and implicit NEAR accounts only", () => {
    expect(isNearAccount("baret-vault.aeztrest-baret.testnet")).toBe(true);
    expect(isNearAccount("a".repeat(64))).toBe(true);
    expect(isNearAccount("Alice.near")).toBe(false);
    expect(isNearAccount("a..near")).toBe(false);
    expect(isNearAccount("-a.near")).toBe(false);
  });
});
