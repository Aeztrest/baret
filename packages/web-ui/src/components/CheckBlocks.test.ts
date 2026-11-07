import { describe, expect, it } from "vitest";
import { bodyOf, hasValues } from "./CheckBlocks.js";

const BASE = {
  body: "{recipient} has no credential, and your rules require one.",
  bodySelf: "Your account has no credential, and your rules require one.",
  bodyAsset: "{recipient} has no credential, and this asset only moves between verified wallets.",
  bodySelfAsset:
    "Your account has no credential, and this asset only moves between verified wallets.",
};
/** What the server sends in `details.asset`: the compliant asset's address. */
const AUSDC = "0xaC0893567D43C3E7e6e35a72803df05416C1f20D";

describe("bodyOf", () => {
  it("reads the plain body with no details", () => {
    const { template, values } = bodyOf(BASE, { values: { recipient: "0xabc" } });
    expect(template).toBe(BASE.body);
    expect(values).toEqual({ recipient: "0xabc" });
  });

  it("picks bodySelf when details.side is self", () => {
    const { template } = bodyOf(BASE, {
      values: { recipient: "0xabc" },
      details: { side: "self" },
    });
    expect(template).toBe(BASE.bodySelf);
  });

  it("picks bodyAsset when the asset, not a rule, demands it, and never prints the asset's address", () => {
    const { template, values } = bodyOf(BASE, {
      values: { recipient: "0xabc" },
      details: { side: "recipient", asset: AUSDC },
    });
    expect(template).toBe(BASE.bodyAsset);
    expect(values).toEqual({ recipient: "0xabc" });
    expect(template).not.toContain("{asset}");
  });

  it("picks bodySelfAsset when both details are set", () => {
    const { template } = bodyOf(BASE, {
      values: {},
      details: { side: "self", asset: AUSDC },
    });
    expect(template).toBe(BASE.bodySelfAsset);
  });

  it("falls back down the chain when a variant is missing", () => {
    const noSelfAsset = { body: BASE.body, bodyAsset: BASE.bodyAsset };
    expect(
      bodyOf(noSelfAsset, { values: {}, details: { side: "self", asset: AUSDC } }).template,
    ).toBe(noSelfAsset.bodyAsset);
    const noAssetAtAll = { body: BASE.body, bodySelf: BASE.bodySelf };
    expect(bodyOf(noAssetAtAll, { values: {}, details: { asset: AUSDC } }).template).toBe(
      noAssetAtAll.body,
    );
  });

  it("ignores a non-string details.asset", () => {
    const { template, values } = bodyOf(BASE, { values: {}, details: { asset: 5 } });
    expect(template).toBe(BASE.body);
    expect(values).toEqual({});
  });

  const WITH_REASON = {
    body: "{address} is on the blocklist.",
    bodyReason: "{address} is on ScamSniffer's public blacklist.",
  };

  it("picks bodyReason when the registry's reasonCode is a known source", () => {
    const { template, values } = bodyOf(WITH_REASON, {
      values: { address: "0xabc" },
      details: { registry: { reasonCode: "SCAMSNIFFER_BLACKLIST" } },
    });
    expect(template).toBe(WITH_REASON.bodyReason);
    expect(values).toEqual({ address: "0xabc" });
  });

  it("falls back to body when the reasonCode is not a known source", () => {
    const { template } = bodyOf(WITH_REASON, {
      values: { address: "0xabc" },
      details: { registry: { reasonCode: "SOME_FUTURE_CODE" } },
    });
    expect(template).toBe(WITH_REASON.body);
  });

  it("falls back to body when details.registry is null (a Nansen-only flag)", () => {
    const { template } = bodyOf(WITH_REASON, {
      values: { address: "0xabc" },
      details: { registry: null, nansen: true },
    });
    expect(template).toBe(WITH_REASON.body);
  });

  it("falls back to body when there is no bodyReason variant at all", () => {
    const { template } = bodyOf(BASE, {
      values: { recipient: "0xabc" },
      details: { registry: { reasonCode: "SCAMSNIFFER_BLACKLIST" } },
    });
    expect(template).toBe(BASE.body);
  });
});

describe("hasValues", () => {
  it("is true when every placeholder has a non-empty value", () => {
    expect(hasValues("Send {amount} to {recipient}", { amount: "5", recipient: "0x1" })).toBe(true);
  });

  it("is false when a placeholder's value is missing or empty", () => {
    expect(hasValues("Send {amount} to {recipient}", { amount: "5" })).toBe(false);
    expect(hasValues("Send {amount} to {recipient}", { amount: "5", recipient: "" })).toBe(false);
  });

  it("is true for a template with no placeholders", () => {
    expect(hasValues("Nothing to fill in.", {})).toBe(true);
  });
});
