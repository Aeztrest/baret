import type { Detector, FindingDraft } from "../analysis/context.js";

/**
 * The fee rules. `evm.maxGas` compares the gas limit (Monad charges for the whole limit, so
 * the limit, not usage, is what the user pays for); `core.maxFee` compares the fee in the
 * native coin's base units. Both emit EXCESSIVE_FEE (Metropolis: EXCESSIVE_GAS).
 */
export const compute: Detector = (ctx) => {
  const out: FindingDraft[] = [];
  const maxGas = ctx.policy.evm.maxGas;
  const limit = ctx.simulation.gasLimit;
  if (maxGas !== null && limit !== null && limit > BigInt(maxGas)) {
    out.push({
      code: "EXCESSIVE_FEE",
      values: { actual: limit.toString(), limit: String(maxGas) },
      details: { unit: "gas" },
      rule: "evm.maxGas",
    });
  }
  const maxFee = ctx.policy.core.maxFee;
  if (maxFee !== null && ctx.feeWei !== null && ctx.feeWei > BigInt(maxFee)) {
    out.push({
      code: "EXCESSIVE_FEE",
      values: { actual: ctx.feeWei.toString(), limit: maxFee },
      details: { unit: "native-base-units" },
      rule: "core.maxFee",
    });
  }
  return out;
};
