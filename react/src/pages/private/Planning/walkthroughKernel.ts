// Fixed educational portfolio. Sampling and search evaluation use the production
// engine; the trace exposes monthly draws and annual balances for the charts.
import { runBootstrap, sampleMonthKeys } from "../Home/fireBootstrap";
import {
  eligibleMonths,
  returnForMonth,
  type PortfolioSlice,
} from "../Home/firePortfolio";
import type { SamplingMethod } from "../Home/fireReturnTypes";

export const EXAMPLE_EQUITY_WEIGHT = 0.7;
export const EXAMPLE_FI_WEIGHT = 0.3;
export const STARTING_BALANCE = 1_000_000;
export const DEFAULT_HORIZON = 30;
export const HORIZON_MIN = 20;
export const HORIZON_MAX = 80;
export const TRIALS_PER_SEARCH_TEST = 1000;
const portfolio: PortfolioSlice[] = [
  {
    category: "BR_EQUITY",
    series: "IBOV",
    weight: EXAMPLE_EQUITY_WEIGHT,
    constrainsSample: true,
  },
  {
    category: "FIXED_CDI",
    series: "CDI",
    weight: EXAMPLE_FI_WEIGHT,
    constrainsSample: true,
  },
];
export const EXAMPLE_MONTHS = eligibleMonths(portfolio);
const returns = new Map(
  EXAMPLE_MONTHS.map((month) => [
    month,
    portfolio.reduce(
      (sum, slice) => sum + slice.weight * returnForMonth(slice, month),
      0,
    ),
  ]),
);

const mulberry32 = (seed: number) => () => {
  let t = (seed = (seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const sampleTrialMonths = (
  seed: number,
  horizon: number,
  method: SamplingMethod,
) =>
  sampleMonthKeys({
    eligible: EXAMPLE_MONTHS,
    method,
    count: horizon * 12,
    rng: mulberry32(seed),
  });

export type TrialResult = {
  balances: number[];
  months: string[];
  yearReturns: number[];
  busted: boolean;
};
export const simulateTrial = (
  rate: number,
  seed: number,
  horizon: number,
  method: SamplingMethod = "independent_months",
): TrialResult => {
  const months = sampleTrialMonths(seed, horizon, method);
  const balances = [STARTING_BALANCE];
  const yearReturns: number[] = [];
  const monthlyWithdrawal = (STARTING_BALANCE * rate) / 12;
  let balance = STARTING_BALANCE;
  let compounded = 1;
  let busted = false;
  months.forEach((month, index) => {
    const monthlyReturn = returns.get(month)!;
    compounded *= 1 + monthlyReturn;
    if (balance > 0) {
      const grown = balance * (1 + monthlyReturn);
      balance = grown - Math.min(monthlyWithdrawal, Math.max(0, grown));
      if (balance <= 0) {
        balance = 0;
        busted = true;
      }
    }
    if ((index + 1) % 12 === 0) {
      balances.push(balance);
      yearReturns.push(compounded - 1);
      compounded = 1;
    }
  });
  return { balances, months, yearReturns, busted };
};

export type SearchIteration = {
  iter: number;
  lo: number;
  hi: number;
  mid: number;
  successRate: number;
  passes: boolean;
};
export const runBinarySearch = (
  horizon: number,
  method: SamplingMethod = "independent_months",
): SearchIteration[] => {
  const iterations: SearchIteration[] = [];
  let lo = 0.005;
  let hi = 0.1;
  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2;
    const { successRate } = runBootstrap(
      STARTING_BALANCE,
      STARTING_BALANCE * mid,
      horizon,
      portfolio,
      method,
      TRIALS_PER_SEARCH_TEST,
    );
    const passes = successRate >= 0.9;
    iterations.push({ iter, lo, hi, mid, successRate, passes });
    if (passes) lo = mid;
    else hi = mid;
  }
  return iterations;
};
