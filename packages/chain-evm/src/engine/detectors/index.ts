import type { Detector, EvmContext, FindingDraft } from "../analysis/context.js";
import { approvals } from "./approvals.js";
import { compliance } from "./compliance.js";
import { compute } from "./compute.js";
import { cpi } from "./cpi.js";
import { evmDanger } from "./evm-danger.js";
import { lookalike } from "./lookalike.js";
import { policyFindings } from "./policy-rules.js";
import { programs } from "./programs.js";
import { reputation } from "./reputation.js";
import { simulation } from "./simulation.js";
import { x402 } from "./x402.js";

/**
 * Every EVM detector, ported from Metropolis as they are (D9). The universal ones move
 * into packages/engine with the Stellar adapter (TASKS.md T3.7).
 */
export const DETECTORS: Record<string, Detector> = {
  simulation,
  approvals,
  programs,
  "evm-danger": evmDanger,
  reputation,
  lookalike,
  compliance,
  cpi,
  compute,
  x402,
};

/** Every detector, then the policy rules: the drafts the engine's `decide()` turns into a verdict. */
export function runDetectors(ctx: EvmContext): FindingDraft[] {
  return [...Object.values(DETECTORS).flatMap((detect) => detect(ctx)), ...policyFindings(ctx)];
}
