import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { findVPWTargets } from "./vpwTargets";
import { FIRE_RETURN_SERIES } from "./fireReturns";
import type { PortfolioSlice } from "./firePortfolio";
import {
  runVPWAccumulation,
  runVPWSimulation,
  runVPWRetirement,
  type VPWRetirementInput,
} from "./vpwSimulation";

const originalIbov = FIRE_RETURN_SERIES.IBOV;
const originalSpy = FIRE_RETURN_SERIES.SPY;
const months = Array.from(
  { length: 24 },
  (_, i) =>
    `${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
);
// Month keys are stable for the entire process, respecting FIRE's index cache.
beforeEach(() => {
  FIRE_RETURN_SERIES.IBOV = {
    ...originalIbov,
    months,
    realReturns: Array(24).fill(0),
  };
  FIRE_RETURN_SERIES.SPY = {
    ...originalSpy,
    months,
    realReturns: Array(24).fill(0),
  };
});
after(() => {
  FIRE_RETURN_SERIES.IBOV = originalIbov;
  FIRE_RETURN_SERIES.SPY = originalSpy;
});
const portfolio: PortfolioSlice[] = [
  { category: "BR_EQUITY", series: "IBOV", weight: 1, constrainsSample: true },
];
const input: VPWRetirementInput = {
  startingBalance: 120000,
  monthlySpending: 10000,
  years: 10,
  annualGrowth: 0,
  portfolio,
  samplingMethod: "independent_months",
  numTrials: 3,
};
const close = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );

test("zero growth pays positive level income and has no synthetic income endpoint", () => {
  const result = runVPWRetirement(input);
  assert.equal(result.withdrawalBands.length, 10);
  assert.equal(result.balanceBands.length, 11);
  for (const band of result.withdrawalBands) close(band.p50 / 12, 1000);
  close(result.balanceBands[10].p50, 0);
  close(result.minimumMonthlyIncome.p50, 1000);
});

test("steady 5% monthly returns preserve the monthly allowance over twenty years", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = Array(24).fill(
    Math.pow(1.05, 1 / 12) - 1,
  );
  const result = runVPWRetirement({
    ...input,
    startingBalance: 100000,
    years: 20,
    annualGrowth: 0.05,
  });
  for (const band of result.withdrawalBands) close(band.p50 / 12, 651.18, 0.01);
  close(result.balanceBands[20].p50, 0);
  close(result.minimumMonthlyIncome.p50, 651.18, 0.01);
});

test("spending is a required ceiling and unused capital remains invested", () => {
  const result = runVPWRetirement({ ...input, monthlySpending: 500 });
  for (const band of result.withdrawalBands) close(band.p50 / 12, 500);
  close(result.balanceBands[10].p50, 60000);
  close(result.minimumMonthlyIncome.p50, 500);
});

test("the final year keeps earning returns on funds not yet withdrawn", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = Array(24).fill(
    Math.pow(1.05, 1 / 12) - 1,
  );
  const result = runVPWRetirement({
    ...input,
    startingBalance: 100000,
    years: 1,
    annualGrowth: 0.05,
  });
  assert.ok(result.withdrawalBands[0].p50 > 100000);
  close(result.balanceBands[1].p50, 0);
});

test("each monthly loss changes the following payment, not only the next year", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = Array(24).fill(-0.5);
  const result = runVPWRetirement({
    ...input,
    startingBalance: 12000,
    years: 1,
  });
  // Payments are 1000, 500, 250, ... through month 12.
  close(result.withdrawalBands[0].p50, 1999.51171875);
  close(result.balanceBands[1].p50, 0);
});

test("percentiles use each retirement minimum before combining trials", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = [
    ...Array(12).fill(-0.1),
    ...Array(12).fill(0.1),
  ];
  const result = runVPWRetirement({
    ...input,
    startingBalance: 36000,
    years: 3,
    samplingMethod: "contiguous_12_month_blocks",
  });
  // Independently calculated cash flows for seed42's block starts (zero based):
  // [7,5,11], [8,2,6], [3,8,11]. Minima occur in different years.
  close(result.minimumMonthlyIncome.p10, 434.44121724306916);
  close(result.minimumMonthlyIncome.p50, 470.19664442281754);
  close(result.minimumMonthlyIncome.p90, 780.2769146032773);
  close(
    Math.min(...result.withdrawalBands.map((band) => band.p50 / 12)),
    780.2769146032773,
  );
});

test("genuine zero income after depletion remains part of the minimum", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = Array(24).fill(-1);
  const result = runVPWRetirement(input);
  assert.deepEqual(result.minimumMonthlyIncome, { p10: 0, p50: 0, p90: 0 });
  close(result.withdrawalBands[0].p50, 1000);
  close(result.withdrawalBands[1].p50, 0);
  const empty = runVPWRetirement({ ...input, startingBalance: 0 });
  assert.equal(empty.withdrawalBands.length, 10);
  assert.deepEqual(empty.minimumMonthlyIncome, { p10: 0, p50: 0, p90: 0 });
});

test("US assets use SPY history instead of the Brazilian-equity series", () => {
  FIRE_RETURN_SERIES.SPY.realReturns = Array(24).fill(0.01);
  const br = runVPWRetirement({ ...input, years: 1, monthlySpending: 0 });
  const us = runVPWRetirement({
    ...input,
    years: 1,
    monthlySpending: 0,
    portfolio: [
      {
        category: "US_EQUITY",
        series: "SPY",
        weight: 1,
        constrainsSample: true,
      },
    ],
  });
  close(br.balanceBands[1].p50, 120000);
  close(us.balanceBands[1].p50, 135219.0036158364);
});

test("both FIRE sampling methods are deterministic and produce different paths", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = [
    ...Array(12).fill(-0.1),
    ...Array(12).fill(0.1),
  ];
  const independent = runVPWRetirement(input);
  const blockInput = {
    ...input,
    samplingMethod: "contiguous_12_month_blocks" as const,
  };
  const blocks = runVPWRetirement(blockInput);
  assert.deepEqual(runVPWRetirement(input), independent);
  assert.deepEqual(runVPWRetirement(blockInput), blocks);
  assert.notDeepEqual(blocks, independent);
});

test("invalid simulation amounts, horizons and trial counts are rejected", () => {
  for (const field of ["startingBalance", "monthlySpending"] as const) {
    for (const value of [-1, NaN, Infinity])
      assert.throws(() => runVPWRetirement({ ...input, [field]: value }));
  }
  for (const field of ["years", "numTrials"] as const) {
    for (const value of [0, -1, 1.5, NaN, Infinity])
      assert.throws(() => runVPWRetirement({ ...input, [field]: value }));
  }
});

const accumulationInput = {
  startingBalance: 12000,
  monthlySavings: 1000,
  targets: [36000, 36000, 36000, 36000],
  portfolio,
  samplingMethod: "independent_months" as const,
  numTrials: 3,
};

test("nonpositive savings suppress timing without modeling portfolio sales", () => {
  for (const monthlySavings of [0, -1000]) {
    assert.equal(
      runVPWAccumulation({ ...accumulationInput, monthlySavings }),
      null,
    );
  }
});

test("accumulation reaches the target from actual initial capital and savings", () => {
  const result = runVPWAccumulation(accumulationInput)!;
  assert.equal(result.successRate, 1);
  assert.equal(result.medianYearsToTarget, 2);
  assert.equal(result.p10YearsToTarget, 2);
  assert.equal(result.p90YearsToTarget, 2);
  assert.deepEqual(
    result.gapBands.map((band) => band.p50),
    [24000, 12000, 0, 0],
  );
});

test("year-specific targets determine crossing and current coverage reaches year zero", () => {
  const changing = runVPWAccumulation({
    ...accumulationInput,
    startingBalance: 0,
    targets: [24000, 18000, 12000],
  })!;
  assert.equal(changing.medianYearsToTarget, 2);
  assert.deepEqual(
    changing.gapBands.map((band) => band.p50),
    [24000, 6000, 0],
  );
  const alreadyCovered = runVPWAccumulation({
    ...accumulationInput,
    startingBalance: 36000,
  })!;
  assert.equal(alreadyCovered.medianYearsToTarget, 0);
  assert.equal(alreadyCovered.successRate, 1);
});

test("unreached targets retain the actual simulation length and no invented dates", () => {
  const result = runVPWAccumulation({
    ...accumulationInput,
    targets: [100000, 100000, 100000],
  })!;
  assert.equal(result.successRate, 0);
  assert.equal(result.medianYearsToTarget, null);
  assert.equal(result.p10YearsToTarget, null);
  assert.equal(result.p90YearsToTarget, null);
  assert.deepEqual(
    result.gapBands.map((band) => band.p50),
    [88000, 76000, 64000],
  );
});

test("monthly contributions earn that month return before the next contribution", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = Array(24).fill(1);
  const result = runVPWAccumulation({
    ...accumulationInput,
    startingBalance: 0,
    monthlySavings: 1,
    targets: [10000, 10000],
  })!;
  close(result.gapBands[1].p50, 1810);
});

test("timing excludes failed trials while the reach fraction still includes them", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = [
    ...Array(12).fill(-1),
    ...Array(12).fill(1),
  ];
  const fixture = {
    ...accumulationInput,
    startingBalance: 0,
    monthlySavings: 1,
    targets: [3, 3],
    numTrials: 100,
  };
  const result = runVPWAccumulation(fixture)!;
  assert.ok(result.successRate > 0 && result.successRate < 0.9);
  assert.equal(result.medianYearsToTarget, 1);
  assert.equal(result.p10YearsToTarget, 1);
  assert.equal(result.p90YearsToTarget, 1);
  assert.deepEqual(runVPWAccumulation(fixture), result);
});

test("accumulation rejects invalid targets and non-finite cash flows", () => {
  for (const targets of [[], [NaN], [-1], [Infinity]]) {
    assert.throws(() => runVPWAccumulation({ ...accumulationInput, targets }));
  }
  for (const monthlySavings of [NaN, Infinity])
    assert.throws(() =>
      runVPWAccumulation({ ...accumulationInput, monthlySavings }),
    );
  assert.throws(() =>
    runVPWAccumulation({ ...accumulationInput, startingBalance: -1 }),
  );
  assert.throws(() =>
    runVPWAccumulation({ ...accumulationInput, numTrials: 0 }),
  );
});

const extendedInput = (extraAccumulationYears: number) => ({
  portfolio,
  samplingMethod: "independent_months" as const,
  extraAccumulationYears,
  retirement: { ...input, startingBalance: 120000, monthlySpending: 1000 },
  accumulation: {
    startingBalance: 120000,
    monthlySavings: 1000,
    years: 9,
    numTrials: 3,
  },
});
test("zero extra years preserves both existing calculations exactly", () => {
  const job = extendedInput(0);
  const result = runVPWSimulation(job);
  assert.deepEqual(result.retirement, runVPWRetirement(job.retirement));
  assert.deepEqual(
    result.accumulation,
    runVPWAccumulation({
      ...job.accumulation,
      targets: Array.from({ length: 10 }, (_, y) => (10 - y) * 12000),
      portfolio,
      samplingMethod: job.samplingMethod,
    }),
  );
});
test("extra years contribute after reaching the target and shorten retirement to the same end age", () => {
  const result = runVPWSimulation(extendedInput(2));
  assert.equal(result.extendedAccumulation?.medianYearsToRetirement, 2);
  assert.equal(result.extendedAccumulation?.medianStartingBalance, 144000);
  assert.equal(result.extendedAccumulation?.retirementStartRate, 1);
  assert.equal(result.retirement.withdrawalBands.length, 8);
  assert.equal(result.retirement.withdrawalBands[0].year, 2);
  assert.equal(result.retirement.balanceBands.at(-1)?.year, 10);
  close(result.retirement.balanceBands.at(-1)!.p50, 48000);
  close(result.retirement.minimumMonthlyIncome.p50, 1000);
});
test("the extra period starts at the actual target crossing in each trial", () => {
  const job = extendedInput(2);
  job.retirement.startingBalance = 0;
  const result = runVPWSimulation(job);
  assert.equal(result.extendedAccumulation?.medianYearsToRetirement, 7);
  assert.equal(result.extendedAccumulation?.medianStartingBalance, 84000);
  assert.equal(result.retirement.withdrawalBands.length, 3);
  close(result.retirement.balanceBands.at(-1)!.p50, 48000);
});
test("trials unable to finish accumulation before target age have no retirement income observations", () => {
  const job = extendedInput(9);
  job.retirement.startingBalance = 0;
  const result = runVPWSimulation(job);
  assert.equal(result.extendedAccumulation?.retirementStartRate, 0);
  assert.equal(result.extendedAccumulation?.medianYearsToRetirement, null);
  assert.equal(result.extendedAccumulation?.initialMonthlyIncome, null);
  assert.deepEqual(result.retirement.withdrawalBands, []);
});
test("extra accumulation does not assume negative savings are funded by selling assets", () => {
  const job = extendedInput(2);
  job.accumulation.monthlySavings = -1000;
  const result = runVPWSimulation(job);
  assert.equal(result.extendedAccumulation?.medianStartingBalance, 120000);
  close(result.retirement.balanceBands.at(-1)!.p50, 24000);
});
test("extra accumulation is deterministic with either sampler and retains trial variation", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = Array.from({ length: 24 }, (_, i) =>
    i % 2 ? 0.03 : -0.02,
  );
  for (const samplingMethod of [
    "independent_months",
    "contiguous_12_month_blocks",
  ] as const) {
    const job = { ...extendedInput(2), samplingMethod };
    const result = runVPWSimulation(job);
    assert.deepEqual(result, runVPWSimulation(job));
    assert.ok(
      result.retirement.balanceBands[0].p90 >=
        result.retirement.balanceBands[0].p10,
    );
    assert.ok(
      result.retirement.withdrawalBands.every((b) => b.p90 <= 12000.00001),
    );
  }
});

test("extra years cannot forecast target timing without positive savings below the target", () => {
  for (const monthlySavings of [0, -1000]) {
    const job = extendedInput(2);
    job.retirement.startingBalance = 36000;
    job.accumulation.monthlySavings = monthlySavings;
    assert.throws(() => runVPWSimulation(job), /aporte mensal positivo/i);
  }
});

test("retirement success requires covering spending in every month", () => {
  const covered = runVPWRetirement({ ...input, monthlySpending: 1000 });
  assert.equal(covered.successRate, 1);
  assert.equal(covered.trialCount, 3);
  const shortfall = runVPWRetirement({ ...input, monthlySpending: 1001 });
  assert.equal(shortfall.successRate, 0);
  // A small first-month shortfall is diluted in the annual average but must fail.
  FIRE_RETURN_SERIES.IBOV.realReturns = Array(24).fill(0.01);
  const monthlyShortfall = runVPWRetirement({
    ...input,
    monthlySpending: 1000.02,
  });
  assert.ok(monthlyShortfall.minimumMonthlyIncome.p10 > 1000.015);
  assert.equal(monthlyShortfall.successRate, 0);
});

test("safe spending finds the budget independently of the requested spending cap", () => {
  for (const monthlySpending of [0, 500, 2000]) {
    const result = runVPWRetirement({ ...input, monthlySpending });
    close(result.safeMonthlySpending!, 1000, 0.01);
  }
  const empty = runVPWRetirement({ ...input, startingBalance: 0 });
  assert.equal(empty.safeMonthlySpending, 0);
  assert.equal(empty.successRate, 0);
  assert.equal(
    runVPWRetirement({ ...input, startingBalance: 0, monthlySpending: 0 })
      .successRate,
    1,
  );
});

test("safe spending passes ninety percent of the same sampled retirement paths", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = [
    ...Array(12).fill(-0.1),
    ...Array(12).fill(0.1),
  ];
  for (const samplingMethod of [
    "independent_months",
    "contiguous_12_month_blocks",
  ] as const) {
    const fixture = { ...input, years: 3, numTrials: 20, samplingMethod };
    const result = runVPWRetirement(fixture);
    assert.ok(Number.isFinite(result.safeMonthlySpending));
    const safe = result.safeMonthlySpending!;
    assert.ok(safe > 0);
    assert.ok(
      runVPWRetirement({ ...fixture, monthlySpending: safe }).successRate! >=
        0.9,
    );
    assert.ok(
      runVPWRetirement({ ...fixture, monthlySpending: safe + 0.02 })
        .successRate! < 0.9,
    );
  }
});

test("extra accumulation measures spending over each participating retirement", () => {
  const result = runVPWSimulation(extendedInput(2));
  assert.equal(result.retirement.successRate, 1);
  assert.equal(result.retirement.trialCount, 3);
  // 144,000 at retirement / 96 remaining months, with zero returns.
  close(result.retirement.safeMonthlySpending!, 1500, 0.01);
});

test("no retirement trials means no spending probability or safe spending estimate", () => {
  const job = extendedInput(9);
  job.retirement.startingBalance = 0;
  const result = runVPWSimulation(job);
  assert.equal(result.retirement.trialCount, 0);
  assert.equal(result.retirement.successRate, null);
  assert.equal(result.retirement.safeMonthlySpending, null);
});

test("extended spending statistics exclude trials that never start retirement", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = Array.from({ length: 24 }, (_, i) =>
    i % 2 ? 0.01 : -0.01,
  );
  const job = {
    portfolio,
    samplingMethod: "independent_months" as const,
    extraAccumulationYears: 1,
    retirement: {
      startingBalance: 0,
      monthlySpending: 500,
      years: 3,
      annualGrowth: 0,
      numTrials: 100,
    },
    accumulation: {
      startingBalance: 0,
      monthlySavings: 1000,
      years: 2,
      numTrials: 100,
    },
  };
  const result = runVPWSimulation(job);
  assert.ok(
    result.retirement.trialCount > 0 && result.retirement.trialCount < 100,
  );
  assert.equal(
    result.retirement.trialCount,
    result.extendedAccumulation!.retirementTrialCount,
  );
  assert.equal(
    result.extendedAccumulation!.retirementStartRate,
    result.retirement.trialCount / 100,
  );
  assert.equal(result.retirement.successRate, 1);
  assert.ok(
    result.retirement.safeMonthlySpending! >= job.retirement.monthlySpending,
  );
});

test("the VPW target funds every month in at least 95 percent of retirement trials", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = [
    ...Array(12).fill(-0.1),
    ...Array(12).fill(0.1),
  ];
  for (const samplingMethod of [
    "independent_months",
    "contiguous_12_month_blocks",
  ] as const) {
    const fixture = {
      ...input,
      monthlySpending: 1000,
      years: 3,
      numTrials: 20,
      samplingMethod,
    };
    const targets = findVPWTargets(fixture, 2);
    for (let year = 0; year < targets.length; year++) {
      const retirement = {
        ...fixture,
        years: 3 - year,
        startingBalance: targets[year],
      };
      assert.ok(runVPWRetirement(retirement).successRate! >= 0.95);
      assert.ok(
        runVPWRetirement({
          ...retirement,
          startingBalance: targets[year] * 0.999,
        }).successRate! < 0.95,
      );
    }
  }
});

test("the full simulation replaces first-withdrawal targets with the 95 percent target", () => {
  const job = {
    ...extendedInput(0),
    retirement: {
      ...extendedInput(0).retirement,
      annualGrowth: 0.3,
      startingBalance: 80000,
    },
    accumulation: {
      startingBalance: 80000,
      monthlySavings: 1000,
      years: 9,
      numTrials: 3,
    },
  };
  const result = runVPWSimulation(job);
  // Optimistic assumed growth does not fund actual zero-return monthly payments.
  close(result.targetPatrimony, 120000, 0.01);
  assert.equal(result.retirement.successRate, 0);
  assert.equal(result.accumulation!.medianYearsToTarget, 2);
  close(result.accumulation!.gapBands[0].p50, 40000, 0.01);
  const atTarget = runVPWSimulation({
    ...job,
    retirement: { ...job.retirement, startingBalance: result.targetPatrimony },
  });
  assert.equal(atTarget.retirement.successRate, 1);
  assert.equal(atTarget.targetPatrimony, result.targetPatrimony);
});

test("extra accumulation waits until the 95 percent target is reached", () => {
  const job = {
    ...extendedInput(1),
    retirement: {
      ...extendedInput(1).retirement,
      annualGrowth: 0.3,
      startingBalance: 80000,
    },
    accumulation: {
      startingBalance: 80000,
      monthlySavings: 1000,
      years: 9,
      numTrials: 3,
    },
  };
  const result = runVPWSimulation(job);
  // At year two: 104,000 > 96,000. One extra year means retiring at year three.
  assert.equal(result.extendedAccumulation!.medianYearsToRetirement, 3);
  assert.equal(result.extendedAccumulation!.medianStartingBalance, 116000);
});

test("zero spending has zero VPW target and invalid target horizons are rejected", () => {
  assert.deepEqual(
    findVPWTargets({ ...input, monthlySpending: 0 }, 2),
    [0, 0, 0],
  );
  assert.throws(() => findVPWTargets(input, 10));
  assert.throws(() => findVPWTargets({ ...input, monthlySpending: -1 }, 2));
});

test("wealth above the initial-withdrawal target but below 95 percent requires positive contributions", () => {
  const job = {
    ...extendedInput(1),
    retirement: {
      ...extendedInput(1).retirement,
      annualGrowth: 0.3,
      startingBalance: 80000,
    },
    accumulation: {
      startingBalance: 80000,
      monthlySavings: 0,
      years: 9,
      numTrials: 3,
    },
  };
  assert.throws(() => runVPWSimulation(job), /aporte mensal positivo.*95%/);
});

test("sustainable spending scenarios are independent of the requested spending cap", () => {
  const low = runVPWRetirement({ ...input, monthlySpending: 500 });
  const high = runVPWRetirement({ ...input, monthlySpending: 2000 });
  assert.deepEqual(low.sustainableMonthlySpending, {
    p10: 1000,
    p50: 1000,
    p90: 1000,
  });
  assert.deepEqual(
    high.sustainableMonthlySpending,
    low.sustainableMonthlySpending,
  );
  close(low.minimumMonthlyIncome.p50, 500);
  assert.equal(low.sustainableMonthlySpending!.p10, low.safeMonthlySpending);
});

test("sustainable spending scenarios use the same paths at 90, 50 and 10 percent coverage", () => {
  FIRE_RETURN_SERIES.IBOV.realReturns = months.map((_, i) =>
    i % 3 === 0 ? -0.1 : 0.04,
  );
  const fixture = { ...input, years: 2, numTrials: 41, monthlySpending: 100 };
  const result = runVPWRetirement(fixture);
  const amounts = result.sustainableMonthlySpending!;
  assert.ok(amounts.p10 < amounts.p50 && amounts.p50 < amounts.p90);
  for (const [key, coverage] of [
    ["p10", 0.9],
    ["p50", 0.5],
    ["p90", 0.1],
  ] as const) {
    assert.ok(
      runVPWRetirement({ ...fixture, monthlySpending: amounts[key] })
        .successRate! >= coverage,
    );
    assert.ok(
      runVPWRetirement({ ...fixture, monthlySpending: amounts[key] + 0.01 })
        .successRate! < coverage,
    );
  }
});

test("extended sustainable spending reveals headroom above the withdrawal cap", () => {
  const result = runVPWSimulation(extendedInput(2));
  assert.deepEqual(result.retirement.sustainableMonthlySpending, {
    p10: 1500,
    p50: 1500,
    p90: 1500,
  });
  close(result.retirement.minimumMonthlyIncome.p50, 1000);
  const job = extendedInput(9);
  job.retirement.startingBalance = 0;
  assert.equal(
    runVPWSimulation(job).retirement.sustainableMonthlySpending,
    null,
  );
});

test("the withdrawal limit uses each year's starting balance before the expense cap", () => {
  const result = runVPWRetirement({ ...input, monthlySpending: 500 });
  assert.equal(result.monthlyWithdrawalLimitBands.length, 10);
  close(result.monthlyWithdrawalLimitBands[0].p50, 1000);
  // Actual withdrawals remain 500/month: after one year 114,000 funds 108 months.
  close(result.monthlyWithdrawalLimitBands[1].p50, 114000 / 108);
  close(result.monthlyWithdrawalLimitBands[9].p50, 66000 / 12);
  close(result.withdrawalBands[0].p50 / 12, 500);
  close(result.balanceBands[10].p50, 60000);
});

test("extra accumulation records withdrawal limits only from retirement onward", () => {
  const result = runVPWSimulation(extendedInput(2));
  const limits = result.retirement.monthlyWithdrawalLimitBands;
  assert.equal(limits.length, 8);
  assert.equal(limits[0].year, 2);
  close(limits[0].p50, 144000 / 96);
  close(limits[1].p50, 132000 / 84);
  assert.equal(limits.at(-1)!.year, 9);
  close(result.retirement.withdrawalBands[0].p50 / 12, 1000);
  const job = extendedInput(9);
  job.retirement.startingBalance = 0;
  assert.deepEqual(
    runVPWSimulation(job).retirement.monthlyWithdrawalLimitBands,
    [],
  );
});
