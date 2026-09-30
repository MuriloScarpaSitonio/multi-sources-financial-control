import { describe, expect, it } from "vitest";
import { findVPWTargets } from "../../Home/vpwTargets";
import { mulberry32 } from "../../Home/fireBootstrap";
import { runVPWRetirement, runVPWSimulation } from "../../Home/vpwSimulation";
import type { SamplingMethod } from "../../Home/fireReturnTypes";
import { DEFAULT_VPW_PREFERENCES } from "../api";
import { buildVPWSnapshot } from "./vpwScenario";
import {
  createVPWExample,
  traceVPWExample,
  prepareVPWPlanTrace,
} from "./vpwWalkthrough";

describe("VPW educational example", () => {
  it("matches the production cash flow for the same historical path", () => {
    const input = createVPWExample(1000000, 5000, 25, "independent_months");
    const trace = traceVPWExample(input, 42);
    const actual = runVPWRetirement({ ...input, numTrials: 1 });
    expect(trace).toHaveLength(300);
    expect(trace[0].balance).toBe(1000000);
    expect(trace[0].payment).toBe(Math.min(trace[0].allowance, 5000));
    expect(trace.at(-1)!.remaining).toBe(1);
    expect(trace.at(-1)!.nextBalance).toBeCloseTo(
      actual.balanceBands.at(-1)!.p50,
      6,
    );
    for (let year = 0; year < 25; year++) {
      const paid = trace
        .slice(year * 12, (year + 1) * 12)
        .reduce((sum, month) => sum + month.payment, 0);
      expect(paid).toBeCloseTo(actual.withdrawalBands[year].p50, 6);
    }
  });
  it("supports block sampling and changing the example without mutating inputs", () => {
    const input = createVPWExample(
      1000000,
      2000,
      10,
      "contiguous_12_month_blocks",
    );
    const original = structuredClone(input);
    const trace = traceVPWExample(input, 42);
    expect(
      trace.every(
        (month) => month.payment <= 2000 && month.payment <= month.balance,
      ),
    ).toBe(true);
    expect(trace).not.toEqual(traceVPWExample(input, 43));
    expect(input).toEqual(original);
  });
});

it("draws the displayed ensemble from the same random stream as production", () => {
  const input = createVPWExample(1000000, 5000, 25, "independent_months");
  const rng = mulberry32(42);
  const paths = Array.from({ length: 3 }, () => traceVPWExample(input, rng));
  const actual = runVPWRetirement({ ...input, numTrials: 3 });
  const finalBalances = paths
    .map((path) => path.at(-1)!.nextBalance)
    .sort((a, b) => a - b);
  expect(actual.balanceBands.at(-1)).toMatchObject({
    p10: finalBalances[0],
    p50: finalBalances[1],
    p90: finalBalances[2],
  });
  const covered = paths.filter((path) =>
    path.every((month) => input.monthlySpending - month.payment <= 0.005),
  ).length;
  expect(actual.successRate).toBe(covered / 3);
});

it("uses 2,000 trials by default for retirement and its capital target", () => {
  const input = createVPWExample(1000000, 5000, 10, "independent_months");
  const retirement = runVPWRetirement(input);
  expect(retirement.trialCount).toBe(2000);
  expect(retirement).toEqual(runVPWRetirement({ ...input, numTrials: 2000 }));
  expect(findVPWTargets(input, 0)).toEqual(
    findVPWTargets({ ...input, numTrials: 2000 }, 0),
  );
});

const planSnapshot = (
  extraYears: number,
  numTrials: number,
  samplingMethod: SamplingMethod = "independent_months",
  monthlySavings = 20000,
) => {
  const snapshot = buildVPWSnapshot({
    isReady: true,
    currentAge: 40,
    avgExpenses: 5000,
    monthlySavings,
    simulatedPatrimony: 100000,
    preferences: {
      ...DEFAULT_VPW_PREFERENCES,
      target_age: 50,
      extra_accumulation_years: extraYears,
      sampling_method: samplingMethod,
    },
    allocation: [
      { category: "BR_EQUITY", series: "IBOV", total: 700000 },
      { category: "FIXED_CDI", series: "CDI", total: 300000 },
    ],
  })!;
  snapshot.request.input.retirement.numTrials = numTrials;
  snapshot.request.input.accumulation.numTrials = numTrials;
  return snapshot;
};

const percentiles = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: sorted[Math.floor(sorted.length * 0.1)],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
  };
};

