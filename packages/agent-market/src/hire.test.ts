import { describe, expect, it } from "vitest";
import { MarketClient, MarketError } from "./client.js";
import { BRIEF_DECLINED, BRIEF_HELP, DECLINE_REASON, STARTED_MESSAGE } from "./deliverable.js";
import { handleHire } from "./hire.js";

/** A market that records every call; `failSubmits` submits answer 503 first. */
function fakeMarket(failSubmits = 0) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  let failures = failSubmits;
  const f = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push({
      method: init.method ?? "GET",
      path,
      body: init.body ? JSON.parse(String(init.body)) : null,
    });
    if (path.endsWith("/submit") && failures-- > 0) return new Response("", { status: 503 });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  return { client: new MarketClient("aat_test", "https://market.test", f), calls };
}

const TX_BRIEF = [
  "Check this.",
  "```json",
  '{ "chain": "near:testnet", "request": { "kind": "transaction", "tx": { "signerId": "a.testnet", "receiverId": "b.testnet", "actions": [{ "type": "Transfer", "deposit": "1" }] } } }',
  "```",
].join("\n");
const noSleep = async () => {};

describe("handleHire", () => {
  it("delivers a verdict for a webhook hire without starting it again", async () => {
    const { client, calls } = fakeMarket();
    const asked: object[] = [];
    const outcome = await handleHire(
      client,
      { assignmentId: "a1", brief: TX_BRIEF },
      async (body) => {
        asked.push(body);
        return { decision: "safe", findings: [] };
      },
      { started: true, sleep: noSleep },
    );
    expect(outcome).toBe("delivered");
    expect(asked).toEqual([
      {
        chain: "near:testnet",
        policyTemplate: "balanced",
        request: expect.objectContaining({ kind: "transaction" }),
      },
    ]);
    expect(calls.map((c) => c.path)).toEqual([
      "/v1/assignments/a1/messages",
      "/v1/assignments/a1/submit",
    ]);
    expect(calls[0]?.body).toEqual({ body: STARTED_MESSAGE });
    expect(
      String((calls[1]?.body as { deliverableMarkdown: string } | undefined)?.deliverableMarkdown),
    ).toMatch(/SAFE/i);
  });

  it("starts a polled hire first", async () => {
    const { client, calls } = fakeMarket();
    await handleHire(client, { assignmentId: "a1", brief: TX_BRIEF }, async () => null, {
      started: false,
      sleep: noSleep,
    });
    expect(calls[0]?.path).toBe("/v1/assignments/a1/start");
  });

  it("delivers 'no verdict, do not sign' when Baret cannot answer or throws", async () => {
    for (const analyze of [async () => null, async () => Promise.reject(new Error("down"))]) {
      const { client, calls } = fakeMarket();
      await handleHire(client, { assignmentId: "a1", brief: TX_BRIEF }, analyze, {
        started: true,
        sleep: noSleep,
      });
      const md = (calls.at(-1)?.body as { deliverableMarkdown: string } | undefined)
        ?.deliverableMarkdown;
      expect(md).toMatch(/no verdict/i);
      expect(md).not.toMatch(/\bSAFE\b/);
    }
  });

  it("hands a started job with no transaction back (refund) and leaves a polled one unstarted", async () => {
    const webhook = fakeMarket();
    expect(
      await handleHire(webhook.client, { assignmentId: "a1", brief: "hi" }, async () => null, {
        started: true,
      }),
    ).toBe("declined");
    expect(webhook.calls.map((c) => [c.path, c.body])).toEqual([
      ["/v1/assignments/a1/messages", { body: BRIEF_DECLINED }],
      ["/v1/assignments/a1/decline", { reason: DECLINE_REASON }],
    ]);
    const poll = fakeMarket();
    expect(
      await handleHire(poll.client, { assignmentId: "a1", brief: "hi" }, async () => null, {
        started: false,
      }),
    ).toBe("help-sent");
    expect(poll.calls.map((c) => [c.path, c.body])).toEqual([
      ["/v1/assignments/a1/messages", { body: BRIEF_HELP }],
    ]);
  });

  it("tries a refused submit again, then gives up with the market's error", async () => {
    const twice = fakeMarket(2);
    await handleHire(twice.client, { assignmentId: "a1", brief: TX_BRIEF }, async () => null, {
      started: true,
      sleep: noSleep,
    });
    expect(twice.calls.filter((c) => c.path.endsWith("/submit"))).toHaveLength(3);
    const never = fakeMarket(9);
    await expect(
      handleHire(never.client, { assignmentId: "a1", brief: TX_BRIEF }, async () => null, {
        started: true,
        sleep: noSleep,
      }),
    ).rejects.toBeInstanceOf(MarketError);
  });
});
