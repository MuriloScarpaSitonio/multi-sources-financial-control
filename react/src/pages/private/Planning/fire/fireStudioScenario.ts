import type { PortfolioSlice } from "../../Home/firePortfolio";
import type { SamplingMethod } from "../../Home/fireReturnTypes";
import type { FireSimulationRequest } from "../../Home/fireSimulation";

export type FireStudioDraft = {
  isReady: boolean;
  showAgeInBonds: boolean;
  currentAge: number | null;
  patrimonyTotal: number;
  simulatedPatrimony: number | null;
  avgExpenses: number;
  expensesOverride: number | null;
  derivedMonthlySavings: number;
  monthlySavingsOverride: number | null;
  withdrawalRate: number;
  targetYears: number;
  samplingMethod: SamplingMethod;
  portfolio: readonly PortfolioSlice[];
};

export type FireStudioSnapshot = {
  request: FireSimulationRequest | null;
  portfolio: readonly PortfolioSlice[];
  patrimonyTotal: number;
  effectivePatrimony: number;
  monthlyExpenses: number;
  monthlySavings: number;
  withdrawalRate: number;
  targetYears: number;
  samplingMethod: SamplingMethod;
  showAgeInBonds: boolean;
  currentAge: number | null;
};

export const buildFireStudioSnapshot = (
  draft: FireStudioDraft,
): FireStudioSnapshot | null => {
  if (!draft.isReady) return null;

  const portfolio = [...draft.portfolio];
  const effectivePatrimony = draft.simulatedPatrimony ?? draft.patrimonyTotal;
  const monthlyExpenses = draft.expensesOverride ?? draft.avgExpenses;
  const monthlySavings =
    draft.monthlySavingsOverride ?? draft.derivedMonthlySavings;
  const annualExpenses = monthlyExpenses * 12;
  const annualSavings = Math.max(0, monthlySavings) * 12;

  const request: FireSimulationRequest | null = draft.showAgeInBonds
    ? draft.currentAge === null
      ? null
      : {
          kind: "age_in_bonds",
          input: {
            currentAge: draft.currentAge,
            targetYears: draft.targetYears,
            portfolio,
            samplingMethod: draft.samplingMethod,
            effectivePatrimony,
            annualExpenses,
            annualSavings,
            withdrawalRate: draft.withdrawalRate,
          },
        }
    : {
        kind: "constant_dollar",
        input: {
          targetYears: draft.targetYears,
          portfolio,
          samplingMethod: draft.samplingMethod,
          annualExpenses,
          withdrawalRate: draft.withdrawalRate,
          patrimonyTotal: draft.patrimonyTotal,
          simulatedPatrimony: draft.simulatedPatrimony,
          annualSavings,
        },
      };

  return {
    request,
    portfolio,
    patrimonyTotal: draft.patrimonyTotal,
    effectivePatrimony,
    monthlyExpenses,
    monthlySavings,
    withdrawalRate: draft.withdrawalRate,
    targetYears: draft.targetYears,
    samplingMethod: draft.samplingMethod,
    showAgeInBonds: draft.showAgeInBonds,
    currentAge: draft.currentAge,
  };
};

export const resubmitFireStudioSnapshot = buildFireStudioSnapshot;
