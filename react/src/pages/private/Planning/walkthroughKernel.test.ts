import { describe, expect, it } from "vitest";
import {
  findSafeWithdrawalRate,
  findSafeWithdrawalRateWithVaryingWeights,
  runBootstrap,
} from "../Home/fireBootstrap";
import {
  eligibleMonths,
  buildAgeInBondsPortfolio,
} from "../Home/firePortfolio";
import type { FireStudioSnapshot } from "./fire/fireStudioScenario";
import {
  simulateTrial,
  runBinarySearch,
  prepareWalkthrough,
} from "./walkthroughKernel";

const snapshot: FireStudioSnapshot = {
  request: null,
  portfolio: [
    { category: "FIXED_CDI", series: "CDI", weight: 1, constrainsSample: true },
  ],
  patrimonyTotal: 250_000,
  effectivePatrimony: 250_000,
  monthlyExpenses: 2_000,
  monthlySavings: 500,
  withdrawalRate: 3.5,
  targetYears: 10,
  samplingMethod: "independent_months",
  showAgeInBonds: false,
  currentAge: 45,
};

describe("live FIRE methodology matches the production engine", () => {
  for (const samplingMethod of [
    "independent_months",
    "contiguous_12_month_blocks",
  ] as const) {
    it(`matches retirement balances for the selected portfolio with ${samplingMethod}`, () => {
      const input = { ...snapshot, samplingMethod };
      const expected = runBootstrap(
        input.effectivePatrimony,
        input.monthlyExpenses * 12,
        input.targetYears,
        input.portfolio,
        samplingMethod,
        1,
      );
      const trial = simulateTrial(42, prepareWalkthrough(input));
      expect(trial.balances).toEqual(expected.bands.map((band) => band.p50));
      expect(trial.busted).toBe(expected.successRate === 0);
    });
    it(`finds the production safe rate with ${samplingMethod}`, () => {
      const input = { ...snapshot, samplingMethod };
      const iterations = runBinarySearch(prepareWalkthrough(input));
      const last = iterations.at(-1)!;
      expect((last.passes ? last.mid : last.lo) * 100).toBe(
        findSafeWithdrawalRate(
          input.targetYears,
          input.portfolio,
          samplingMethod,
        ),
      );
      expect(iterations).toHaveLength(20);
    });
  }
  it("updates balances and withdrawals from edited patrimony and expenses", () => {
    const original = simulateTrial(42, prepareWalkthrough(snapshot));
    const changed = {
      ...snapshot,
      effectivePatrimony: 550_000,
      monthlyExpenses: 3_000,
      targetYears: 15,
    };
    const trial = simulateTrial(42, prepareWalkthrough(changed));
    expect(trial.balances[0]).toBe(550_000);
    expect(trial.balances).toHaveLength(16);
    expect(trial.balances).not.toEqual(original.balances);
    const expected = runBootstrap(
      550_000,
      36_000,
      15,
      changed.portfolio,
      changed.samplingMethod,
      1,
    );
    expect(trial.balances).toEqual(expected.bands.map((band) => band.p50));
  });
  it("uses selected primary and fallback history in both the deck and returns", () => {
    const input: FireStudioSnapshot = {
      ...snapshot,
      portfolio: [
        {
          category: "FII",
          series: "IFIX",
          fallbackSeries: "IBOV",
          weight: 1,
          constrainsSample: true,
        },
      ],
    };
    const scenario = prepareWalkthrough(input);
    expect(scenario.available).toEqual(eligibleMonths(input.portfolio));
    expect(scenario.available.length).toBeGreaterThan(
      eligibleMonths([{ ...input.portfolio[0], fallbackSeries: undefined }])
        .length,
    );
    const trial = simulateTrial(42, scenario);
    const expected = runBootstrap(
      input.effectivePatrimony,
      input.monthlyExpenses * 12,
      input.targetYears,
      input.portfolio,
      input.samplingMethod,
      1,
    );
    expect(trial.balances).toEqual(expected.bands.map((band) => band.p50));
  });
});

it("uses the production age-in-bonds search at the solved retirement age", () => {
  const input = { ...snapshot, showAgeInBonds: true };
  const iterations = runBinarySearch(prepareWalkthrough(input), 65);
  const last = iterations.at(-1)!;
  expect((last.passes ? last.mid : last.lo) * 100).toBe(
    findSafeWithdrawalRateWithVaryingWeights(
      input.targetYears,
      (year) =>
        buildAgeInBondsPortfolio(
          input.portfolio,
          1 - Math.min(65 + year, 100) / 100,
        ),
      input.samplingMethod,
    ),
  );
});
