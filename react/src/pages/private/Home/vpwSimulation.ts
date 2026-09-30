import {
  mulberry32,
  preparePortfolio,
  type AccumulationResult,
  type BootstrapBand,
} from "./fireBootstrap";
import type { PortfolioSlice } from "./firePortfolio";
import type { SamplingMethod } from "./fireReturnTypes";
import { vpwMonthlyRates } from "./vpwMath";
import { findVPWTargets } from "./vpwTargets";
import { VPW_SCENARIO_ERRORS } from "./vpwErrors";

export type VPWRetirementInput = {
  startingBalance: number;
  monthlySpending: number;
  years: number;
  annualGrowth: number;
  portfolio: readonly PortfolioSlice[];
  samplingMethod: SamplingMethod;
  numTrials?: number;
};

export type VPWIncomePercentiles = { p10: number; p50: number; p90: number };

export type VPWRetirementResult = {
  // Conditional on starting retirement when extra accumulation is enabled.
  trialCount: number;
  successRate: number | null;
  safeMonthlySpending: number | null;
  sustainableMonthlySpending: VPWIncomePercentiles | null;
  withdrawalBands: BootstrapBand[];
  // Monthly VPW allowance at each year's start on the actual spending path.
  monthlyWithdrawalLimitBands: BootstrapBand[];
  balanceBands: BootstrapBand[];
  minimumMonthlyIncome: VPWIncomePercentiles;
};

const percentiles = (values: Float64Array): VPWIncomePercentiles => {
  values.sort();
  return {
    p10: values[Math.floor(values.length * 0.1)],
    p50: values[Math.floor(values.length * 0.5)],
    p90: values[Math.floor(values.length * 0.9)],
  };
};

// Half a cent avoids classifying floating-point rounding as a spending cut.
const SPENDING_TOLERANCE = 0.005;

// Search the spending cap using the existing monthly VPW cash flow and the
// same sampled path. Retirement start/balance stay fixed for this scenario.
const safeSpendingForTrial = (
  startingBalance: number,
  startMonth: number,
  rates: Float64Array,
  sampled: readonly number[],
  returns: readonly number[],
): number => {
  const coversEveryMonth = (spending: number) => {
    let balance = startingBalance;
    for (let month = startMonth; month < rates.length; month++) {
      const payment = Math.min(balance * rates[month], spending, balance);
      if (spending - payment > SPENDING_TOLERANCE) return false;
      balance = Math.max(
        0,
        (balance - payment) * (1 + returns[sampled[month]]),
      );
    }
    return true;
  };
  let lower = 0;
  let upper = Math.min(startingBalance * rates[startMonth], startingBalance);
  if (coversEveryMonth(upper)) return Math.floor(upper * 100) / 100;
  for (let i = 0; i < 64 && upper - lower > 0.0001; i++) {
    const candidate = (lower + upper) / 2;
    if (coversEveryMonth(candidate)) lower = candidate;
    else upper = candidate;
  }
  return Math.floor(lower * 100) / 100;
};

const spendingSummary = (successfulTrials: number, safeBudgets: number[]) => {
  const trialCount = safeBudgets.length;
  safeBudgets.sort((a, b) => a - b);
  // Choose observed cent amounts covered by at least 90%, 50%, and 10%
  // of participating trials, including when the trial count is small or odd.
  const sustainableMonthlySpending = trialCount
    ? {
        p10: safeBudgets[trialCount - Math.ceil(0.9 * trialCount)],
        p50: safeBudgets[trialCount - Math.ceil(0.5 * trialCount)],
        p90: safeBudgets[trialCount - Math.ceil(0.1 * trialCount)],
      }
    : null;
  return {
    trialCount,
    successRate: trialCount ? successfulTrials / trialCount : null,
    safeMonthlySpending: sustainableMonthlySpending?.p10 ?? null,
    sustainableMonthlySpending,
  };
};

