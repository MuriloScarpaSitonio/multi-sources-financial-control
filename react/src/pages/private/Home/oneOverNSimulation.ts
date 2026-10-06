import {
  mulberry32,
  preparePortfolio,
  type AccumulationResult,
  type BootstrapBand,
} from "./fireBootstrap";
import type { PortfolioSlice } from "./firePortfolio";
import type { SamplingMethod } from "./fireReturnTypes";
import { traceOneOverNTrial, type OneOverNTrial } from "./oneOverNTrial";
import { findOneOverNTargets } from "./oneOverNTargets";
export type OneOverNIncomePercentiles = {
  p10: number;
  p50: number;
  p90: number;
};
export type OneOverNRetirementInput = {
  startingBalance: number;
  monthlyExpenses: number;
  years: number;
  portfolio: readonly PortfolioSlice[];
  samplingMethod: SamplingMethod;
  numTrials?: number;
};
export type OneOverNRetirementResult = {
  trialCount: number;
  successRate: number | null;
  safeMonthlySpending: number | null;
  minimumMonthlyIncome: OneOverNIncomePercentiles | null;
  withdrawalBands: BootstrapBand[];
  balanceBands: BootstrapBand[];
};
export type OneOverNSimulationInput = {
  portfolio: readonly PortfolioSlice[];
  samplingMethod: SamplingMethod;
  extraAccumulationYears: number;
  retirement: Omit<OneOverNRetirementInput, "portfolio" | "samplingMethod">;
  accumulation: {
    startingBalance: number;
    monthlySavings: number;
    years: number;
  };
};
export type OneOverNExtendedAccumulation = {
  extraYears: number;
  retirementStartRate: number;
  retirementTrialCount: number;
  medianYearsToRetirement: number | null;
  medianStartingBalance: number | null;
  initialMonthlyIncome: OneOverNIncomePercentiles | null;
};
export type OneOverNSimulationOutput = {
  targetPatrimony: number;
  targetsByYear: number[];
  retirement: OneOverNRetirementResult;
  accumulation: AccumulationResult;
  extendedAccumulation?: OneOverNExtendedAccumulation;
};
export type OneOverNPlanTrace = {
  retirementStartYear: number | null;
  retirement: OneOverNTrial | null;
  accumulationBalances: number[];
};
export const incomePercentiles = (
  values: readonly number[],
): OneOverNIncomePercentiles | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    n = sorted.length;
  return {
    p10: sorted[n - Math.ceil(0.9 * n)],
    p50: sorted[n - Math.ceil(0.5 * n)],
    p90: sorted[n - Math.ceil(0.1 * n)],
  };
};
const band = (values: number[], year: number): BootstrapBand | null => {
  const p = incomePercentiles(values);
  return p ? { year, ...p } : null;
};
const summarize = (
  traces: { year: number; trace: OneOverNTrial }[],
  expenses: number,
): OneOverNRetirementResult => {
  const minima = incomePercentiles(
    traces.map((t) => t.trace.minimumMonthlyIncome),
  );
  const withdrawalBands: BootstrapBand[] = [],
    balanceBands: BootstrapBand[] = [];
  const length = Math.max(
    0,
    ...traces.map((t) => t.year + t.trace.annualWithdrawals.length),
  );
  for (let year = 0; year <= length; year++) {
    const wealth = band(
      traces
        .filter(
          (t) => year >= t.year && year - t.year < t.trace.balances.length,
        )
        .map((t) => t.trace.balances[year - t.year]),
      year,
    );
    if (wealth) balanceBands.push(wealth);
    const income = band(
      traces
        .filter(
          (t) =>
            year >= t.year && year - t.year < t.trace.annualWithdrawals.length,
        )
        .map((t) => t.trace.annualWithdrawals[year - t.year] / 12),
      year,
    );
    if (income) withdrawalBands.push(income);
  }
  return {
    trialCount: traces.length,
    successRate: traces.length
      ? traces.filter((t) => t.trace.minimumMonthlyIncome >= expenses - 0.005)
          .length / traces.length
      : null,
    minimumMonthlyIncome: minima,
    safeMonthlySpending: minima?.p10 ?? null,
    withdrawalBands,
    balanceBands,
  };
};
const validateRetirement = (input: OneOverNRetirementInput) => {
  const trials = input.numTrials ?? 2000;
  if (
    !Number.isSafeInteger(trials) ||
    trials <= 0 ||
    !Number.isSafeInteger(input.years) ||
    input.years <= 0 ||
    ![input.startingBalance, input.monthlyExpenses].every(
      (v) => Number.isFinite(v) && v >= 0,
    )
  ) {
    throw new Error(
      "Informe patrimônio, despesas e prazo válidos para simular 1/N.",
    );
  }
  return trials;
};
export const runOneOverNRetirement = (
  input: OneOverNRetirementInput,
): OneOverNRetirementResult => {
  const trials = validateRetirement(input),
    prepared = preparePortfolio(input.portfolio, input.samplingMethod),
    rng = mulberry32(42);
  return summarize(
    Array.from({ length: trials }, () => ({
      year: 0,
      trace: traceOneOverNTrial({
        startingBalance: input.startingBalance,
        years: input.years,
        monthlyReturns: prepared
          .sampleMonths(input.years * 12, rng)
          .map((i) => prepared.returns[i]),
      }),
    })),
    input.monthlyExpenses,
  );
};
export const traceOneOverNPlan = (
  input: OneOverNSimulationInput,
  targets: readonly number[],
  monthlyReturns: readonly number[],
): OneOverNPlanTrace => {
  const years = input.retirement.years,
    extras = input.extraAccumulationYears;
  if (monthlyReturns.length !== years * 12)
    throw new Error("Histórico incompatível com o prazo do plano.");
  if (extras === 0)
    return {
      retirementStartYear: 0,
      accumulationBalances: [],
      retirement: traceOneOverNTrial({
        startingBalance: input.retirement.startingBalance,
        years,
        monthlyReturns,
      }),
    };
  let balance = input.retirement.startingBalance,
    reached: number | null = null;
  const accumulationBalances = [balance];
  for (let year = 0; year < years; year++) {
    if (reached === null && year < targets.length && balance >= targets[year])
      reached = year;
    if (reached !== null && year === reached + extras)
      return {
        retirementStartYear: year,
        accumulationBalances,
        retirement: traceOneOverNTrial({
          startingBalance: balance,
          years: years - year,
          monthlyReturns: monthlyReturns.slice(year * 12),
        }),
      };
    for (let month = year * 12; month < (year + 1) * 12; month++)
      balance = Math.max(
        0,
        (balance + input.accumulation.monthlySavings) *
          (1 + monthlyReturns[month]),
      );
    accumulationBalances.push(balance);
  }
  return { retirementStartYear: null, retirement: null, accumulationBalances };
};
export const runOneOverNSimulation = (
  input: OneOverNSimulationInput,
): OneOverNSimulationOutput => {
  const retirementInput = {
    ...input.retirement,
    portfolio: input.portfolio,
    samplingMethod: input.samplingMethod,
  };
  const trials = validateRetirement(retirementInput),
    extras = input.extraAccumulationYears;
  if (
    !Number.isSafeInteger(extras) ||
    extras < 0 ||
    extras > 60 ||
    extras >= input.retirement.years ||
    !Number.isSafeInteger(input.accumulation.years) ||
    input.accumulation.years < 0 ||
    input.accumulation.years >= input.retirement.years ||
    !Number.isFinite(input.accumulation.monthlySavings) ||
    !Number.isFinite(input.accumulation.startingBalance) ||
    input.accumulation.startingBalance < 0
  )
    throw new Error("Informe valores e anos extras válidos para a acumulação.");
  const targets = findOneOverNTargets(
    retirementInput,
    input.accumulation.years,
  );
  const prepared = preparePortfolio(input.portfolio, input.samplingMethod),
    rng = mulberry32(42);
  const gaps: number[][] = targets.map(() => []),
    reachedYears: number[] = [];
  const retired: { year: number; trace: OneOverNTrial }[] = [];
  for (let trial = 0; trial < trials; trial++) {
    const returns = prepared
      .sampleMonths(input.retirement.years * 12, rng)
      .map((i) => prepared.returns[i]);
    let balance = input.accumulation.startingBalance,
      reached: number | null = null;
    for (let year = 0; year < targets.length; year++) {
      if (reached === null && balance >= targets[year]) reached = year;
      gaps[year].push(Math.max(0, targets[year] - balance));
      if (year < input.accumulation.years)
        for (let month = year * 12; month < (year + 1) * 12; month++)
          balance = Math.max(
            0,
            (balance + input.accumulation.monthlySavings) *
              (1 + returns[month]),
          );
    }
    if (reached !== null) reachedYears.push(reached);
    if (extras > 0) {
      const path = traceOneOverNPlan(input, targets, returns);
      if (path.retirement && path.retirementStartYear !== null)
        retired.push({
          year: path.retirementStartYear,
          trace: path.retirement,
        });
    }
  }
  const times = incomePercentiles(reachedYears);
  const accumulation: AccumulationResult = {
    successRate: reachedYears.length / trials,
    medianYearsToTarget: times?.p50 ?? null,
    p10YearsToTarget: times?.p10 ?? null,
    p90YearsToTarget: times?.p90 ?? null,
    gapBands: gaps.map((g, year) => band(g, year)!),
  };
  return {
    targetPatrimony: targets[0],
    targetsByYear: targets,
    accumulation,
    retirement:
      extras > 0
        ? summarize(retired, input.retirement.monthlyExpenses)
        : runOneOverNRetirement(retirementInput),
    ...(extras > 0
      ? {
          extendedAccumulation: {
            extraYears: extras,
            retirementStartRate: retired.length / trials,
            retirementTrialCount: retired.length,
            medianYearsToRetirement:
              incomePercentiles(retired.map((t) => t.year))?.p50 ?? null,
            medianStartingBalance:
              incomePercentiles(retired.map((t) => t.trace.balances[0]))?.p50 ??
              null,
            initialMonthlyIncome: incomePercentiles(
              retired.map((t) => t.trace.annualWithdrawals[0] / 12),
            ),
          },
        }
      : {}),
  };
};
