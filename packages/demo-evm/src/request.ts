import type { AnalyzeRequest, GuardPolicy, PolicyTemplateName } from "@baret/core";
import { DEMO } from "./addresses.js";
import type { DemoTx } from "./builders.js";
import type { DemoPayment } from "./x402.js";

/** Rules for one check: a template by name, or a whole policy. */
export type DemoRules = { policyTemplate: PolicyTemplateName } | { policy: GuardPolicy };

const rulesOf = (rules: DemoRules | undefined) => rules ?? { policyTemplate: "balanced" as const };

/** A demo call as a `POST /v1/analyze` body. */
export function callRequest(tx: DemoTx, rules?: DemoRules): AnalyzeRequest {
  return { chain: DEMO.chain, request: { kind: "call", tx }, ...rulesOf(rules) };
}

/** A demo x402 payment as a `POST /v1/analyze` body. */
export function paymentRequest(p: DemoPayment, rules?: DemoRules): AnalyzeRequest {
  return {
    chain: DEMO.chain,
    request: { kind: "typed-data", typedData: p.typedData },
    payment: p.payment,
    ...rulesOf(rules),
  };
}
