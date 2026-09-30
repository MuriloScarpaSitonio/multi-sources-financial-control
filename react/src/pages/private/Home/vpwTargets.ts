import { mulberry32, preparePortfolio } from "./fireBootstrap";
import { VPW_SCENARIO_ERRORS } from "./vpwErrors";
import { vpwMonthlyRates } from "./vpwMath";
import type { VPWRetirementInput } from "./vpwSimulation";

export const VPW_TARGET_SUCCESS_RATE = 0.95;

type TargetInput = Omit<VPWRetirementInput, "startingBalance">;

// Capital required to pay the requested budget in every month of one sampled
// retirement. Work backward through the same VPW cash flow: before a payment,
// balance must fund both the VPW allowance and next month's required balance.
const requiredCapital = (
  spending: number,
  rates: Float64Array,
  rateOffset: number,
  sampled: readonly number[],
  returns: readonly number[],
): number => {
  let required = 0;
  for (let month = sampled.length - 1; month >= 0; month--) {
    const growth = 1 + returns[sampled[month]];
    if (required > 0 && growth <= 0) return Infinity;
    const future = required > 0 ? required / growth : 0;
    required = Math.max(
      spending / rates[rateOffset + month],
      spending + future,
    );
  }
  return required;
};

// Index zero is the retire-today target. Later entries use the shorter remaining
// retirement horizon, each with exactly the same seed/sampling as a fresh VPW
// retirement at that age. All expensive target work stays in the worker.
export const findVPWTargets = (
  input: TargetInput,
  accumulationYears: number,
): number[] => {
  const trials = input.numTrials ?? 2000;
  if (
    !Number.isSafeInteger(trials) ||
    trials <= 0 ||
    !Number.isSafeInteger(input.years) ||
    input.years <= 0 ||
    !Number.isSafeInteger(accumulationYears) ||
    accumulationYears < 0 ||
    accumulationYears >= input.years ||
    !Number.isFinite(input.monthlySpending) ||
    input.monthlySpending < 0
  ) {
    throw new Error("Invalid VPW target inputs");
  }
  const rates = vpwMonthlyRates(input.annualGrowth, input.years * 12);
  if (input.monthlySpending === 0) return Array(accumulationYears + 1).fill(0);
  const prepared = preparePortfolio(input.portfolio, input.samplingMethod);
  const required = new Float64Array(trials);
  return Array.from({ length: accumulationYears + 1 }, (_, year) => {
    const rng = mulberry32(42);
    const months = (input.years - year) * 12;
    for (let trial = 0; trial < trials; trial++) {
      required[trial] = requiredCapital(
        input.monthlySpending,
        rates,
        year * 12,
        prepared.sampleMonths(months, rng),
        prepared.returns,
      );
    }
    required.sort();
    const target = required[Math.ceil(VPW_TARGET_SUCCESS_RATE * trials) - 1];
    if (!Number.isFinite(target)) {
      throw new Error(VPW_SCENARIO_ERRORS.targetUnavailable);
    }
    // Ignore sub-microcent floating-point dust at an exact cent, then round
    // genuine fractions upward so displayed capital still meets the threshold.
    const nearestCent = Math.round(target * 100) / 100;
    return Math.abs(target - nearestCent) < 1e-7
      ? nearestCent
      : Math.ceil(target * 100) / 100;
  });
};
