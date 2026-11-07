import type { AnalyzeRequest, Verdict } from "@baret/core";
import { describe, expect, it } from "vitest";
import {
  GuardUnreachableError,
  isSafe,
  isSignable,
  TransactionGuard,
  verdictRefusal,
} from "./guard.js";

const request: AnalyzeRequest = {
  chain: "eip155:10143",
  request: {
    kind: "call",
    tx: {
      from: "0x306707be3CD50B1Cca5E27F838AfcfC4fD84C353",
      to: "0xac9517a70c88480c9fA7E9a280DA485F7f552C29",
      value: "100000000000000000",
      data: "0x",
    },
  },
  policyTemplate: "balanced",
};

const verdict: Verdict = {
  decision: "safe",
  findings: [],
  firedRules: [],
  suggestions: [],
  confidence: "high",
  estimatedChanges: [],
  allowances: [],
  sources: [{ name: "rpc", status: "ok" }],
  chain: "eip155:10143",
  pinnedAt: { kind: "block", value: "1" },
  expiresAt: 1_800_000_030,
  meta: {
    requestId: "r",
    engineVersion: "0.2.0",
    adapterVersion: "0.2.0",
    simulation: "trace",
    analyzedAt: "2027-01-15T08:00:00.000Z",
  },
};

function guardAnswering(response: Response, seen?: { url?: string; headers?: HeadersInit }) {
  return new TransactionGuard({
    baseUrl: "https://baret.test/",
    apiKey: "k1",
    fetch: async (url, init) => {
      if (seen) {
        seen.url = String(url);
        seen.headers = init?.headers ?? {};
      }
      return response;
    },
  });
}

async function failure(guard: TransactionGuard): Promise<GuardUnreachableError> {
  const error = await guard.evaluate(request).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(GuardUnreachableError);
  return error as GuardUnreachableError;
}

describe("evaluate", () => {
  it("posts to /v1/analyze with the key and returns the checked verdict", async () => {
    const seen: { url?: string; headers?: HeadersInit } = {};
    const v = await guardAnswering(Response.json(verdict), seen).evaluate(request);
    expect(v.decision).toBe("safe");
    expect(seen.url).toBe("https://baret.test/v1/analyze");
    expect(seen.headers).toMatchObject({ "x-api-key": "k1" });
  });

  it("refuses to send a request off the schema", async () => {
    const guard = guardAnswering(Response.json(verdict));
    await expect(guard.evaluate({ ...request, chain: "10143" })).rejects.toThrow();
  });
});

describe("a non-2xx answer", () => {
  it("keeps the server's JSON body", async () => {
    const body = { error: { code: "invalid_request", message: "the body is not JSON" } };
    const error = await failure(guardAnswering(Response.json(body, { status: 400 })));
    expect(error.status).toBe(400);
    expect(error.body).toEqual(body);
  });

  it("keeps a body that is not JSON as text, and null for an empty one", async () => {
    expect((await failure(guardAnswering(new Response("Bad Gateway", { status: 502 })))).body).toBe(
      "Bad Gateway",
    );
    expect((await failure(guardAnswering(new Response(null, { status: 503 })))).body).toBeNull();
  });
});

describe("a failure with no answer to read", () => {
  it("has a null status when Baret did not answer", async () => {
    const guard = new TransactionGuard({
      baseUrl: "https://baret.test",
      fetch: async () => {
        throw new Error("network down");
      },
    });
    expect((await failure(guard)).status).toBeNull();
  });

  it("refuses a 200 that breaks the contract", async () => {
    const error = await failure(guardAnswering(Response.json({ decision: "safe" })));
    expect(error.status).toBe(200);
  });

  it("refuses a 200 whose decision contradicts its findings", async () => {
    const lying = {
      ...verdict,
      decision: "safe",
      findings: [{ code: "SIMULATION_FAILED", severity: "high", values: {}, blocking: true }],
    };
    await failure(guardAnswering(Response.json(lying)));
  });
});

describe("helpers", () => {
  it("isSafe and isSignable read the decision", () => {
    expect(isSafe(verdict)).toBe(true);
    expect(isSignable({ ...verdict, decision: "caution" })).toBe(true);
    expect(isSignable({ ...verdict, decision: "blocked" })).toBe(false);
  });

  it("verdictRefusal refuses an expired verdict and one for another chain", () => {
    expect(verdictRefusal(verdict, { chain: "eip155:10143", now: 1_800_000_000 })).toBeNull();
    expect(verdictRefusal(verdict, { chain: "eip155:10143", now: 1_800_000_030 })).toBe("expired");
    expect(verdictRefusal(verdict, { chain: "eip155:143", now: 1_800_000_000 })).toBe(
      "wrong_chain",
    );
    // With the real clock: one verdict long past, one far ahead.
    expect(verdictRefusal({ ...verdict, expiresAt: 1_000 }, { chain: "eip155:10143" })).toBe(
      "expired",
    );
    expect(
      verdictRefusal({ ...verdict, expiresAt: 32_503_680_000 }, { chain: "eip155:10143" }),
    ).toBeNull();
  });
});
