import {
  type Decision,
  FINDING_SPECS,
  type Finding,
  type FindingDraft,
  type FiredRule,
  type GuardPolicy,
  type PolicyField,
} from "@baret/core";

/** The value of a rule, read by its dotted path (`core.x402.caps`). */
export function policyValue(policy: GuardPolicy, field: PolicyField): unknown {
  let value: unknown = policy;
  for (const key of field.split(".")) {
    value = (value as Record<string, unknown> | undefined)?.[key];
  }
  return value;
}

export interface Decided {
  decision: Decision;
  findings: Finding[];
  firedRules: FiredRule[];
}

/**
 * Applies the policy to the drafts (ported from Metropolis `policy/evaluate.ts`, D-014):
 *
 *   toggle      blocks when its field is on; otherwise it falls to allowWarnings.
 *   threshold   blocks: its emitter only fires when the rule is set and broken.
 *   failClosed  always blocks, whether or not a rule names it.
 *   warning     blocks only when core.allowWarnings is off.
 *
 * Any blocking finding: Blocked. Findings, none blocking: Caution. None: Safe.
 *
 * Fixed while porting: Metropolis let a fail-closed finding with no rule field fall to
 * allowWarnings. v2 has such codes (SIGNATURE_NOT_UNDERSTOOD, X402_SHAPE_INVALID); they
 * block under every policy and their fired rule is `null`.
 */
export function decide(policy: GuardPolicy, drafts: readonly FindingDraft[]): Decided {
  const findings: Finding[] = [];
  const firedRules: FiredRule[] = [];
  const seen = new Set<string>();

  for (const d of drafts) {
    const key = `${d.code}|${JSON.stringify(d.values)}|${String(d.details?.side ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const spec = FINDING_SPECS[d.code];
    let blocking = false;
    let rule: PolicyField | null = null;
    switch (spec.rule.kind) {
      case "toggle": {
        const field = spec.rule.fields[0];
        if (policyValue(policy, field) === true) {
          blocking = true;
          rule = field;
        }
        break;
      }
      case "threshold":
      case "failClosed":
        blocking = true;
        rule = d.rule ?? spec.rule.fields[0] ?? null;
        break;
      case "warning":
        break;
    }
    if (!blocking && !policy.core.allowWarnings) {
      blocking = true;
      rule = "core.allowWarnings";
    }

    findings.push({
      code: d.code,
      severity: spec.severity,
      values: d.values,
      blocking,
      ...(d.details ? { details: d.details } : {}),
    });
    if (blocking) {
      firedRules.push({
        rule,
        code: d.code,
        limit: d.values.limit ?? d.values.cap ?? null,
        actual: d.values.actual ?? null,
      });
    }
  }

  const decision: Decision =
    firedRules.length > 0 ? "blocked" : findings.length > 0 ? "caution" : "safe";
  return { decision, findings, firedRules };
}
