import { describe, expect, it } from "vitest";

import { runFireSimulation } from "./fireSimulation";

describe("runFireSimulation", () => {
  it("produces the complete constant-dollar result in one worker job", () => {
    const result = runFireSimulation({
      kind: "constant_dollar",
      input: {
        targetYears: 1,
        portfolio: [
          {
            category: "FIXED_CDI",
            series: "CDI",
            weight: 1,
            constrainsSample: true,
          },
        ],
        samplingMethod: "independent_months",
        annualExpenses: 12_000,
        withdrawalRate: 4,
        patrimonyTotal: 100_000,
        simulatedPatrimony: null,
        annualSavings: 12_000,
      },
    });

    expect(result.kind).toBe("constant_dollar");
    if (result.kind !== "constant_dollar") throw new Error("wrong result kind");
    expect(result.output.targetYears).toBe(1);
    expect(result.output.safeRate).toBeGreaterThan(0);
    expect(result.output.fireTarget).toBe(
      12_000 * result.output.targetMultiplier,
    );
    expect(result.output.patrimonyInputs.scenarioPatrimony).toBe(100_000);
    expect(result.output.bootstrap.bands).toHaveLength(2);
    expect(result.output.accumulation.gapBands).toHaveLength(61);
  });

  it("produces the age-in-bonds result in the worker", () => {
    const result = runFireSimulation({
      kind: "age_in_bonds",
      input: {
        currentAge: 40,
        targetYears: 1,
        portfolio: [
          {
            category: "FIXED_CDI",
            series: "CDI",
            weight: 1,
            constrainsSample: true,
          },
        ],
        samplingMethod: "independent_months",
        effectivePatrimony: 0,
        annualExpenses: 12_000,
        annualSavings: 0,
        withdrawalRate: 4,
      },
    });

    expect(result.kind).toBe("age_in_bonds");
    if (result.kind !== "age_in_bonds") throw new Error("wrong result kind");
    expect(result.output.solverState.status).toBe("unreachable");
    expect(result.output.lifestyleBootstrap.bands).toHaveLength(0);
  });
});

it("keeps zero extension identical to the existing calculation", () => {
  const input = {
    targetYears: 1,
    portfolio: [
      {
        category: "FIXED_CDI",
        series: "CDI",
        weight: 1,
        constrainsSample: true,
      },
    ],
    samplingMethod: "independent_months",
    annualExpenses: 12000,
    withdrawalRate: 4,
    patrimonyTotal: 400000,
    simulatedPatrimony: null,
    annualSavings: 12000,
  } as const;
  expect(
    runFireSimulation({
      kind: "constant_dollar",
      input: { ...input, extraAccumulationYears: 0 },
    }),
  ).toEqual(runFireSimulation({ kind: "constant_dollar", input }));
  const ageInput = { ...input, currentAge: 40, effectivePatrimony: 400000 };
  expect(
    runFireSimulation({
      kind: "age_in_bonds",
      input: { ...ageInput, extraAccumulationYears: 0 },
    }),
  ).toEqual(runFireSimulation({ kind: "age_in_bonds", input: ageInput }));
});

it("uses the projected retirement balances for either strategy", () => {
  const input = {
    targetYears: 1,
    portfolio: [
      {
        category: "FIXED_CDI",
        series: "CDI",
        weight: 1,
        constrainsSample: true,
      },
    ],
    samplingMethod: "independent_months",
    annualExpenses: 12000,
    withdrawalRate: 4,
    patrimonyTotal: 400000,
    simulatedPatrimony: null,
    annualSavings: 12000,
    extraAccumulationYears: 2,
  } as const;
  const result = runFireSimulation({ kind: "constant_dollar", input });
  if (result.kind !== "constant_dollar") throw new Error("wrong strategy");
  expect(result.output.extendedAccumulation?.medianYearsToRetirement).toBe(2);
  expect(result.output.bootstrap.bands[0].p50).toBe(
    result.output.extendedAccumulation?.medianStartingBalance,
  );
  const age = runFireSimulation({
    kind: "age_in_bonds",
    input: { ...input, currentAge: 40, effectivePatrimony: 400000 },
  });
  if (age.kind !== "age_in_bonds") throw new Error("wrong strategy");
  expect(age.output.solverState.anchorAge).toBe(42);
  expect(age.output.lifestyleBootstrap).toEqual(
    age.output.extendedAccumulation?.bootstrap,
  );
});
