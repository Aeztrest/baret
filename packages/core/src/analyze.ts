import { z } from "zod";
import { allowanceSchema, balanceChangeSchema } from "./effects.js";
import { FINDING_CODES, SEVERITIES } from "./findings.js";
import { caip2Schema, caip10Schema, caip19Schema } from "./ids.js";
import { guardPolicySchema, POLICY_FIELDS } from "./policy.js";
import { POLICY_TEMPLATE_NAMES } from "./policy-templates.js";
import { baseUnitsSchema } from "./units.js";

// ---------------------------------------------------------------------------
// Request: POST /v1/analyze (docs/architecture/api.md §2)

/** A past agent payment, for the rolling hourly and daily caps. */
export const spendRecordSchema = z
  .object({
    asset: caip19Schema,
    amount: baseUnitsSchema,
    /** Unix seconds. */
    timestamp: z.number().int().nonnegative(),
  })
  .strict();

/** What the merchant's 402 answer asked for. */
export const paymentRequirementsSchema = z
  .object({
    scheme: z.string().min(1),
    network: caip2Schema,
    /** The payee in the family's native address form. */
    payTo: z.string().min(1),
    asset: caip19Schema,
    amount: baseUnitsSchema,
    memo: z.string().nullable().optional(),
    facilitator: z.url().optional(),
  })
  .strict();

export const paymentContextSchema = z
  .object({
    origin: z.url(),
    requirements: paymentRequirementsSchema,
    /** Payments in the last 24 hours. Required when an hourly or daily cap is set. */
    spendHistory: z.array(spendRecordSchema).optional(),
  })
  .strict();

export const analyzeRequestSchema = z
  .object({
    chain: caip2Schema,
    /** The family payload (transaction, message, auth entry). The family adapter validates it. */
    request: z.unknown(),
    policy: guardPolicySchema.optional(),
    policyTemplate: z.enum(POLICY_TEMPLATE_NAMES).optional(),
    /** Whose balances the loss rules protect. Defaults to the signer. */
    account: caip10Schema.optional(),
    payment: paymentContextSchema.optional(),
    integratorRequestId: z.string().max(128).optional(),
  })
  .strict()
  .refine((r) => r.request !== undefined && r.request !== null, {
    message: "`request` is required",
    path: ["request"],
  })
  .refine((r) => r.policy === undefined || r.policyTemplate === undefined, {
    message: "send `policy` or `policyTemplate`, not both",
  });

export type SpendRecord = z.infer<typeof spendRecordSchema>;
export type PaymentRequirements = z.infer<typeof paymentRequirementsSchema>;
export type PaymentContext = z.infer<typeof paymentContextSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

// ---------------------------------------------------------------------------
// Response: the Verdict (docs/architecture/engine.md §6)

export const DECISIONS = ["safe", "caution", "blocked"] as const;
export type Decision = (typeof DECISIONS)[number];

export const findingSchema = z
  .object({
    code: z.enum(FINDING_CODES),
    severity: z.enum(SEVERITIES),
    /** Values the sentence for this code interpolates; the sentence lives in @baret/content. */
    values: z.record(z.string(), z.string()),
    /** Whether this finding alone blocks under the policy that was applied. */
    blocking: z.boolean(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/** A rule that blocked: "Requested {actual}. Your rule allows {limit}." */
export const firedRuleSchema = z
  .object({
    rule: z.enum(POLICY_FIELDS),
    code: z.enum(FINDING_CODES),
    limit: z.string().nullable(),
    actual: z.string().nullable(),
  })
  .strict();

export const suggestionSchema = z
  .object({ code: z.enum(FINDING_CODES), values: z.record(z.string(), z.string()) })
  .strict();

export const sourceStatusSchema = z
  .object({
    /** Provider name, e.g. "reputation-registry", "nansen". */
    name: z.string().regex(/^[a-z0-9-]+$/),
    /** skipped: no rule in this policy needed it. */
    status: z.enum(["ok", "unavailable", "skipped"]),
  })
  .strict();

export const SIMULATION_MODES = ["trace", "preflight", "speculative", "none"] as const;

export const verdictSchema = z
  .object({
    decision: z.enum(DECISIONS),
    findings: z.array(findingSchema),
    firedRules: z.array(firedRuleSchema),
    suggestions: z.array(suggestionSchema),
    confidence: z.enum(["high", "medium", "low"]),
    estimatedChanges: z.array(balanceChangeSchema),
    allowances: z.array(allowanceSchema),
    sources: z.array(sourceStatusSchema),
    chain: caip2Schema,
    /** The chain state the verdict was computed against. */
    pinnedAt: z
      .object({ kind: z.enum(["block", "ledger", "state-root"]), value: z.string() })
      .strict()
      .nullable(),
    /** Unix seconds. A signer refuses an expired verdict. */
    expiresAt: z.number().int().nonnegative(),
    meta: z
      .object({
        requestId: z.string(),
        engineVersion: z.string(),
        adapterVersion: z.string(),
        simulation: z.enum(SIMULATION_MODES),
        /** ISO-8601. */
        analyzedAt: z.string(),
        integratorRequestId: z.string().optional(),
      })
      .strict(),
  })
  .strict()
  .refine((v) => (v.decision === "safe") === (v.findings.length === 0), {
    message: "safe means no findings, and no findings means safe",
  })
  .refine((v) => (v.decision === "blocked") === v.findings.some((f) => f.blocking), {
    message: "blocked exactly when at least one finding blocks",
  });

export type Finding = z.infer<typeof findingSchema>;
export type FiredRule = z.infer<typeof firedRuleSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type SimulationMode = (typeof SIMULATION_MODES)[number];
export type Verdict = z.infer<typeof verdictSchema>;
