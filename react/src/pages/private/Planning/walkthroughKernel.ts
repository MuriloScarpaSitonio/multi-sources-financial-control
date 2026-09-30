// Retirement traces use the currently selected portfolio and historical sample.
import {
  runBootstrap,
  runBootstrapWithVaryingWeights,
  sampleMonthKeys,
  mulberry32,
} from "../Home/fireBootstrap";
import {
  eligibleMonths,
  returnForMonth,
  buildAgeInBondsPortfolio,
} from "../Home/firePortfolio";
import type { FireStudioSnapshot } from "./fire/fireStudioScenario";

export const TRIALS_PER_SEARCH_TEST = 2000;
export const prepareWalkthrough = (snapshot: FireStudioSnapshot) => {
  const available = eligibleMonths(snapshot.portfolio);
  const returns = new Map(
    available.map((month) => [
      month,
      snapshot.portfolio.reduce(
        (sum, slice) => sum + slice.weight * returnForMonth(slice, month),
        0,
      ),
    ]),
  );
  // Validate the selected sampler before mounting any of the four steps.
  sampleMonthKeys({
    eligible: available,
    method: snapshot.samplingMethod,
    count: 12,
    rng: mulberry32(1),
  });
  return { snapshot, available, returns };
};
export type WalkthroughScenario = ReturnType<typeof prepareWalkthrough>;

export const sampleTrialMonths = (
  seed: number,
  scenario: WalkthroughScenario,
) =>
  sampleMonthKeys({
    eligible: scenario.available,
    method: scenario.snapshot.samplingMethod,
    count: scenario.snapshot.targetYears * 12,
    rng: mulberry32(seed),
  });

export type TrialResult = {
  balances: number[];
  months: string[];
  yearReturns: number[];
  busted: boolean;
};
export const simulateTrial = (
  seed: number,
  scenario: WalkthroughScenario,
): TrialResult => {
  const months = sampleTrialMonths(seed, scenario);
  const { effectivePatrimony, monthlyExpenses } = scenario.snapshot;
  const balances = [effectivePatrimony];
  const yearReturns: number[] = [];
  const monthlyWithdrawal = monthlyExpenses;
  let balance = effectivePatrimony;
  let compounded = 1;
  let busted = balance <= 0 && monthlyWithdrawal > 0;
  months.forEach((month, index) => {
    const monthlyReturn = scenario.returns.get(month)!;
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
  scenario: WalkthroughScenario,
  anchorAge?: number,
): SearchIteration[] => {
  const { targetYears, portfolio, samplingMethod } = scenario.snapshot;
  // As in production, a normalized positive balance keeps the rate search scale independent.
  const startingBalance = 1_000_000;
  const iterations: SearchIteration[] = [];
  let lo = 0.005;
  let hi = 0.1;
  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2;
    const { successRate } =
      anchorAge === undefined
        ? runBootstrap(
            startingBalance,
            startingBalance * mid,
            targetYears,
            portfolio,
            samplingMethod,
            TRIALS_PER_SEARCH_TEST,
          )
        : runBootstrapWithVaryingWeights(
            startingBalance,
            startingBalance * mid,
            targetYears,
            (year) =>
              buildAgeInBondsPortfolio(
                portfolio,
                1 - Math.min(anchorAge + year, 100) / 100,
              ),
            samplingMethod,
            TRIALS_PER_SEARCH_TEST,
          );
    const passes = successRate >= 0.9;
    iterations.push({ iter, lo, hi, mid, successRate, passes });
    if (passes) lo = mid;
    else hi = mid;
  }
  return iterations;
};
