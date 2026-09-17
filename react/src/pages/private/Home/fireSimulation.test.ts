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