describe("VPW current-plan trace", () => {
  it("keeps retire-today cash flow identical to the educational trace", () => {
    const snapshot = planSnapshot(0, 3);
    const input = snapshot.request.input;
    const trace = prepareVPWPlanTrace(snapshot);
    const rng = mulberry32(42);
    const exampleRng = mulberry32(42);
    for (let trial = 0; trial < 3; trial++) {
      const rows = trace(rng);
      expect(rows.every((row) => row.phase === "retirement")).toBe(true);
      expect(rows.map(({ phase: _phase, ...row }) => row)).toEqual(
        traceVPWExample(
          {
            ...input.retirement,
            portfolio: input.portfolio,
            samplingMethod: input.samplingMethod,
          },
          exampleRng,
        ),
      );
    }
  });

  it.each([
    [1, "independent_months"],
    [3, "independent_months"],
    [3, "contiguous_12_month_blocks"],
  ] as const)(
    "matches extended production bands for %i trials with %s",
    (numTrials, samplingMethod) => {
      const snapshot = planSnapshot(2, numTrials, samplingMethod);
      const input = snapshot.request.input;
      const original = structuredClone(snapshot);
      const trace = prepareVPWPlanTrace(snapshot);
      const rng = mulberry32(42);
      const paths = Array.from({ length: numTrials }, () => trace(rng));
      const actual = runVPWSimulation(input);
      const starts = paths.flatMap((path) => {
        const first = path.find((row) => row.phase === "retirement");
        return first ? [first] : [];
      });
      expect(starts.length).toBeGreaterThan(0);
      expect(actual.extendedAccumulation).toMatchObject({
        retirementTrialCount: starts.length,
        retirementStartRate: starts.length / numTrials,
        medianYearsToRetirement: percentiles(
          starts.map((row) => (row.month - 1) / 12),
        ).p50,
        medianStartingBalance: percentiles(starts.map((row) => row.balance))
          .p50,
        initialMonthlyIncome: percentiles(starts.map((row) => row.payment!)),
      });
      for (const band of actual.retirement.withdrawalBands) {
        const participants = paths
          .map((path) =>
            path.filter(
              (row) =>
                row.phase === "retirement" &&
                Math.floor((row.month - 1) / 12) === band.year,
            ),
          )
          .filter((rows) => rows.length > 0);
        expect(band).toEqual({
          year: band.year,
          ...percentiles(
            participants.map((rows) =>
              rows.reduce((total, row) => total + row.payment!, 0),
            ),
          ),
        });
        expect(
          actual.retirement.monthlyWithdrawalLimitBands.find(
            (row) => row.year === band.year,
          ),
        ).toEqual({
          year: band.year,
          ...percentiles(participants.map((rows) => rows[0].allowance!)),
        });
      }
      for (const band of actual.retirement.balanceBands) {
        const balances = paths.flatMap((path) => {
          const first = path.find((row) => row.phase === "retirement");
          if (first?.month === band.year * 12 + 1) return [first.balance];
          const last = path.find(
            (row) => row.phase === "retirement" && row.month === band.year * 12,
          );
          return last ? [last.nextBalance] : [];
        });
        expect(band).toEqual({ year: band.year, ...percentiles(balances) });
      }
      const retiredPaths = paths.filter((path) =>
        path.some((row) => row.phase === "retirement"),
      );
      const covered = retiredPaths.filter((path) =>
        path.every(
          (row) =>
            row.payment === null ||
            input.retirement.monthlySpending - row.payment <= 0.005,
        ),
      ).length;
      expect(actual.retirement.successRate).toBe(covered / retiredPaths.length);
      expect(paths[0][0]).toMatchObject({
        phase: "accumulation",
        balance: 100000,
        payment: null,
        allowance: null,
      });
      expect(paths[0][0].nextBalance).toBe(
        (100000 + input.accumulation.monthlySavings) *
          (1 + paths[0][0].monthlyReturn),
      );
      expect(snapshot).toEqual(original);
    },
  );

  it("waits the extra years after a target reached today, without adding a household deficit", () => {
    const snapshot = planSnapshot(2, 1);
    snapshot.request.input.accumulation.monthlySavings = -100;
    snapshot.request.input.retirement.startingBalance = 10000000;
    const rows = prepareVPWPlanTrace(snapshot)(42);
    const actual = runVPWSimulation(snapshot.request.input);
    expect(rows.slice(0, 24).every((row) => row.phase === "accumulation")).toBe(
      true,
    );
    expect(rows[24]).toMatchObject({ month: 25, phase: "retirement" });
    expect(rows[0].nextBalance).toBe(
      rows[0].balance * (1 + rows[0].monthlyReturn),
    );
    expect(actual.extendedAccumulation).toMatchObject({
      medianYearsToRetirement: 2,
      medianStartingBalance: rows[24].balance,
    });
    expect(rows.at(-1)!.nextBalance).toBe(
      actual.retirement.balanceBands.at(-1)!.p50,
    );
  });

  it("stops paths that never reach the target without inventing retirement payments", () => {
    const snapshot = planSnapshot(2, 3, "independent_months", 1);
    snapshot.request.input.retirement.startingBalance = 0;
    const trace = prepareVPWPlanTrace(snapshot);
    const rng = mulberry32(42);
    const paths = Array.from({ length: 3 }, () => trace(rng));
    const actual = runVPWSimulation(snapshot.request.input);
    expect(actual.extendedAccumulation?.retirementTrialCount).toBe(0);
    for (const path of paths) {
      expect(path).toHaveLength(
        (snapshot.years - snapshot.extraYears - 1) * 12,
      );
      expect(
        path.every(
          (row) =>
            row.phase === "accumulation" &&
            row.payment === null &&
            row.allowance === null,
        ),
      ).toBe(true);
    }
    // The unshown remainder still consumes random draws, keeping later trials aligned.
    const fullRng = mulberry32(42);
    const input = snapshot.request.input;
    for (const path of paths) {
      const sampled = traceVPWExample(
        {
          ...input.retirement,
          portfolio: input.portfolio,
          samplingMethod: input.samplingMethod,
        },
        fullRng,
      );
      expect(path.map((row) => row.historicalMonth)).toEqual(
        sampled.slice(0, path.length).map((row) => row.historicalMonth),
      );
    }
  });
});
