import type { VPWPlanningPreferences } from "../api";
import type { FireAllocationBucket } from "../fireAllocation";
import { buildVPWPortfolio } from "../../Home/vpwPortfolio";
import { eligibleMonths, returnForMonth } from "../../Home/firePortfolio";
import { vpwMonthlyRate, vpwTarget } from "../../Home/vpwMath";
import type { VPWSimulationRequest } from "../../Home/fireSimulation";

export const compoundedAnnualGrowth = (
  monthlyReturns: readonly number[],
): number => {
  if (
    !monthlyReturns.length ||
    monthlyReturns.some((r) => !Number.isFinite(r) || r <= -1)
  ) {
    throw new Error(
      "Histórico indisponível para calcular o crescimento da carteira.",
    );
  }
  return Math.expm1(
    (monthlyReturns.reduce((sum, r) => sum + Math.log1p(r), 0) * 12) /
      monthlyReturns.length,
  );
};

export const ageFromBirthDate = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (!Number.isFinite(birth.getTime())) return null;
  const today = new Date();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate());
  return today.getFullYear() - birth.getFullYear() - Number(beforeBirthday);
};

export type VPWDraft = {
  isReady: boolean;
  currentAge: number | null;
  allocation: readonly FireAllocationBucket[];
  preferences: Required<VPWPlanningPreferences>;
  simulatedPatrimony: number | null;
  avgExpenses: number;
  monthlySavings: number;
};

export const buildVPWSnapshot = (draft: VPWDraft) => {
  if (!draft.isReady || draft.currentAge === null) return null;
  const targetAge = draft.preferences.target_age;
  const years = targetAge - draft.currentAge;
  if (!Number.isSafeInteger(years) || years <= 0 || targetAge > 105) {
    throw new Error(
      draft.currentAge >= 105
        ? "A simulação tem limite de 105 anos."
        : "Escolha uma idade alvo maior que sua idade atual, até 105 anos.",
    );
  }
  const extraYears = draft.preferences.extra_accumulation_years ?? 0;
  if (
    !Number.isSafeInteger(extraYears) ||
    extraYears < 0 ||
    extraYears > 60 ||
    extraYears >= years
  ) {
    throw new Error(
      "Escolha anos extras de acumulação entre 0 e 60, menores que o prazo até a idade alvo.",
    );
  }
  const modeled = buildVPWPortfolio(draft.allocation, draft.preferences);
  const historyMonths = eligibleMonths(modeled.portfolio);
  const annualGrowth = compoundedAnnualGrowth(
    historyMonths.map((month) =>
      modeled.portfolio.reduce(
        (sum, slice) => sum + slice.weight * returnForMonth(slice, month),
        0,
      ),
    ),
  );
  const monthlyExpenses =
    draft.preferences.monthly_expenses_override ?? draft.avgExpenses;
  const monthlySavings =
    draft.preferences.monthly_savings_override ?? draft.monthlySavings;
  const patrimony = draft.simulatedPatrimony ?? modeled.investmentTotal;
  if (
    ![patrimony, monthlyExpenses].every((v) => Number.isFinite(v) && v >= 0) ||
    !Number.isFinite(monthlySavings)
  ) {
    throw new Error("Informe valores válidos para o cenário.");
  }
  const monthlyRate = vpwMonthlyRate(annualGrowth, years * 12);
  const allowance = Math.min(patrimony * monthlyRate, patrimony);
  const monthlyWithdrawal = Math.min(allowance, monthlyExpenses);
  const initialWithdrawalTarget = vpwTarget(
    monthlyExpenses,
    annualGrowth,
    years * 12,
  );
  if (
    extraYears > 0 &&
    monthlySavings <= 0 &&
    patrimony < initialWithdrawalTarget
  ) {
    throw new Error(
      "Informe um aporte mensal positivo para estimar quando atingir a meta e simular os anos extras de acumulação.",
    );
  }
  const accumulationYears = Math.min(80, years - 1);
  const request: VPWSimulationRequest = {
    kind: "vpw",
    input: {
      extraAccumulationYears: extraYears,
      portfolio: modeled.portfolio,
      samplingMethod: draft.preferences.sampling_method,
      retirement: {
        startingBalance: patrimony,
        monthlySpending: monthlyExpenses,
        years,
        annualGrowth,
      },
      accumulation: {
        startingBalance: modeled.investmentTotal,
        monthlySavings,
        years: accumulationYears,
      },
    },
  };
  return {
    request,
    extraYears,
    portfolio: modeled.portfolio,
    historyMonths,
    annualGrowth,
    patrimony,
    actualPatrimony: modeled.investmentTotal,
    monthlyExpenses,
    monthlySavings,
    allowance,
    monthlyWithdrawal,
    initialWithdrawalTarget,
    coverage:
      monthlyExpenses > 0 ? (monthlyWithdrawal / monthlyExpenses) * 100 : 0,
    stockPct: modeled.stockPct,
    currentAge: draft.currentAge,
    targetAge,
    years,
    accumulationYears,
    monthlyRate,
  };
};
export type VPWSnapshot = NonNullable<ReturnType<typeof buildVPWSnapshot>>;

export const withoutVPWHistoricalFallbacks = (
  snapshot: VPWSnapshot,
): VPWSnapshot => {
  const portfolio = snapshot.portfolio.map((slice) => {
    const primary = { ...slice };
    delete primary.fallbackSeries;
    return primary;
  });
  const historyMonths = eligibleMonths(portfolio);
  const annualGrowth = compoundedAnnualGrowth(
    historyMonths.map((month) =>
      portfolio.reduce(
        (sum, slice) => sum + slice.weight * returnForMonth(slice, month),
        0,
      ),
    ),
  );
  const monthlyRate = vpwMonthlyRate(annualGrowth, snapshot.years * 12);
  const allowance = Math.min(
    snapshot.patrimony * monthlyRate,
    snapshot.patrimony,
  );
  const monthlyWithdrawal = Math.min(allowance, snapshot.monthlyExpenses);
  return {
    ...snapshot,
    portfolio,
    historyMonths,
    annualGrowth,
    monthlyRate,
    allowance,
    monthlyWithdrawal,
    initialWithdrawalTarget: vpwTarget(
      snapshot.monthlyExpenses,
      annualGrowth,
      snapshot.years * 12,
    ),
    coverage:
      snapshot.monthlyExpenses > 0
        ? (monthlyWithdrawal / snapshot.monthlyExpenses) * 100
        : 0,
    request: {
      ...snapshot.request,
      input: {
        ...snapshot.request.input,
        portfolio,
        retirement: { ...snapshot.request.input.retirement, annualGrowth },
      },
    },
  };
};
