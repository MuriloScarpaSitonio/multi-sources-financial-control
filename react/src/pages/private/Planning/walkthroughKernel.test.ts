import { describe, expect, it } from "vitest";
import { findSafeWithdrawalRate, runBootstrap } from "../Home/fireBootstrap";
import type { PortfolioSlice } from "../Home/firePortfolio";
import { simulateTrial, runBinarySearch } from "./walkthroughKernel";

const portfolio: PortfolioSlice[] = [
  {
    category: "BR_EQUITY",
    series: "IBOV",
    weight: 0.7,
    constrainsSample: true,
  },
  { category: "FIXED_CDI", series: "CDI", weight: 0.3, constrainsSample: true },
];

describe("methodology example matches the production engine", () => {
  for (const method of [
    "independent_months",
    "contiguous_12_month_blocks",
  ] as const) {
    it(`matches monthly retirement balances with ${method}`, () => {
      const expected = runBootstrap(
        1_000_000,
        40_000,
        30,
        portfolio,
        method,
        1,
      );
      const trial = simulateTrial(0.04, 42, 30, method);
      expect(trial.balances).toEqual(expected.bands.map((band) => band.p50));
      expect(trial.busted).toBe(expected.successRate === 0);
    });
    it(`finds the production safe rate with ${method}`, () => {
      const iterations = runBinarySearch(20, method);
      const last = iterations.at(-1)!;
      expect((last.passes ? last.mid : last.lo) * 100).toBe(
        findSafeWithdrawalRate(20, portfolio, method),
      );
      expect(iterations).toHaveLength(20);
    });
  }
});
