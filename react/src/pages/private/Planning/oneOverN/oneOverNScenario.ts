import type { OneOverNPlanningPreferences } from "../api";
import type { FireAllocationBucket } from "../fireAllocation";
import {
  buildPortfolio,
  eligibleMonths,
  type PortfolioSlice,
} from "../../Home/firePortfolio";
import { preparePortfolio } from "../../Home/fireBootstrap";
import type { OneOverNSimulationRequest } from "../../Home/fireSimulation";
export type OneOverNDraft = {
  isReady: boolean;
  currentAge: number | null;
  allocation: readonly FireAllocationBucket[];
  preferences: Required<OneOverNPlanningPreferences>;
  simulatedPatrimony: number | null;
  avgExpenses: number;
  monthlySavings: number;
};
export const buildOneOverNSnapshot = (draft: OneOverNDraft) => {
  if (!draft.isReady || draft.currentAge === null) return null;
  const p = draft.preferences,
    targetAge = p.target_depletion_age,
    years = targetAge - draft.currentAge,
    extraYears = p.extra_accumulation_years;
  if (
    !Number.isSafeInteger(years) ||
    years <= 0 ||
    targetAge < 70 ||
    targetAge > 105
  )
    throw new Error(
      draft.currentAge >= 105
        ? "A simulação tem limite de 105 anos."
        : "Escolha uma idade alvo maior que sua idade atual, entre 70 e 105 anos.",
    );
  if (
    !Number.isSafeInteger(extraYears) ||
    extraYears < 0 ||
    extraYears > 60 ||
    extraYears >= years
  )
    throw new Error(
      "Escolha anos extras de acumulação entre 0 e 60, menores que o prazo até a idade alvo.",
    );
  const allocation = draft.allocation.filter((b) => b.total > 0);
  const actualPatrimony = allocation.reduce((s, b) => s + b.total, 0);
  const modeledAllocation: readonly FireAllocationBucket[] = allocation.length
    ? allocation
    : [
        { category: "BR_EQUITY", series: "IBOV", total: 0.6 },
        { category: "FIXED_CDI", series: "CDI", total: 0.4 },
      ];
  const portfolio = buildPortfolio(modeledAllocation, p);
  const historyMonths = eligibleMonths(portfolio);
  preparePortfolio(portfolio, p.sampling_method).sampleMonths(12, () => 0.5);
  const patrimony = draft.simulatedPatrimony ?? actualPatrimony,
    monthlyExpenses = p.monthly_expenses_override ?? draft.avgExpenses,
    monthlySavings = p.monthly_savings_override ?? draft.monthlySavings;
  if (
    ![patrimony, monthlyExpenses].every((v) => Number.isFinite(v) && v >= 0) ||
    !Number.isFinite(monthlySavings)
  )
    throw new Error("Informe valores válidos para o cenário.");
  const request: OneOverNSimulationRequest = {
    kind: "one_over_n",
    input: {
      portfolio,
      samplingMethod: p.sampling_method,
      extraAccumulationYears: extraYears,
      retirement: { startingBalance: patrimony, monthlyExpenses, years },
      accumulation: {
        startingBalance: actualPatrimony,
        monthlySavings,
        years: years - 1,
      },
    },
  };
  return {
    request,
    portfolio,
    modeledAllocation,
    historyMonths,
    actualPatrimony,
    patrimony,
    monthlyExpenses,
    monthlySavings,
    currentAge: draft.currentAge,
    targetAge,
    years,
    extraYears,
    initialMonthlyIncome: patrimony / years / 12,
  };
};
export type OneOverNSnapshot = NonNullable<
  ReturnType<typeof buildOneOverNSnapshot>
>;
export const withoutOneOverNHistoricalFallbacks = (
  snapshot: OneOverNSnapshot,
): OneOverNSnapshot => {
  const portfolio: PortfolioSlice[] = snapshot.portfolio.map((slice) => {
    const primary = { ...slice };
    delete primary.fallbackSeries;
    return primary;
  });
  preparePortfolio(
    portfolio,
    snapshot.request.input.samplingMethod,
  ).sampleMonths(12, () => 0.5);
  return {
    ...snapshot,
    portfolio,
    historyMonths: eligibleMonths(portfolio),
    request: {
      ...snapshot.request,
      input: { ...snapshot.request.input, portfolio },
    },
  };
};
