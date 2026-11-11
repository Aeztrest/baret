import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DeliveryLog, readHire, verifyWebhook } from "./webhook.js";

const SECRET = "whsec_0123456789abcdef0123456789abcdef";
const NOW = 1_800_000_000;
const sign = (ts: string, raw: string, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`;

describe("verifyWebhook", () => {
  const raw = '{"event":"hire.created","assignment_id":"a1","description":"x"}';
  const ts = String(NOW);

  it("accepts the market's signature over the raw body", () => {
    expect(
      verifyWebhook(SECRET, { timestamp: ts, signature: sign(ts, raw) }, Buffer.from(raw), NOW),
    ).toBe(true);
  });

  it("refuses a body changed by one byte, another secret, or a re-serialised body", () => {
    const signature = sign(ts, raw);
    const h = { timestamp: ts, signature };
    expect(verifyWebhook(SECRET, h, Buffer.from(raw.replace("a1", "a2")), NOW)).toBe(false);
    expect(verifyWebhook(`${SECRET}x`, h, Buffer.from(raw), NOW)).toBe(false);
    const pretty = JSON.stringify(JSON.parse(raw), null, 2);
    expect(verifyWebhook(SECRET, h, Buffer.from(pretty), NOW)).toBe(false);
  });

  it("refuses an old or future timestamp (replay), and a signed-but-moved timestamp", () => {
    const old = String(NOW - 301);
    expect(
      verifyWebhook(SECRET, { timestamp: old, signature: sign(old, raw) }, Buffer.from(raw), NOW),
    ).toBe(false);
    const future = String(NOW + 301);
    expect(
      verifyWebhook(
        SECRET,
        { timestamp: future, signature: sign(future, raw) },
        Buffer.from(raw),
        NOW,
      ),
    ).toBe(false);
    const recent = String(NOW - 10);
    expect(
      verifyWebhook(SECRET, { timestamp: recent, signature: sign(ts, raw) }, Buffer.from(raw), NOW),
    ).toBe(false);
  });

  it("refuses missing or malformed headers and an empty secret", () => {
    const signature = sign(ts, raw);
    const body = Buffer.from(raw);
    expect(verifyWebhook(SECRET, { timestamp: undefined, signature }, body, NOW)).toBe(false);
    expect(verifyWebhook(SECRET, { timestamp: ts, signature: undefined }, body, NOW)).toBe(false);
    expect(verifyWebhook(SECRET, { timestamp: "12a", signature }, body, NOW)).toBe(false);
    expect(verifyWebhook(SECRET, { timestamp: ts, signature: signature.slice(7) }, body, NOW)).toBe(
      false,
    );
    expect(verifyWebhook(SECRET, { timestamp: ts, signature: "sha256=abc" }, body, NOW)).toBe(
      false,
    );
    expect(verifyWebhook("", { timestamp: ts, signature: sign(ts, raw, "") }, body, NOW)).toBe(
      false,
    );
  });
});

describe("readHire", () => {
  it("reads the assignment and the brief of hire.created", () => {
    expect(readHire({ event: "hire.created", assignment_id: "a1", description: "brief" })).toEqual({
      assignmentId: "a1",
      brief: "brief",
    });
    expect(readHire({ assignment_id: "a1" })).toEqual({ assignmentId: "a1", brief: "" });
    expect(readHire({ description: "no id" })).toBeNull();
    expect(readHire(null)).toBeNull();
  });
});

describe("DeliveryLog", () => {
  it("says first once per id and forgets the oldest past its bound", () => {
    const log = new DeliveryLog(2);
    expect(log.first("a")).toBe(true);
    expect(log.first("a")).toBe(false);
    log.first("b");
    log.first("c");
    expect(log.first("a")).toBe(true);
    expect(log.first("c")).toBe(false);
  });
});
