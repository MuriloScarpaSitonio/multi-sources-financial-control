import { mulberry32, preparePortfolio } from "../../Home/fireBootstrap";
import { eligibleMonths, type PortfolioSlice } from "../../Home/firePortfolio";
import type { SamplingMethod } from "../../Home/fireReturnTypes";
import { vpwMonthlyRates } from "../../Home/vpwMath";
import type { VPWRetirementInput } from "../../Home/vpwSimulation";
import { findVPWTargets } from "../../Home/vpwTargets";
import { VPW_SCENARIO_ERRORS } from "../../Home/vpwErrors";
import { compoundedAnnualGrowth, type VPWSnapshot } from "./vpwScenario";

export const VPW_EXAMPLE_PORTFOLIO: readonly PortfolioSlice[] = [
  {
    category: "BR_EQUITY",
    series: "IBOV",
    weight: 0.7,
    constrainsSample: true,
  },
  { category: "FIXED_CDI", series: "CDI", weight: 0.3, constrainsSample: true },
];
export const VPW_EXAMPLE_MONTHS = eligibleMonths(VPW_EXAMPLE_PORTFOLIO);
export const createVPWExample = (
  startingBalance: number,
  monthlySpending: number,
  years: number,
  samplingMethod: SamplingMethod,
): VPWRetirementInput => ({
  startingBalance,
  monthlySpending,
  years,
  samplingMethod,
  portfolio: VPW_EXAMPLE_PORTFOLIO,
  annualGrowth: compoundedAnnualGrowth(
    preparePortfolio(VPW_EXAMPLE_PORTFOLIO, samplingMethod).returns,
  ),
});

// Expose the monthly arithmetic for teaching; sampling and rates come from production.
const prepareRetirementTrace = (input: VPWRetirementInput) => {
  const prepared = preparePortfolio(input.portfolio, input.samplingMethod);
  const months = eligibleMonths(input.portfolio);
  const rates = vpwMonthlyRates(input.annualGrowth, input.years * 12);
  return (seed: number | (() => number)) => {
    const sampled = prepared.sampleMonths(
      rates.length,
      typeof seed === "number" ? mulberry32(seed) : seed,
    );
    let balance = input.startingBalance;
    return sampled.map((index, month) => {
      const allowance = Math.min(balance * rates[month], balance);
      const payment = Math.min(allowance, input.monthlySpending);
      const monthlyReturn = prepared.returns[index];
      const nextBalance = Math.max(
        0,
        (balance - payment) * (1 + monthlyReturn),
      );
      const row = {
        month: month + 1,
        historicalMonth: months[index],
        remaining: rates.length - month,
        balance,
        rate: rates[month],
        allowance,
        payment,
        monthlyReturn,
        nextBalance,
      };
      balance = nextBalance;
      return row;
    });
  };
};

export const traceVPWExample = (
  input: VPWRetirementInput,
  seed: number | (() => number),
) => prepareRetirementTrace(input)(seed);

export type VPWPlanTraceRow = Omit<
  ReturnType<typeof traceVPWExample>[number],
  "allowance" | "payment"
> & {
  allowance: number | null;
  payment: number | null;
  phase: "accumulation" | "retirement" | "not_started";
};

// Prepare once for a displayed ensemble, then consume one full production path
// per call, even when the trial never reaches its retirement target.
export const prepareVPWPlanTrace = (snapshot: VPWSnapshot) => {
  const input = snapshot.request.input;
  const retirement = {
    ...input.retirement,
    portfolio: input.portfolio,
    samplingMethod: input.samplingMethod,
  };
  const extraYears = input.extraAccumulationYears ?? 0;
  if (extraYears === 0) {
    const trace = prepareRetirementTrace(retirement);
    return (seed: number | (() => number)): VPWPlanTraceRow[] =>
      trace(seed).map((row) => ({ ...row, phase: "retirement" }));
  }
  const targets = findVPWTargets(
    retirement,
    input.accumulation.monthlySavings > 0 ? input.accumulation.years : 0,
  );
  if (
    input.accumulation.monthlySavings <= 0 &&
    retirement.startingBalance < targets[0]
  ) {
    throw new Error(VPW_SCENARIO_ERRORS.contributionsRequired);
  }
  const rates = vpwMonthlyRates(retirement.annualGrowth, retirement.years * 12);
  const prepared = preparePortfolio(input.portfolio, input.samplingMethod);
  const months = eligibleMonths(input.portfolio);
  const savings = Math.max(0, input.accumulation.monthlySavings);
  const lastReachYear = Math.min(
    targets.length - 1,
    retirement.years - extraYears - 1,
  );
  return (seed: number | (() => number)): VPWPlanTraceRow[] => {
    const sampled = prepared.sampleMonths(
      rates.length,
      typeof seed === "number" ? mulberry32(seed) : seed,
    );
    let balance = retirement.startingBalance;
    let reached: number | null = balance >= targets[0] ? 0 : null;
    let retired = false;
    const rows: VPWPlanTraceRow[] = [];
    for (let year = 0; year < retirement.years; year++) {
      if (reached === null && year <= lastReachYear && balance >= targets[year])
        reached = year;
      if (reached === null && year >= lastReachYear) break;
      if (reached !== null && year === reached + extraYears) retired = true;
      for (let month = year * 12; month < (year + 1) * 12; month++) {
        const allowance = retired
          ? Math.min(balance * rates[month], balance)
          : null;
        const payment =
          allowance === null
            ? null
            : Math.min(allowance, retirement.monthlySpending);
        const monthlyReturn = prepared.returns[sampled[month]];
        const nextBalance = Math.max(
          0,
          (payment === null ? balance + savings : balance - payment) *
            (1 + monthlyReturn),
        );
        rows.push({
          month: month + 1,
          historicalMonth: months[sampled[month]],
          remaining: rates.length - month,
          balance,
          rate: rates[month],
          allowance,
          payment,
          monthlyReturn,
          nextBalance,
          phase: retired ? "retirement" : "accumulation",
        });
        balance = nextBalance;
      }
    }
    return rows;
  };
};