export const runVPWRetirement = (
  input: VPWRetirementInput,
): VPWRetirementResult => {
  const trials = input.numTrials ?? 1500;
  if (!Number.isSafeInteger(trials) || trials <= 0) {
    throw new Error("Trial count must be a positive integer");
  }
  if (!Number.isSafeInteger(input.years) || input.years <= 0) {
    throw new Error("Retirement years must be a positive integer");
  }
  for (const value of [input.startingBalance, input.monthlySpending]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(
        "Balance and monthly spending must be finite and nonnegative",
      );
    }
  }

  const months = input.years * 12;
  const rates = vpwMonthlyRates(input.annualGrowth, months);
  const prepared = preparePortfolio(input.portfolio, input.samplingMethod);
  const rng = mulberry32(42);
  const withdrawals = Array.from(
    { length: input.years },
    () => new Float64Array(trials),
  );
  const withdrawalLimits = Array.from(
    { length: input.years },
    () => new Float64Array(trials),
  );
  const balances = Array.from(
    { length: input.years },
    () => new Float64Array(trials),
  );
  const minima = new Float64Array(trials);
  const safeBudgets: number[] = [];
  let successfulTrials = 0;

  for (let trial = 0; trial < trials; trial++) {
    const sampled = prepared.sampleMonths(months, rng);
    let balance = input.startingBalance;
    let minimum = Infinity;
    let covered = true;
    let month = 0;
    for (let year = 0; year < input.years; year++) {
      withdrawalLimits[year][trial] = Math.min(balance * rates[month], balance);
      let annualWithdrawal = 0;
      for (let withinYear = 0; withinYear < 12; withinYear++, month++) {
        const payment = Math.min(
          balance * rates[month],
          input.monthlySpending,
          balance,
        );
        if (input.monthlySpending - payment > SPENDING_TOLERANCE)
          covered = false;
        annualWithdrawal += payment;
        balance = Math.max(
          0,
          (balance - payment) * (1 + prepared.returns[sampled[month]]),
        );
      }
      withdrawals[year][trial] = annualWithdrawal;
      balances[year][trial] = balance;
      minimum = Math.min(minimum, annualWithdrawal / 12);
    }
    minima[trial] = minimum;
    if (covered) successfulTrials++;
    safeBudgets.push(
      safeSpendingForTrial(
        input.startingBalance,
        0,
        rates,
        sampled,
        prepared.returns,
      ),
    );
  }

  return {
    ...spendingSummary(successfulTrials, safeBudgets),
    withdrawalBands: withdrawals.map((values, year) => ({
      year,
      ...percentiles(values),
    })),
    monthlyWithdrawalLimitBands: withdrawalLimits.map((values, year) => ({
      year,
      ...percentiles(values),
    })),
    balanceBands: [
      {
        year: 0,
        p10: input.startingBalance,
        p50: input.startingBalance,
        p90: input.startingBalance,
      },
      ...balances.map((values, year) => ({
        year: year + 1,
        ...percentiles(values),
      })),
    ],
    minimumMonthlyIncome: percentiles(minima),
  };
};

export type VPWAccumulationInput = {
  startingBalance: number;
  monthlySavings: number;
  // Index 0 is today's target; the last index is the actual simulated horizon.
  targets: readonly number[];
  portfolio: readonly PortfolioSlice[];
  samplingMethod: SamplingMethod;
  numTrials?: number;
};

