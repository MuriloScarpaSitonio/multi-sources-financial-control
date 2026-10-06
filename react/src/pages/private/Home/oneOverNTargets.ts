import { mulberry32, preparePortfolio } from "./fireBootstrap";
import { traceOneOverNTrial } from "./oneOverNTrial";
import type { OneOverNRetirementInput } from "./oneOverNSimulation";
export const ONE_OVER_N_TARGET_SUCCESS_RATE = 0.95;
export const findOneOverNTargets = (
  input: Omit<OneOverNRetirementInput, "startingBalance">,
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
    !Number.isFinite(input.monthlyExpenses) ||
    input.monthlyExpenses < 0
  ) {
    throw new Error(
      "Informe um prazo e despesas válidos para calcular a meta 1/N.",
    );
  }
  if (input.monthlyExpenses === 0) return Array(accumulationYears + 1).fill(0);
  const prepared = preparePortfolio(input.portfolio, input.samplingMethod);
  return Array.from({ length: accumulationYears + 1 }, (_, elapsed) => {
    const rng = mulberry32(42);
    const years = input.years - elapsed;
    const required = new Float64Array(trials);
    for (let trial = 0; trial < trials; trial++) {
      const monthlyReturns = prepared
        .sampleMonths(years * 12, rng)
        .map((i) => prepared.returns[i]);
      const income = traceOneOverNTrial({
        startingBalance: 1,
        years,
        monthlyReturns,
      }).minimumMonthlyIncome;
      required[trial] = income > 0 ? input.monthlyExpenses / income : Infinity;
    }
    required.sort();
    const target =
      required[Math.ceil(ONE_OVER_N_TARGET_SUCCESS_RATE * trials) - 1];
    if (!Number.isFinite(target))
      throw new Error(
        "Não foi possível encontrar uma meta 1/N que cubra seus gastos em 95% das simulações.",
      );
    const rounded = Math.round(target * 100) / 100;
    return Math.abs(rounded - target) < 1e-7
      ? rounded
      : Math.ceil(target * 100) / 100;
  });
};
