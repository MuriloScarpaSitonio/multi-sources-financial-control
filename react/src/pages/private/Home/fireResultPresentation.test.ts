import {
  buildFirePatrimonyInputs,
  buildFireRetirementTimingLabel,
  buildFireScenarioRows,
  buildFireSummary,
  getFireSuccessBand,
} from "./fireResultPresentation";

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
};

const assertClose = (actual: number, expected: number, message: string) => {
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
};

assertEqual(getFireSuccessBand(0.95), "good", "95% success is good");
assertEqual(getFireSuccessBand(0.8), "warn", "80% success is warning");
assertEqual(getFireSuccessBand(0.49), "bad", "49% success is bad");

const patrimonyInputs = buildFirePatrimonyInputs({
  actualPatrimony: 1_700_000,
  simulatedPatrimony: 5_500_000,
  fireTarget: 5_500_000,
});

assertEqual(
  patrimonyInputs.scenarioPatrimony,
  5_500_000,
  "what-if scenario uses slider patrimony",
);
assertEqual(
  patrimonyInputs.accumulationStartingPatrimony,
  1_700_000,
  "retirement timing starts from actual patrimony",
);
assertClose(
  patrimonyInputs.scenarioProgress,
  100,
  "scenario progress can reach target",
);
assertClose(
  patrimonyInputs.accumulationProgress,
  30.90909090909091,
  "accumulation progress ignores slider patrimony",
);

const summary = buildFireSummary({
  patrimony: 1_200_000,
  annualExpenses: 60_000,
  withdrawalRate: 4,
  safeWithdrawalRate: 3.5,
  successRate: 0.87,
  targetYears: 30,
});

assertEqual(summary.band, "warn", "summary uses success band");
assertEqual(summary.failedLabel, "130 de 1000 cenarios falharam", "failure label");
assertClose(summary.safeMonthlySpend, 3_500, "safe monthly spend");
assertClose(summary.chosenMonthlyWithdrawal, 4_000, "chosen monthly withdrawal");
assertClose(summary.monthlyGap, -1_500, "negative gap means expenses exceed safe spend");
if (summary.expenseMultiple === null) {
  throw new Error("expense multiple should be available when expenses are positive");
}
assertClose(summary.expenseMultiple, 20, "expense multiple");

const rows = buildFireScenarioRows([
  { year: 0, p10: 1_000_000, p50: 1_000_000, p90: 1_000_000 },
  { year: 30, p10: 100_000, p50: 900_000, p90: 2_000_000 },
]);

assertEqual(rows.length, 3, "three scenario rows");
assertEqual(rows[0].label, "Pessimista", "p10 row label");
assertEqual(rows[1].label, "Mediano", "p50 row label");
assertEqual(rows[2].label, "Otimista", "p90 row label");
assertEqual(rows[0].value, 100_000, "p10 row value");
assertEqual(rows[2].value, 2_000_000, "p90 row value");

assertEqual(
  buildFireRetirementTimingLabel({
    fireProgress: 120,
    medianYearsToTarget: 0,
    p10YearsToTarget: 0,
    p90YearsToTarget: 0,
  }),
  "Pode se aposentar hoje",
  "already-at-target retirement label",
);

assertEqual(
  buildFireRetirementTimingLabel({
    fireProgress: 42,
    medianYearsToTarget: 8,
    p10YearsToTarget: 5,
    p90YearsToTarget: 13,
  }),
  "Mediana ate a meta: 8 anos",
  "median retirement timing label",
);

assertEqual(
  buildFireRetirementTimingLabel({
    fireProgress: 42,
    medianYearsToTarget: null,
    p10YearsToTarget: null,
    p90YearsToTarget: null,
  }),
  "Meta distante no ritmo atual",
  "unreachable retirement timing label",
);
