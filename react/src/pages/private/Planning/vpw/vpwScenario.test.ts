import { describe, expect, it } from "vitest";
import { DEFAULT_VPW_PREFERENCES } from "../api";
import {
  compoundedAnnualGrowth,
  buildVPWSnapshot,
  withoutVPWHistoricalFallbacks,
} from "./vpwScenario";
import { eligibleMonths, returnForMonth } from "../../Home/firePortfolio";

const draft = {
  isReady: true,
  currentAge: 40,
  avgExpenses: 5000,
  monthlySavings: 1000,
  simulatedPatrimony: null,
  preferences: { ...DEFAULT_VPW_PREFERENCES, target_age: 60 },
  allocation: [
    { category: "FIXED_CDI" as const, series: "CDI" as const, total: 100000 },
    { category: "CASH" as const, series: "CASH" as const, total: 900000 },
  ],
};
describe("VPW historical growth and scenario", () => {
  it("counts a round trip as zero, not the arithmetic average", () => {
    expect(compoundedAnnualGrowth([1, -0.5])).toBeCloseTo(0, 12);
    expect(
      compoundedAnnualGrowth(Array(24).fill(Math.pow(1.1, 1 / 12) - 1)),
    ).toBeCloseTo(0.1, 12);
    expect(compoundedAnnualGrowth(Array(12).fill(-0.01))).toBeCloseTo(
      Math.pow(0.99, 12) - 1,
      12,
    );
  });
  it("rejects unavailable or invalid history", () => {
    expect(() => compoundedAnnualGrowth([])).toThrow();
    expect(() => compoundedAnnualGrowth([-1])).toThrow();
  });
  it("uses the selected portfolio history and excludes bank cash", () => {
    const s = buildVPWSnapshot(draft)!;
    const months = eligibleMonths(s.portfolio);
    const returns = months.map((month) =>
      s.portfolio.reduce(
        (sum, slice) => sum + slice.weight * returnForMonth(slice, month),
        0,
      ),
    );
    expect(s.annualGrowth).toBeCloseTo(compoundedAnnualGrowth(returns), 12);
    expect(s.actualPatrimony).toBe(1000000);
    expect(s.historyMonths).toEqual(months);
  });
  it("caps withdrawals and leaves actual wealth in accumulation when simulating wealth", () => {
    const s = buildVPWSnapshot({ ...draft, simulatedPatrimony: 10000000 })!;
    expect(s.monthlyWithdrawal).toBe(5000);
    expect(s.request.input.retirement.startingBalance).toBe(10000000);
    expect(s.request.input.accumulation.startingBalance).toBe(1000000);
    expect(s.request.input.accumulation.years).toBe(19);
    expect(s.accumulationYears).toBe(19);
  });
  it("supports zero expenses and uses saved expense and savings overrides", () => {
    const s = buildVPWSnapshot({
      ...draft,
      preferences: {
        ...draft.preferences,
        monthly_expenses_override: 0,
        monthly_savings_override: 0,
      },
    })!;
    expect(s.monthlyWithdrawal).toBe(0);
    expect(s.initialWithdrawalTarget).toBe(0);
    expect(s.request.input.accumulation.monthlySavings).toBe(0);
  });
  it("waits for loading and missing birth date, and rejects invalid target ages", () => {
    expect(buildVPWSnapshot({ ...draft, isReady: false })).toBeNull();
    expect(buildVPWSnapshot({ ...draft, currentAge: null })).toBeNull();
    expect(() =>
      buildVPWSnapshot({
        ...draft,
        preferences: { ...draft.preferences, target_age: 40 },
      }),
    ).toThrow(/idade/i);
  });
});

it("passes extra years to the worker while preserving the selected end age", () => {
  const s = buildVPWSnapshot({
    ...draft,
    preferences: { ...draft.preferences, extra_accumulation_years: 3 },
  })!;
  expect(s.request.input.extraAccumulationYears).toBe(3);
  expect(s.request.input.retirement.years).toBe(20);
  expect(() =>
    buildVPWSnapshot({
      ...draft,
      preferences: { ...draft.preferences, extra_accumulation_years: 20 },
    }),
  ).toThrow(/extras/i);
});

it("explains the positive-contribution requirement before submitting extra accumulation", () => {
  expect(() =>
    buildVPWSnapshot({
      ...draft,
      monthlySavings: 0,
      preferences: { ...draft.preferences, extra_accumulation_years: 2 },
    }),
  ).toThrow(/aporte mensal positivo/i);
  expect(() =>
    buildVPWSnapshot({
      ...draft,
      monthlySavings: 0,
      simulatedPatrimony: 10000000,
      preferences: { ...draft.preferences, extra_accumulation_years: 2 },
    }),
  ).not.toThrow();
});

it("rebuilds the submitted scenario using only primary history without mutating it", () => {
  const input = {
    ...draft,
    allocation: [
      {
        category: "FIXED_IPCA" as const,
        series: "IMA_B_5_PLUS" as const,
        total: 100000,
      },
    ],
    preferences: {
      ...draft.preferences,
      historical_series_fallbacks: {
        "FIXED_IPCA:IMA_B_5_PLUS": "IBOV" as const,
      },
    },
  };
  const baseline = buildVPWSnapshot(input)!;
  const original = structuredClone(baseline);
  const comparison = withoutVPWHistoricalFallbacks(baseline);
  const expected = buildVPWSnapshot({
    ...input,
    preferences: { ...input.preferences, historical_series_fallbacks: {} },
  });
  expect(comparison).toEqual(expected);
  expect(comparison.historyMonths.length).toBeLessThan(
    baseline.historyMonths.length,
  );
  expect(comparison.annualGrowth).not.toBe(baseline.annualGrowth);
  expect(baseline).toEqual(original);
});
