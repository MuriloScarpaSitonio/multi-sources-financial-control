import { useMemo, useState } from "react";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import SvgIcon from "@mui/material/SvgIcon";
import { useNavigate } from "react-router-dom";

import { startOfMonth } from "date-fns";

import { Indicator } from "../components";
import {
  Colors,
  InvestmentUpIcon,
} from "../../../design-system";
import { useBankAccountsSummary } from "../Expenses/hooks";
import { useAssetsIndicators } from "../Assets/Indicators/hooks";
import AssetPercentageChangeSecondaryIndicator from "../Assets/Indicators/PercentageChangeSecondaryIndicator";
import RoiSecondaryIndicator from "../Assets/Indicators/RoiSecondaryIndicator";
import { useHomeExpensesIndicators } from "../Expenses/Indicators/hooks";
import { customEndOfMonth, formatCurrency } from "../utils";
import ExpensePercentageChangeSecondaryIndicator from "../Expenses/Indicators/PercentageChangeSecondaryIndicator";
import { useRevenuesIndicators } from "../Revenues/hooks/useRevenuesIndicators";
import ExpenseRevenuesRatioLinearProgress from "../Expenses/Indicators/ExpenseRevenuesRatioLinearProgress";
import { useHideValues } from "../../../hooks/useHideValues";
import { useIncomesAvg } from "../Incomes/Indicators/hooks";
import { useAssetsReports } from "../Assets/Reports/AssetAggregationReports/hooks";
import { GroupBy, Kinds } from "../Assets/Reports/types";
import type { ReportAggregatedByTypeDataItem } from "../Assets/Reports/types";
import {
  usePlanningPreferences,
  useSelectedMethod,
} from "../Planning/hooks";
import {
  getDividendsOnlyPlanningPreferences,
  getFirePlanningPreferences,
  getOneOverNPlanningPreferences,
  getVPWPlanningPreferences,
} from "../Planning/api";
import DividendsOnlyIndicator from "./DividendsOnlyIndicator";
import ConstantDollarIndicator from "./ConstantDollarIndicator";
import GalenoIndicator from "./GalenoIndicator";
import OneOverNIndicator from "./OneOverNIndicator";
import AgeInBondsIndicator from "./AgeInBondsIndicator";
import ConstantDollarAgeInBondsIndicator from "./ConstantDollarAgeInBondsIndicator";
import VPWIndicator from "./VPWIndicator";

