import { beforeEach, expect, it, vi } from "vitest";
import {
  traceOneOverNPlan,
  runOneOverNSimulation,
  runOneOverNRetirement,
} from "./oneOverNSimulation";
const fixture = vi.hoisted(() => ({ r: 0, paths: null as number[][] | null }));
vi.mock("./fireBootstrap", async (importOriginal) => {
  const original = await importOriginal<typeof import("./fireBootstrap")>();
  return {
    ...original,
    preparePortfolio: () => {
      let trial = 0;
      return {
        returns: fixture.paths?.flat() ?? [fixture.r],
        sampleMonths: (count: number) =>
          fixture.paths
            ? Array.from({ length: count }, (_, i) => trial * count + i).map(
                (v, i) => {
                  if (i === count - 1) trial++;
                  return v;
                },
              )
            : Array(count).fill(0),
      };
    },
  };
});
beforeEach(() => {
  fixture.r = 0;
  fixture.paths = null;
});
const input = {
  portfolio: [],
  samplingMethod: "independent_months" as const,
  extraAccumulationYears: 0,
  retirement: {
    startingBalance: 600000,
    monthlyExpenses: 1000,
    years: 20,
    numTrials: 5,
  },
  accumulation: { startingBalance: 10000, monthlySavings: -500, years: 19 },
};
it("spends above expenses and reports actual worst-year income", () => {
  const r = runOneOverNSimulation(input);
  expect(r.retirement.minimumMonthlyIncome).toEqual({
    p10: 2500,
    p50: 2500,
    p90: 2500,
  });
  expect(r.retirement.withdrawalBands[0].p50).toBe(2500);
  expect(r.retirement.balanceBands[0].p50).toBe(600000);
  expect(r.retirement.balanceBands.at(-1)?.p50).toBe(0);
});
it("does not turn a deficit into zero contributions", () => {
  const trace = traceOneOverNPlan(
    {
      ...input,
      extraAccumulationYears: 1,
      retirement: { ...input.retirement, startingBalance: 10000 },
    },
    Array(20).fill(1000000),
    Array(240).fill(0),
  );
  expect(trace.accumulationBalances[1]).toBe(4000);
  expect(trace.retirement).toBeNull();
});
it("delayed retirement keeps the depletion age fixed", () => {
  const args = {
    ...input,
    extraAccumulationYears: 3,
    retirement: { ...input.retirement, startingBalance: 600000, years: 50 },
  };
  const targets = Array(50).fill(1000000);
  targets.fill(0, 18);
  const trace = traceOneOverNPlan(args, targets, Array(600).fill(0));
  expect(trace.retirementStartYear).toBe(21);
  expect(trace.retirement?.annualWithdrawals).toHaveLength(29);
  expect(trace.retirement?.balances.at(-1)).toBe(0);
});
it("non-starters do not become successful zero-income retirees", () => {
  const r = runOneOverNSimulation({
    ...input,
    extraAccumulationYears: 19,
    retirement: { ...input.retirement, startingBalance: 0 },
    accumulation: {
      ...input.accumulation,
      startingBalance: 0,
      monthlySavings: 0,
    },
  });
  expect(r.retirement.trialCount).toBe(0);
  expect(r.retirement.successRate).toBeNull();
  expect(r.retirement.minimumMonthlyIncome).toBeNull();
});
it("zero expenses do not cap full withdrawals at zero", () => {
  expect(
    runOneOverNRetirement({
      ...input.retirement,
      monthlyExpenses: 0,
      portfolio: [],
      samplingMethod: "independent_months",
    }).minimumMonthlyIncome?.p50,
  ).toBe(2500);
});
it("monthly contributions earn subsequent monthly returns", () => {
  const args = {
    ...input,
    extraAccumulationYears: 1,
    retirement: { ...input.retirement, startingBalance: 0 },
    accumulation: { ...input.accumulation, monthlySavings: 1000 },
  };
  const trace = traceOneOverNPlan(
    args,
    Array(20).fill(1000000),
    Array(240).fill(0.01),
  );
  expect(trace.accumulationBalances[1]).toBeCloseTo(12809.328043, 5);
});

it("aggregates each trial's worst year before computing income percentiles", () => {
  const r = (growth: number) => Array(12).fill(Math.pow(growth, 1 / 12) - 1);
  fixture.paths = [
    [...r(0.6), ...r(2), ...r(1)],
    [...r(0.9), ...r(0.7), ...r(1)],
  ];
  const result = runOneOverNRetirement({
    startingBalance: 300,
    monthlyExpenses: 4,
    years: 3,
    numTrials: 2,
    portfolio: [],
    samplingMethod: "independent_months",
  });
  expect(result.minimumMonthlyIncome?.p50).toBeCloseTo(5.25, 6);
  expect(result.withdrawalBands[1].p50).toBeCloseTo(7.5, 6);
});
it("zero wealth cannot cover positive expenses", () => {
  const result = runOneOverNRetirement({
    ...input.retirement,
    startingBalance: 0,
    portfolio: [],
    samplingMethod: "independent_months",
  });
  expect(result.successRate).toBe(0);
  expect(result.minimumMonthlyIncome).toEqual({ p10: 0, p50: 0, p90: 0 });
});