export const runVPWAccumulation = (
  input: VPWAccumulationInput,
): AccumulationResult | null => {
  const trials = input.numTrials ?? 1500;
  if (!Number.isSafeInteger(trials) || trials <= 0) {
    throw new Error("Trial count must be a positive integer");
  }
  if (!Number.isFinite(input.startingBalance) || input.startingBalance < 0) {
    throw new Error("Starting balance must be finite and nonnegative");
  }
  if (!Number.isFinite(input.monthlySavings)) {
    throw new Error("Monthly savings must be finite");
  }
  if (
    input.targets.length === 0 ||
    input.targets.some((target) => !Number.isFinite(target) || target < 0)
  ) {
    throw new Error(
      "Supply a nonnegative finite target for each simulated year",
    );
  }
  // A household deficit is not assumed to be funded from retirement assets.
  if (input.monthlySavings <= 0) return null;

  const years = input.targets.length - 1;
  const prepared = preparePortfolio(input.portfolio, input.samplingMethod);
  const rng = mulberry32(42);
  const gaps = input.targets.map(() => new Float64Array(trials));
  const reached: number[] = [];
  for (let trial = 0; trial < trials; trial++) {
    let balance = input.startingBalance;
    let yearReached: number | null = balance >= input.targets[0] ? 0 : null;
    gaps[0][trial] = Math.max(0, input.targets[0] - balance);
    const sampled = prepared.sampleMonths(years * 12, rng);
    for (let year = 1; year <= years; year++) {
      if (yearReached === null) {
        for (let month = (year - 1) * 12; month < year * 12; month++) {
          balance = Math.max(
            0,
            (balance + input.monthlySavings) *
              (1 + prepared.returns[sampled[month]]),
          );
        }
        if (balance >= input.targets[year]) yearReached = year;
      }
      gaps[year][trial] = Math.max(0, input.targets[year] - balance);
    }
    if (yearReached !== null) reached.push(yearReached);
  }
  reached.sort((a, b) => a - b);
  return {
    successRate: reached.length / trials,
    medianYearsToTarget: reached.length
      ? reached[Math.floor(reached.length * 0.5)]
      : null,
    p10YearsToTarget: reached.length
      ? reached[Math.floor(reached.length * 0.1)]
      : null,
    p90YearsToTarget: reached.length
      ? reached[Math.floor(reached.length * 0.9)]
      : null,
    gapBands: gaps.map((values, year) => ({ year, ...percentiles(values) })),
  };
};

export type VPWSimulationInput = {
  extraAccumulationYears?: number;
  portfolio: readonly PortfolioSlice[];
  samplingMethod: SamplingMethod;
  retirement: Omit<VPWRetirementInput, "portfolio" | "samplingMethod">;
  accumulation: Omit<
    VPWAccumulationInput,
    "portfolio" | "samplingMethod" | "targets"
  > & { years: number };
};

export type VPWExtendedAccumulation = {
  extraYears: number;
  retirementStartRate: number;
  retirementTrialCount: number;
  medianYearsToRetirement: number | null;
  medianStartingBalance: number | null;
  initialMonthlyIncome: VPWIncomePercentiles | null;
};

export type VPWSimulationOutput = {
  targetPatrimony: number;
  extendedAccumulation?: VPWExtendedAccumulation;

  retirement: VPWRetirementResult;
  accumulation: AccumulationResult | null;
};

export const runVPWSimulation = (
  input: VPWSimulationInput,
): VPWSimulationOutput => {
  const history = {
    portfolio: input.portfolio,
    samplingMethod: input.samplingMethod,
  };
  const extraYears = input.extraAccumulationYears ?? 0;
  if (
    !Number.isSafeInteger(extraYears) ||
    extraYears < 0 ||
    extraYears > 60 ||
    extraYears >= input.retirement.years
  ) {
    throw new Error(
      "Extra accumulation years must leave at least one retirement year",
    );
  }
  if (
    !Number.isSafeInteger(input.accumulation.years) ||
    input.accumulation.years < 0 ||
    input.accumulation.years >= input.retirement.years
  ) {
    throw new Error(
      "Accumulation horizon must leave at least one retirement year",
    );
  }
  const targets = findVPWTargets(
    { ...input.retirement, ...history },
    input.accumulation.monthlySavings > 0 ? input.accumulation.years : 0,
  );
  const targetPatrimony = targets[0];
  const accumulation = runVPWAccumulation({
    ...input.accumulation,
    targets,
    ...history,
  });
  if (extraYears === 0)
    return {
      targetPatrimony,
      retirement: runVPWRetirement({ ...input.retirement, ...history }),
      accumulation,
    };
  return {
    ...runVPWExtendedAccumulation(input, extraYears, targets),
    targetPatrimony,
    accumulation,
  };
};

