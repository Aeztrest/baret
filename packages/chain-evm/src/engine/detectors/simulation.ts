import type { Detector } from "../analysis/context.js";
import { explainRevert } from "../simulation/reverts.js";

export const simulation: Detector = (ctx) => {
  if (!ctx.simulation.ran) return [];
  if (!ctx.simulation.ok) {
    // The contract's own error, when it is one Baret can read, says more than the node's sentence.
    const explained = explainRevert(ctx.simulation.revertData);
    return [
      {
        code: "SIMULATION_FAILED",
        values: {},
        details: explained
          ? { revertReason: explained.reason, revertError: explained.error }
          : { revertReason: ctx.simulation.revertReason },
      },
    ];
  }
  if (!ctx.simulation.traced) return [{ code: "LOW_CONFIDENCE_INCOMPLETE_DATA", values: {} }];
  return [];
};
