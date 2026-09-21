import { afterEach, expect, it, vi } from "vitest";
import * as portfolioModule from "./firePortfolio";
import { runExtendedAccumulationBootstrap } from "./fireBootstrap";
const portfolio = [
  { category: "BR_EQUITY", series: "IBOV", weight: 1, constrainsSample: true },
] as const;
afterEach(() => vi.restoreAllMocks());
const params = {
  startingBalance: 100,
  annualContribution: 120,
  target: 200,
  portfolio,
  extraYears: 2,
  annualWithdrawal: 12,
  horizon: 3,
  numTrials: 20,
};
it("continues monthly contributions after year-end target crossing, then only withdraws", () => {
  vi.spyOn(portfolioModule, "returnForMonth").mockReturnValue(0);
  const result = runExtendedAccumulationBootstrap(params);
  expect(result.medianYearsToRetirement).toBe(3);
  expect(result.medianStartingBalance).toBe(460);
  expect(result.retirementStartRate).toBe(1);
  expect(result.bootstrap.bands.map((b) => b.p50)).toEqual([
    460, 448, 436, 424,
  ]);
});
it("waits only the extra years when the target is already met", () => {
  vi.spyOn(portfolioModule, "returnForMonth").mockReturnValue(0);
  const result = runExtendedAccumulationBootstrap({
    ...params,
    startingBalance: 200,
  });
  expect(result.medianYearsToRetirement).toBe(2);
  expect(result.medianStartingBalance).toBe(440);
});
it("reports unreachable retirement instead of fabricating a starting balance", () => {
  vi.spyOn(portfolioModule, "returnForMonth").mockReturnValue(0);
  const result = runExtendedAccumulationBootstrap({
    ...params,
    annualContribution: 0,
  });
  expect(result.retirementStartRate).toBe(0);
  expect(result.medianYearsToRetirement).toBeNull();
  expect(result.bootstrap.bands).toEqual([]);
});
it("applies returns during the extra years and offsets retirement allocations", () => {
  vi.spyOn(portfolioModule, "returnForMonth").mockReturnValue(0.01);
  const retirementPortfolioAt = vi.fn(() => portfolio);
  const result = runExtendedAccumulationBootstrap({
    ...params,
    startingBalance: 200,
    annualContribution: 0,
    retirementPortfolioAt,
  });
  expect(result.medianStartingBalance).toBeCloseTo(200 * 1.01 ** 24, 8);
  expect(retirementPortfolioAt).toHaveBeenCalledWith(2, 0);
  expect(retirementPortfolioAt).toHaveBeenCalledWith(2, 2);
});
it.each(["independent_months", "contiguous_12_month_blocks"] as const)(
  "is deterministic with %s",
  (samplingMethod) => {
    expect(
      runExtendedAccumulationBootstrap({ ...params, samplingMethod }),
    ).toEqual(runExtendedAccumulationBootstrap({ ...params, samplingMethod }));
  },
);

it("does not count wealth exhausted during the extra years as a successful retirement", () => {
  vi.spyOn(portfolioModule, "returnForMonth").mockReturnValue(-1);
  const result = runExtendedAccumulationBootstrap({
    ...params,
    startingBalance: 200,
    annualContribution: 0,
  });
  expect(result.retirementStartRate).toBe(1);
  expect(result.bootstrap.successRate).toBe(0);
  expect(result.bootstrap.medianDepletionYear).toBe(0);
});
