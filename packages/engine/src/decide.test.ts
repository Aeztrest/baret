import { createPolicy, POLICY_TEMPLATES } from "@baret/core";
import { describe, expect, it } from "vitest";
import { decide, policyValue } from "./decide.js";

const balanced = POLICY_TEMPLATES.balanced;
const strict = POLICY_TEMPLATES.strict;
const permissive = POLICY_TEMPLATES.permissive;

describe("decide", () => {
  it("is Safe with no findings", () => {
    expect(decide(balanced, [])).toEqual({ decision: "safe", findings: [], firedRules: [] });
  });

  it("a toggle blocks when its field is on, and is a warning when it is off", () => {
    const draft = { code: "APPROVAL_UNLIMITED" as const, values: {} };
    expect(decide(balanced, [draft]).decision).toBe("blocked");
    expect(decide(balanced, [draft]).firedRules[0]?.rule).toBe("core.blockUnlimitedApprovals");
    expect(decide(permissive, [draft]).decision).toBe("caution");
  });

  it("a warning blocks only when allowWarnings is off", () => {
    const draft = { code: "LOW_CONFIDENCE_INCOMPLETE_DATA" as const, values: {} };
    expect(decide(balanced, [draft]).decision).toBe("caution");
    expect(decide(strict, [draft]).firedRules[0]?.rule).toBe("core.allowWarnings");
  });

  it("a threshold finding names the rule that produced it", () => {
    const r = decide(balanced, [
      {
        code: "X402_PER_TX_CAP_EXCEEDED",
        values: { actual: "6", cap: "5" },
        rule: "core.x402.caps",
      },
    ]);
    expect(r.firedRules).toEqual([
      { rule: "core.x402.caps", code: "X402_PER_TX_CAP_EXCEEDED", limit: "5", actual: "6" },
    ]);
  });

  it("a fail-closed finding with no rule blocks under every policy (fixed from Metropolis)", () => {
    for (const policy of [strict, balanced, permissive]) {
      const r = decide(policy, [{ code: "SIGNATURE_NOT_UNDERSTOOD", values: {} }]);
      expect(r.decision).toBe("blocked");
      expect(r.firedRules[0]?.rule).toBeNull();
    }
  });

  it("drops an exact duplicate", () => {
    const d = { code: "DEEP_CALL_NESTING" as const, values: { count: "5" } };
    expect(decide(balanced, [d, d]).findings).toHaveLength(1);
  });
});

describe("policyValue", () => {
  it("reads a rule by its dotted path", () => {
    const p = createPolicy("strict", { paymentAssets: [] });
    expect(policyValue(p, "core.x402.requireMemo")).toBe(true);
    expect(policyValue(p, "evm.maxGas")).toBe(2_000_000);
  });
});
