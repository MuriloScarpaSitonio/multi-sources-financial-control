import { describe, expect, it } from "vitest";

import {
  buildFireStudioSnapshot,
  withoutHistoricalFallbacks,
  resubmitFireStudioSnapshot,
  type FireStudioDraft,
} from "./fireStudioScenario";

const baseDraft: FireStudioDraft = {
  isReady: true,
  showAgeInBonds: false,
  currentAge: 40,
  patrimonyTotal: 1_000_000,
  simulatedPatrimony: null,
  avgExpenses: 10_000,
  expensesOverride: null,
  derivedMonthlySavings: 5_000,
  monthlySavingsOverride: null,
  withdrawalRate: 4,
  targetYears: 30,
  samplingMethod: "independent_months",
  portfolio: [],
};

describe("buildFireStudioSnapshot", () => {
  it("builds the existing constant-dollar worker request", () => {
    expect(buildFireStudioSnapshot(baseDraft)?.request).toEqual({
      kind: "constant_dollar",
      input: {
        targetYears: 30,
        portfolio: [],
        samplingMethod: "independent_months",
        annualExpenses: 120_000,
        withdrawalRate: 4,
        patrimonyTotal: 1_000_000,
        simulatedPatrimony: null,
        annualSavings: 60_000,
      },
    });
  });

  it("uses the temporary inputs without changing the current patrimony", () => {
    const snapshot = buildFireStudioSnapshot({
      ...baseDraft,
      simulatedPatrimony: 1_500_000,
      expensesOverride: 12_000,
      monthlySavingsOverride: 7_000,
    });

    expect(snapshot).toMatchObject({
      patrimonyTotal: 1_000_000,
      effectivePatrimony: 1_500_000,
      monthlyExpenses: 12_000,
      monthlySavings: 7_000,
      request: {
        kind: "constant_dollar",
        input: {
          patrimonyTotal: 1_000_000,
          simulatedPatrimony: 1_500_000,
          annualExpenses: 144_000,
          annualSavings: 84_000,
        },
      },
    });
  });

  it("builds the existing age-in-bonds worker request", () => {
    expect(
      buildFireStudioSnapshot({ ...baseDraft, showAgeInBonds: true })?.request,
    ).toEqual({
      kind: "age_in_bonds",
      input: {
        currentAge: 40,
        targetYears: 30,
        portfolio: [],
        samplingMethod: "independent_months",
        effectivePatrimony: 1_000_000,
        annualExpenses: 120_000,
        annualSavings: 60_000,
        withdrawalRate: 4,
      },
    });
  });

  it("keeps an age-in-bonds snapshot without a worker request when birth date is missing", () => {
    const snapshot = buildFireStudioSnapshot({
      ...baseDraft,
      showAgeInBonds: true,
      currentAge: null,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.request).toBeNull();
  });

  it("does not create a snapshot before source data is ready", () => {
    expect(
      buildFireStudioSnapshot({ ...baseDraft, isReady: false }),
    ).toBeNull();
  });

  it("clones the portfolio when the same draft is resubmitted", () => {
    const draft = {
      ...baseDraft,
      portfolio: [
        {
          category: "BR_EQUITY" as const,
          series: "IBOV" as const,
          weight: 1,
          constrainsSample: true,
        },
      ],
    };
    const first = buildFireStudioSnapshot(draft)!;
    const second = resubmitFireStudioSnapshot(draft)!;

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.portfolio).not.toBe(first.portfolio);
  });
});

it.each([false, true])(
  "compares primary-only history without mutating the submitted scenario (age in bonds: %s)",
  (showAgeInBonds) => {
    const original = buildFireStudioSnapshot({
      ...baseDraft,
      showAgeInBonds,
      portfolio: [
        {
          category: "FIXED_IPCA",
          series: "IMA_B_5_PLUS",
          fallbackSeries: "IBOV",
          weight: 1,
          constrainsSample: true,
        },
      ],
    })!;
    const comparison = withoutHistoricalFallbacks(original);
    expect(comparison.portfolio[0]).not.toHaveProperty("fallbackSeries");
    expect(comparison.request?.input.portfolio).toEqual(comparison.portfolio);
    expect(original.portfolio[0].fallbackSeries).toBe("IBOV");
    expect(comparison.effectivePatrimony).toBe(original.effectivePatrimony);
    expect(comparison.samplingMethod).toBe(original.samplingMethod);
  },
);
