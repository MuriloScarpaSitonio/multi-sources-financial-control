import { describe, expect, it } from "vitest";

import {
  findSafeWithdrawalRate,
  findSafeWithdrawalRateWithVaryingWeights,
  runAccumulationBootstrap,
  runBootstrap,
  runBootstrapWithVaryingWeights,
  sampleMonthKeys,
} from "./fireBootstrap";
import { buildAgeInBondsPortfolio, type PortfolioSlice } from "./firePortfolio";
import { FIRE_RETURN_SERIES } from "./fireReturns";
import type { SamplingMethod } from "./fireReturnTypes";

const portfolio: readonly PortfolioSlice[] = [
  {
    category: "BR_EQUITY",
    series: "IBOV",
    weight: 0.6,
    constrainsSample: true,
  },
  { category: "FII", series: "IFIX", weight: 0.1, constrainsSample: true },
  { category: "FIXED_CDI", series: "CDI", weight: 0.3, constrainsSample: true },
];
const withExclusions: readonly PortfolioSlice[] = [
  { category: "FII", series: "IFIX", weight: 0.5, constrainsSample: true },
  { category: "CRYPTO", series: "CASH", weight: 0.3, constrainsSample: false },
  { category: "CASH", series: "CASH", weight: 0.2, constrainsSample: false },
];
const methods: readonly SamplingMethod[] = [
  "independent_months",
  "contiguous_12_month_blocks",
];

// Snapshots were captured from af77f0c before the performance correction.
// All financial values are compared exactly; keep the production trial counts.
describe.each(methods)("FIRE deterministic outputs: %s", (method) => {
  it("preserves all chart values and RNG consumption after depletion", () => {
    expect(
      runBootstrap(100_000, 80_000, 4, portfolio, method),
    ).toMatchSnapshot();
  });

  it("preserves cash, exclusions, bond fallback, and changing yearly windows", () => {
    expect(
      runBootstrapWithVaryingWeights(
        100_000,
        40_000,
        4,
        (year) => buildAgeInBondsPortfolio(withExclusions, (2 - year) / 100),
        method,
      ),
    ).toMatchSnapshot();
  });

  it("preserves accumulation after early target crossing", () => {
    expect(
      runAccumulationBootstrap({
        startingBalance: 100_000,
        annualContribution: 12_000,
        target: 160_000,
        portfolio: withExclusions,
        samplingMethod: method,
        maxYears: 8,
      }),
    ).toMatchSnapshot();
  });

  it("preserves the full 20-iteration safe-rate search", () => {
    expect(findSafeWithdrawalRate(45, portfolio, method)).toMatchSnapshot();
  }, 30_000);

  it("preserves the varying-allocation safe-rate search", () => {
    const cashHeavyPortfolio: readonly PortfolioSlice[] = [
      {
        category: "CRYPTO",
        series: "CMBI10",
        weight: 0.06,
        constrainsSample: true,
      },
      {
        category: "FIXED_CDI",
        series: "CDI",
        weight: 0.04,
        constrainsSample: true,
      },
      {
        category: "CASH",
        series: "CASH",
        weight: 0.9,
        constrainsSample: false,
      },
    ];
    expect(
      findSafeWithdrawalRateWithVaryingWeights(
        10,
        (year) =>
          buildAgeInBondsPortfolio(cashHeavyPortfolio, 0.6 - year / 100),
        method,
      ),
    ).toMatchSnapshot();
  }, 60_000);
});

// Count real historical-data work without retaining millions of mock calls or
// depending on machine speed. Reintroducing per-trial preparation makes this
// work scale with numTrials, even though the historical inputs have not changed.
const countHistoryWork = (run: () => void) => {
  const returnsDescriptor = Object.getOwnPropertyDescriptor(
    FIRE_RETURN_SERIES.CDI,
    "realReturns",
  )!;
  const splitDescriptor = Object.getOwnPropertyDescriptor(
    String.prototype,
    "split",
  )!;
  const returns = FIRE_RETURN_SERIES.CDI.realReturns;
  let returnReads = 0;
  let dateParses = 0;
  Object.defineProperty(FIRE_RETURN_SERIES.CDI, "realReturns", {
    configurable: true,
    enumerable: true,
    get: () => {
      returnReads += 1;
      return returns;
    },
  });
  Object.defineProperty(String.prototype, "split", {
    ...splitDescriptor,
    value: function (this: string, ...args: unknown[]) {
      if (args[0] === "-") dateParses += 1;
      return Reflect.apply(splitDescriptor.value, this, args);
    },
  });
  try {
    run();
  } finally {
    Object.defineProperty(
      FIRE_RETURN_SERIES.CDI,
      "realReturns",
      returnsDescriptor,
    );
    Object.defineProperty(String.prototype, "split", splitDescriptor);
  }
  return { returnReads, dateParses };
};

describe.each(methods)("FIRE preparation cost: %s", (method) => {
  it.each([false, true])(
    "does not grow with trial count (varying=%s)",
    (varying) => {
      const work = (numTrials: number) =>
        countHistoryWork(() => {
          if (varying) {
            runBootstrapWithVaryingWeights(
              1_000_000,
              1,
              2,
              () => portfolio,
              method,
              numTrials,
            );
          } else {
            runBootstrap(1_000_000, 1, 2, portfolio, method, numTrials);
          }
        });
      const normal = work(2000);
      expect(normal.returnReads).toBeGreaterThan(0);
      if (method === "contiguous_12_month_blocks")
        expect(normal.dateParses).toBeGreaterThan(0);
      expect(work(4000)).toEqual(normal);
    },
    30_000,
  );
});

describe("historical block boundaries", () => {
  const months = [
    ...Array.from(
      { length: 12 },
      (_, i) => `2000-${String(i + 1).padStart(2, "0")}`,
    ),
    ...Array.from(
      { length: 12 },
      (_, i) => `2002-${String(i + 1).padStart(2, "0")}`,
    ),
  ];

  it("skips gaps, keeps block order, and consumes the truncated last block draw", () => {
    let draws = 0;
    const actual = sampleMonthKeys({
      eligible: months,
      method: "contiguous_12_month_blocks",
      count: 13,
      rng: () => (draws++ === 0 ? 0.99 : 0),
    });
    expect(actual).toEqual([...months.slice(12), "2000-01"]);
    expect(draws).toBe(2);
  });

  it("retains empty-count and incomplete-history behavior", () => {
    expect(
      sampleMonthKeys({
        eligible: [],
        method: "contiguous_12_month_blocks",
        count: 0,
        rng: () => 0,
      }),
    ).toEqual([]);
    expect(() =>
      sampleMonthKeys({
        eligible: [],
        method: "independent_months",
        count: 1,
        rng: () => 0,
      }),
    ).toThrow("No aligned historical months");
    expect(() =>
      sampleMonthKeys({
        eligible: months.slice(0, 11),
        method: "contiguous_12_month_blocks",
        count: 12,
        rng: () => 0,
      }),
    ).toThrow("No complete 12-month historical block");
  });
});
