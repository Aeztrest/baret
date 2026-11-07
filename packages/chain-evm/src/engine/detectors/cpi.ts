import type { Detector, FindingDraft } from "../analysis/context.js";

/** Call depth that hides most of what runs behind the first call. */
export const DEEP_NESTING_THRESHOLD = 4;
/** Operations in one signature above which one extra transfer is easy to miss. */
export const HIGH_OPERATION_THRESHOLD = 10;

export const cpi: Detector = (ctx) => {
  const out: FindingDraft[] = [];
  const depth = ctx.trace?.maxDepth ?? 0;
  if (depth >= DEEP_NESTING_THRESHOLD) {
    out.push({ code: "DEEP_CALL_NESTING", values: { count: String(depth) } });
  }
  if (ctx.effects.operationCount > HIGH_OPERATION_THRESHOLD) {
    out.push({
      code: "HIGH_OPERATION_COUNT",
      values: { count: String(ctx.effects.operationCount) },
    });
  }
  return out;
};