const Indicators = () => {
  const { hideValues } = useHideValues();
  const navigate = useNavigate();
  const [galenoTransferRate, setGalenoTransferRate] = useState(6);
  const [galenoTargetBufferYears, setGalenoTargetBufferYears] = useState(7);
  const [ageInBondsWithdrawalRate, setAgeInBondsWithdrawalRate] = useState(4);
  const [ageInBondsStockReturn, setAgeInBondsStockReturn] = useState(5);
  const [ageInBondsBondReturn, setAgeInBondsBondReturn] = useState(3);
  const { selectedMethod } = useSelectedMethod();
  const { data: planningData } = usePlanningPreferences();
  const preferences = planningData?.preferences;
  const firePreferences = getFirePlanningPreferences(preferences);
  const dividendsOnlyPreferences = getDividendsOnlyPlanningPreferences(preferences);
  const oneOverNPreferences = getOneOverNPlanningPreferences(preferences);
  const vpwPreferences = getVPWPlanningPreferences(preferences);
  const dateOfBirth = planningData?.dateOfBirth ?? null;
  // Galeno parked while we redesign it as a standalone strategy — see
  // docs/superpowers/plans/2026-04-26-galeno-strategy.md. Re-enable by
  // restoring the previous expression.
  const showGaleno = false;
  const showAgeInBonds = preferences?.show_age_in_bonds ?? false;
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    return {
      startDate: startOfMonth(now),
      endDate: customEndOfMonth(now),
    };
  }, []);

  const {
    data: assetsIndicators,
    isPending: isAssetsIndicatorsLoading,
    isError: isAssetsIndicatorsError,
  } = useAssetsIndicators({ includeYield: true });
  const {
    data: { total: bankAmount } = { total: 0 },
    isPending: isBankAccountLoading,
    isError: isBankAccountError,
  } = useBankAccountsSummary();

  const {
    data: expensesIndicators,
    isPending: isExpensesIndicatorsLoading,
    isError: isExpensesIndicatorsError,
  } = useHomeExpensesIndicators({ includeFireAvg: true });

  const {
    data: revenuesIndicators,
    isPending: isRevenuesIndicatorsLoading,
    isError: isRevenuesIndicatorsError,
  } = useRevenuesIndicators({ startDate, endDate });

  const {
    data: { avg: avgPassiveIncome } = { avg: 0 },
    isPending: isIncomesAvgLoading,
  } = useIncomesAvg({ enabled: selectedMethod === "dividends_only" });

  const {
    data: assetsReportData,
    isPending: isReportsLoading,
  } = useAssetsReports({
    kind: Kinds.TOTAL_INVESTED,
    group_by: GroupBy.TYPE,
    current: true,
    percentage: false,
  });

  const { fixedIncomeTotal, variableIncomeTotal, equityTotal, ifixTotal } = useMemo(() => {
    const data = (assetsReportData ?? []) as ReportAggregatedByTypeDataItem[];
    const fixed = data.find((d) => d.type === "Renda fixa BR")?.total ?? 0;
    const ifix = data.find((d) => d.type === "FII")?.total ?? 0;
    const equity = data
      .filter((d) => ["Ação BR", "Ação EUA", "Cripto"].includes(d.type))
      .reduce((sum, d) => sum + d.total, 0);
    return {
      fixedIncomeTotal: fixed,
      variableIncomeTotal: equity + ifix,
      equityTotal: equity,
      ifixTotal: ifix,
    };
  }, [assetsReportData]);

  const percentage = useMemo(() => {
    if (expensesIndicators && revenuesIndicators)
      return (
        ((expensesIndicators?.total ?? 0) / (revenuesIndicators?.total || 1)) *
        100
      );
    return 0;
  }, [expensesIndicators, revenuesIndicators]);

  const isLoading = isAssetsIndicatorsLoading || isBankAccountLoading;
  const isError = isAssetsIndicatorsError || isBankAccountError;

  // Monthly savings = avg(revenues) − avg(expenses) over the trailing 12
  // months. Drives the time-to-target accumulation forecast on FIRE
  // indicators. Negative values mean the user is in deficit; the indicator
  // surfaces a hint instead of a bogus projection.
  const monthlySavings =
    (revenuesIndicators?.avg ?? 0) - (expensesIndicators?.avg ?? 0);
  const openFireStrategy = () => navigate("/planning/fire");

  return (
    <Grid container spacing={4}>
      <Grid item xs={6}>
        <Stack gap={1}>
          <Stack direction="row" gap={4}>
        <Indicator
          title="Patrimônio total"
              tooltipText="Soma do valor atual dos investimentos + saldo em conta corrente. Variação comparada ao mês anterior"
          value={(assetsIndicators?.total ?? 0) + bankAmount}
          secondaryIndicator={
            <AssetPercentageChangeSecondaryIndicator
              value={assetsIndicators?.total_diff_percentage}
              variant={
                assetsIndicators && assetsIndicators.total_diff_percentage > 0
                  ? "success"
                  : "danger"
              }
              isLoading={isLoading}
              text="no último mês"
            />
          }
          Icon={MonetizationOnOutlinedIcon}
          variant="success"
          isLoading={isLoading}
          isError={isError}
              sx={{ width: "50%" }}
        />
        <Indicator
          title="ROI (Lucro/Prejuízo)"
              tooltipText="Retorno sobre investimento: soma do lucro/prejuízo de posições abertas e fechadas de investimentos"
          value={
            (assetsIndicators?.ROI_opened ?? 0) +
            (assetsIndicators?.ROI_closed ?? 0)
          }
          secondaryIndicator={
            <RoiSecondaryIndicator
              value={assetsIndicators?.ROI_opened}
              variant={
                assetsIndicators && assetsIndicators.ROI_opened > 0
                  ? "success"
                  : "danger"
              }
              isLoading={isAssetsIndicatorsLoading}
            />
          }
          Icon={InvestmentUpIcon as typeof SvgIcon}
          variant={
            assetsIndicators && assetsIndicators.ROI > 0 ? "success" : "danger"
          }
          isLoading={isAssetsIndicatorsLoading}
          isError={isAssetsIndicatorsError}
              sx={{ width: "50%" }}
            />
          </Stack>
          {{
            fire: (
              <>
                {showAgeInBonds ? (
                  <ConstantDollarAgeInBondsIndicator
                    patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                    avgExpenses={expensesIndicators?.fire_avg ?? 0}
                    isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
                    dateOfBirth={dateOfBirth}
                    withdrawalRate={firePreferences.withdrawal_rate}
                    onWithdrawalRateChange={() => {}}
                    targetYears={firePreferences.target_years}
                    onTargetYearsChange={() => {}}
                    fixedIncomeTotal={fixedIncomeTotal}
                    variableIncomeTotal={variableIncomeTotal}
                    equityTotal={equityTotal}
                    ifixTotal={ifixTotal}
                    monthlySavings={monthlySavings}
                    simulatedExpenses={firePreferences.monthly_expenses_override}
                    excludeIfixFromSim={firePreferences.exclude_ifix_from_sim}
                    onProgressClick={openFireStrategy}
                    compact
                  />
                ) : (
                  <ConstantDollarIndicator
                    patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                    avgExpenses={expensesIndicators?.fire_avg ?? 0}
                    isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
                    withdrawalRate={firePreferences.withdrawal_rate}
                    onWithdrawalRateChange={() => {}}
                    targetYears={firePreferences.target_years}
                    onTargetYearsChange={() => {}}
                    equityTotal={equityTotal}
                    ifixTotal={ifixTotal}
                    fixedIncomeTotal={fixedIncomeTotal + bankAmount}
                    monthlySavings={monthlySavings}
                    simulatedExpenses={firePreferences.monthly_expenses_override}
                    excludeIfixFromSim={firePreferences.exclude_ifix_from_sim}
                    onProgressClick={openFireStrategy}
                    compact
                  />
                )}
                {!showAgeInBonds && showGaleno && (
                  <GalenoIndicator
                    reportData={(assetsReportData ?? []) as ReportAggregatedByTypeDataItem[]}
                    bankAmount={bankAmount}
                    avgExpenses={expensesIndicators?.fire_avg ?? 0}
                    isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
                    transferRate={galenoTransferRate}
                    onTransferRateChange={setGalenoTransferRate}
                    targetBufferYears={galenoTargetBufferYears}
                    onTargetBufferYearsChange={setGalenoTargetBufferYears}
                  />
                )}
              </>
            ),
            dividends_only: (
              <DividendsOnlyIndicator
                avgPassiveIncome={avgPassiveIncome}
                avgExpenses={expensesIndicators?.fire_avg ?? 0}
                patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                isLoading={isLoading || isExpensesIndicatorsLoading || isIncomesAvgLoading}
                simulatedYield={dividendsOnlyPreferences.yield_override}
                simulatedSavings={dividendsOnlyPreferences.monthly_savings_override}
                simulatedExpenses={dividendsOnlyPreferences.monthly_expenses_override}
                compact
              />
            ),
            one_over_n: (
              <>
                <OneOverNIndicator
                  patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                  avgExpenses={expensesIndicators?.fire_avg ?? 0}
                  avgMonthlySavings={
                    (revenuesIndicators?.avg ?? 0) -
                    (expensesIndicators?.avg ?? 0)
                  }
                  isLoading={
                    isLoading ||
                    isExpensesIndicatorsLoading ||
                    isRevenuesIndicatorsLoading
                  }
                  dateOfBirth={dateOfBirth}
                  targetDepletionAge={oneOverNPreferences.target_depletion_age}
                  onTargetDepletionAgeChange={() => {}}
                  realReturn={oneOverNPreferences.real_return}
                  onRealReturnChange={() => {}}
                  simulatedSavings={oneOverNPreferences.monthly_savings_override}
                  simulatedExpenses={oneOverNPreferences.monthly_expenses_override}
                  compact
                />
                {showGaleno && (
                  <GalenoIndicator
                    reportData={(assetsReportData ?? []) as ReportAggregatedByTypeDataItem[]}
                    bankAmount={bankAmount}
                    avgExpenses={expensesIndicators?.fire_avg ?? 0}
                    isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
                    transferRate={galenoTransferRate}
                    onTransferRateChange={setGalenoTransferRate}
                    targetBufferYears={galenoTargetBufferYears}
                    onTargetBufferYearsChange={setGalenoTargetBufferYears}
                  />
                )}
              </>
            ),
            vpw: (
              <>
                <VPWIndicator
                  equityTotal={equityTotal}
                  ifixTotal={ifixTotal}
                  fixedIncomeTotal={fixedIncomeTotal}
                  avgExpenses={expensesIndicators?.fire_avg ?? 0}
                  avgMonthlySavings={monthlySavings}
                  isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
                  dateOfBirth={dateOfBirth}
                  targetAge={vpwPreferences.target_age}
                  onTargetAgeChange={() => {}}
                  stockReturn={vpwPreferences.stock_return}
                  onStockReturnChange={() => {}}
                  bondReturn={vpwPreferences.bond_return}
                  onBondReturnChange={() => {}}
                  stockAllocationOverride={vpwPreferences.stock_allocation_override}
                  simulatedSavings={vpwPreferences.monthly_savings_override}
                  simulatedExpenses={vpwPreferences.monthly_expenses_override}
                  compact
                />
                {showGaleno && (
                  <GalenoIndicator
                    reportData={(assetsReportData ?? []) as ReportAggregatedByTypeDataItem[]}
                    bankAmount={bankAmount}
                    avgExpenses={expensesIndicators?.fire_avg ?? 0}
                    isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
                    transferRate={galenoTransferRate}
                    onTransferRateChange={setGalenoTransferRate}
                    targetBufferYears={galenoTargetBufferYears}
                    onTargetBufferYearsChange={setGalenoTargetBufferYears}
                  />
                )}
              </>
            ),
          }[selectedMethod]}
        </Stack>
      </Grid>
      <Grid item xs={6}>
        <Stack gap={1}>
          <Stack direction="row" gap={4}>
            <Indicator
              title="Despesas"
              tooltipText={`Total de despesas no mês atual. Variação comparada à média mensal dos últimos 12 meses (${expensesIndicators?.avg ? (hideValues ? "***" : formatCurrency(expensesIndicators.avg)) : "N/A"})`}
              value={expensesIndicators?.total}
              secondaryIndicator={
                <ExpensePercentageChangeSecondaryIndicator
                  value={expensesIndicators?.diff}
                  variant={
                    expensesIndicators && (expensesIndicators.diff ?? 0) < 0
                      ? "success"
                      : "danger"
                  }
                  isIconInverse
                  isLoading={isExpensesIndicatorsLoading}
                />
              }
              Icon={MonetizationOnOutlinedIcon}
              variant="danger"
              isLoading={isExpensesIndicatorsLoading}
              isError={isExpensesIndicatorsError}
              sx={{ width: "50%" }}
            />
            <Indicator
              title="Receitas"
              tooltipText={`Total de receitas no mês atual. Variação comparada à média mensal dos últimos 12 meses (${revenuesIndicators?.avg ? (hideValues ? "***" : formatCurrency(revenuesIndicators.avg)) : "N/A"})`}
              value={revenuesIndicators?.total}
              secondaryIndicator={
                <ExpensePercentageChangeSecondaryIndicator
                  value={revenuesIndicators?.diff}
                  variant={
                    revenuesIndicators && (revenuesIndicators.diff ?? 0) > 0
                      ? "success"
                      : "danger"
                  }
                  isLoading={isRevenuesIndicatorsLoading}
                />
              }
              Icon={MonetizationOnOutlinedIcon}
              variant="success"
              isLoading={isRevenuesIndicatorsLoading}
              isError={isRevenuesIndicatorsError}
              sx={{ width: "50%" }}
            />
          </Stack>
          <ExpenseRevenuesRatioLinearProgress
            percentage={percentage}
            isLoading={
              isExpensesIndicatorsLoading || isRevenuesIndicatorsLoading
            }
          />
        </Stack>
      </Grid>
    </Grid>
  );
};

export default Indicators;