// Sample one continuous path per trial. Rates and history are prepared once,
// and each trial's own balance funds its retirement (never a median shortcut).
const runVPWExtendedAccumulation = (
  input: VPWSimulationInput,
  extraYears: number,
  targets: readonly number[],
): Pick<VPWSimulationOutput, "retirement" | "extendedAccumulation"> => {
  const { years, annualGrowth, startingBalance, monthlySpending } =
    input.retirement;
  const trials = input.retirement.numTrials ?? 1500;
  if (
    !Number.isSafeInteger(trials) ||
    trials <= 0 ||
    !Number.isSafeInteger(years) ||
    years <= 0 ||
    ![startingBalance, monthlySpending].every(
      (v) => Number.isFinite(v) && v >= 0,
    )
  ) {
    throw new Error("Invalid VPW retirement inputs");
  }
  if (input.accumulation.monthlySavings <= 0 && startingBalance < targets[0]) {
    throw new Error(VPW_SCENARIO_ERRORS.contributionsRequired);
  }
  const months = years * 12;
  const rates = vpwMonthlyRates(annualGrowth, months);
  const prepared = preparePortfolio(input.portfolio, input.samplingMethod);
  const rng = mulberry32(42);
  const savings = Math.max(0, input.accumulation.monthlySavings);
  const lastReachYear = Math.min(targets.length - 1, years - extraYears - 1);
  const withdrawals: number[][] = Array.from({ length: years }, () => []);
  const withdrawalLimits: number[][] = Array.from({ length: years }, () => []);
  const balances: number[][] = Array.from({ length: years + 1 }, () => []);
  const minima: number[] = [],
    startYears: number[] = [],
    startBalances: number[] = [],
    initialIncomes: number[] = [];
  const safeBudgets: number[] = [];
  let successfulTrials = 0;
  for (let trial = 0; trial < trials; trial++) {
    const sampled = prepared.sampleMonths(months, rng);
    let balance = startingBalance;
    let reached: number | null = balance >= targets[0] ? 0 : null;
    let retirementYear: number | null = null;
    let minimum = Infinity;
    let covered = true;
    for (let year = 0; year < years; year++) {
      if (reached === null && year <= lastReachYear && balance >= targets[year])
        reached = year;
      if (reached === null && year >= lastReachYear) break;
      if (
        retirementYear === null &&
        reached !== null &&
        year === reached + extraYears
      ) {
        retirementYear = year;
        startYears.push(year);
        startBalances.push(balance);
        safeBudgets.push(
          safeSpendingForTrial(
            balance,
            year * 12,
            rates,
            sampled,
            prepared.returns,
          ),
        );
        initialIncomes.push(
          Math.min(balance * rates[year * 12], monthlySpending, balance),
        );
        balances[year].push(balance);
      }
      if (retirementYear !== null) {
        withdrawalLimits[year].push(
          Math.min(balance * rates[year * 12], balance),
        );
      }
      let annualWithdrawal = 0;
      for (let month = year * 12; month < (year + 1) * 12; month++) {
        if (retirementYear === null) {
          balance =
            (balance + savings) * (1 + prepared.returns[sampled[month]]);
        } else {
          const payment = Math.min(
            balance * rates[month],
            monthlySpending,
            balance,
          );
          if (monthlySpending - payment > SPENDING_TOLERANCE) covered = false;
          annualWithdrawal += payment;
          balance =
            (balance - payment) * (1 + prepared.returns[sampled[month]]);
        }
        balance = Math.max(0, balance);
      }
      if (retirementYear !== null) {
        withdrawals[year].push(annualWithdrawal);
        balances[year + 1].push(balance);
        minimum = Math.min(minimum, annualWithdrawal / 12);
      }
    }
    if (retirementYear !== null) {
      minima.push(minimum);
      if (covered) successfulTrials++;
    }
  }
  const stats = (values: number[]) => percentiles(Float64Array.from(values));
  const bands = (values: number[][]): BootstrapBand[] =>
    values.flatMap((v, year) => (v.length ? [{ year, ...stats(v) }] : []));
  return {
    extendedAccumulation: {
      extraYears,
      retirementStartRate: startYears.length / trials,
      retirementTrialCount: startYears.length,
      medianYearsToRetirement: startYears.length ? stats(startYears).p50 : null,
      medianStartingBalance: startBalances.length
        ? stats(startBalances).p50
        : null,
      initialMonthlyIncome: initialIncomes.length
        ? stats(initialIncomes)
        : null,
    },
    retirement: {
      ...spendingSummary(successfulTrials, safeBudgets),
      // Calendar years from today; a year's bands include only retired trials.
      withdrawalBands: bands(withdrawals),
      monthlyWithdrawalLimitBands: bands(withdrawalLimits),
      balanceBands: bands(balances),
      minimumMonthlyIncome: minima.length
        ? stats(minima)
        : { p10: 0, p50: 0, p90: 0 },
    },
  };
};
