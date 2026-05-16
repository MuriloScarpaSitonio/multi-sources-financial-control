import type { BootstrapBand } from "./fireBootstrap";

export type FireSuccessBand = "good" | "warn" | "bad";

export type FireSummaryInput = {
  patrimony: number;
  annualExpenses: number;
  withdrawalRate: number;
  safeWithdrawalRate: number;
  successRate: number;
  targetYears: number;
  trialCount?: number;
};

export type FireSummary = {
  band: FireSuccessBand;
  verdict: string;
  failedLabel: string;
  safeMonthlySpend: number;
  chosenMonthlyWithdrawal: number;
  monthlyGap: number;
  expenseMultiple: number | null;
};

export type FireScenarioRow = {
  key: "p10" | "p50" | "p90";
  label: string;
  value: number;
  meaning: string;
  tone: FireSuccessBand;
};

export type FireRetirementTimingInput = {
  fireProgress: number;
  medianYearsToTarget: number | null;
  p10YearsToTarget: number | null;
  p90YearsToTarget: number | null;
};

export type FirePatrimonyInput = {
  actualPatrimony: number;
  simulatedPatrimony: number | null;
  fireTarget: number;
};

export type FirePatrimonyInputs = {
  scenarioPatrimony: number;
  accumulationStartingPatrimony: number;
  scenarioProgress: number;
  accumulationProgress: number;
};

export const getFireSuccessBand = (successRate: number): FireSuccessBand => {
  if (successRate >= 0.95) return "good";
  if (successRate >= 0.8) return "warn";
  return "bad";
};

export const buildFirePatrimonyInputs = ({
  actualPatrimony,
  simulatedPatrimony,
  fireTarget,
}: FirePatrimonyInput): FirePatrimonyInputs => {
  const scenarioPatrimony = simulatedPatrimony ?? actualPatrimony;
  const progressFor = (value: number) =>
    fireTarget > 0 ? (value / fireTarget) * 100 : 0;

  return {
    scenarioPatrimony,
    accumulationStartingPatrimony: actualPatrimony,
    scenarioProgress: progressFor(scenarioPatrimony),
    accumulationProgress: progressFor(actualPatrimony),
  };
};

export const buildFireSummary = ({
  patrimony,
  annualExpenses,
  withdrawalRate,
  safeWithdrawalRate,
  successRate,
  targetYears,
  trialCount = 1000,
}: FireSummaryInput): FireSummary => {
  const failedCount = Math.round((1 - successRate) * trialCount);
  const band = getFireSuccessBand(successRate);
  const safeMonthlySpend = (patrimony * (safeWithdrawalRate / 100)) / 12;
  const chosenMonthlyWithdrawal = (patrimony * (withdrawalRate / 100)) / 12;
  const monthlyExpenses = annualExpenses / 12;

  return {
    band,
    verdict:
      band === "good"
        ? "Plano historicamente robusto"
        : band === "warn"
          ? "Plano exige cautela"
          : "Plano historicamente fragil",
    failedLabel:
      failedCount === 0
        ? "nenhum cenario falhou"
        : `${failedCount} de ${trialCount} cenarios falharam`,
    safeMonthlySpend,
    chosenMonthlyWithdrawal,
    monthlyGap: safeMonthlySpend - monthlyExpenses,
    expenseMultiple: annualExpenses > 0 ? patrimony / annualExpenses : null,
  };
};

export const buildFireScenarioRows = (
  bands: readonly BootstrapBand[],
): FireScenarioRow[] => {
  const last = bands[bands.length - 1];
  if (!last) return [];

  return [
    {
      key: "p10",
      label: "Pessimista",
      value: last.p10,
      meaning: "Em 90% das simulacoes, o patrimonio final fica acima disso.",
      tone: "bad",
    },
    {
      key: "p50",
      label: "Mediano",
      value: last.p50,
      meaning: "Metade das simulacoes termina acima, metade abaixo.",
      tone: "warn",
    },
    {
      key: "p90",
      label: "Otimista",
      value: last.p90,
      meaning: "Apenas 10% das simulacoes terminam acima disso.",
      tone: "good",
    },
  ];
};

export const buildFireRetirementTimingLabel = ({
  fireProgress,
  medianYearsToTarget,
}: FireRetirementTimingInput): string => {
  if (fireProgress >= 100) return "Pode se aposentar hoje";
  if (medianYearsToTarget === null) return "Meta distante no ritmo atual";
  return `Mediana ate a meta: ${medianYearsToTarget} anos`;
};
