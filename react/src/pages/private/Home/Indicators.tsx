import { useMemo, useState } from "react";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import SvgIcon from "@mui/material/SvgIcon";

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
import { usePlanningPreferences, useSelectedMethod } from "../Planning/hooks";
import type { WithdrawalMethodKey } from "../Planning/api";
import FIREProgressBar from "./FIREProgressBar";
import DividendsOnlyIndicator from "./DividendsOnlyIndicator";
import ConstantDollarIndicator from "./ConstantDollarIndicator";
import GalenoIndicator from "./GalenoIndicator";
import OneOverNIndicator from "./OneOverNIndicator";
import AgeInBondsIndicator from "./AgeInBondsIndicator";
import ConstantDollarAgeInBondsIndicator from "./ConstantDollarAgeInBondsIndicator";
import VPWIndicator from "./VPWIndicator";

const Indicators = () => {
  const { hideValues } = useHideValues();
  const [fireWithdrawalRate, setFireWithdrawalRate] = useState(4);
  const [realReturn, setRealReturn] = useState(5);
  const [targetYears, setTargetYears] = useState(30);
  const [galenoTransferRate, setGalenoTransferRate] = useState(6);
  const [galenoTargetBufferYears, setGalenoTargetBufferYears] = useState(7);
  const [targetDepletionAge, setTargetDepletionAge] = useState(90);
  const [ageInBondsWithdrawalRate, setAgeInBondsWithdrawalRate] = useState(4);
  const [ageInBondsStockReturn, setAgeInBondsStockReturn] = useState(8);
  const [ageInBondsBondReturn, setAgeInBondsBondReturn] = useState(3);
  const [cdAibInflation, setCdAibInflation] = useState(4.5);
  const [cdAibStockReturn, setCdAibStockReturn] = useState(8);
  const [cdAibBondReturn, setCdAibBondReturn] = useState(3);
  const [cdAibTargetYears, setCdAibTargetYears] = useState(30);
  const [vpwTargetAge, setVpwTargetAge] = useState(100);
  const [vpwStockReturn, setVpwStockReturn] = useState(5);
  const [vpwBondReturn, setVpwBondReturn] = useState(1.8);
  const { selectedMethod } = useSelectedMethod();
  const { data: planningData } = usePlanningPreferences();
  const preferences = planningData?.preferences;
  const dateOfBirth = planningData?.dateOfBirth ?? null;
  const showGaleno = (preferences?.show_galeno ?? false) && selectedMethod !== "dividends_only";
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

  const { fixedIncomeTotal, variableIncomeTotal } = useMemo(() => {
    const data = (assetsReportData ?? []) as ReportAggregatedByTypeDataItem[];
    const fixed = data.find((d) => d.type === "Renda fixa BR")?.total ?? 0;
    const variable = data
      .filter((d) => ["Ação BR", "Ação EUA", "Cripto", "FII"].includes(d.type))
      .reduce((sum, d) => sum + d.total, 0);
    return { fixedIncomeTotal: fixed, variableIncomeTotal: variable };
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
                  <AgeInBondsIndicator
                    patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                    avgExpenses={expensesIndicators?.fire_avg ?? 0}
                    isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
                    dateOfBirth={dateOfBirth}
                    fixedIncomeTotal={fixedIncomeTotal}
                    variableIncomeTotal={variableIncomeTotal}
                    withdrawalRate={ageInBondsWithdrawalRate}
                    onWithdrawalRateChange={setAgeInBondsWithdrawalRate}
                    stockReturn={ageInBondsStockReturn}
                    onStockReturnChange={setAgeInBondsStockReturn}
                    bondReturn={ageInBondsBondReturn}
                    onBondReturnChange={setAgeInBondsBondReturn}
                    compact
                  />
                ) : (
                  <FIREProgressBar
                    patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                    avgExpenses={expensesIndicators?.fire_avg ?? 0}
                    isLoading={isLoading || isExpensesIndicatorsLoading}
                    withdrawalRate={fireWithdrawalRate}
                    onWithdrawalRateChange={setFireWithdrawalRate}
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
                compact
              />
            ),
            constant_withdrawal: (
              <>
                {showAgeInBonds ? (
                  <ConstantDollarAgeInBondsIndicator
                    patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                    avgExpenses={expensesIndicators?.fire_avg ?? 0}
                    isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
                    dateOfBirth={dateOfBirth}
                    fixedIncomeTotal={fixedIncomeTotal}
                    variableIncomeTotal={variableIncomeTotal}
                    inflation={cdAibInflation}
                    onInflationChange={setCdAibInflation}
                    stockReturn={cdAibStockReturn}
                    onStockReturnChange={setCdAibStockReturn}
                    bondReturn={cdAibBondReturn}
                    onBondReturnChange={setCdAibBondReturn}
                    targetYears={cdAibTargetYears}
                    onTargetYearsChange={setCdAibTargetYears}
                    compact
                  />
                ) : (
                  <ConstantDollarIndicator
                    patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                    avgExpenses={expensesIndicators?.fire_avg ?? 0}
                    isLoading={isLoading || isExpensesIndicatorsLoading}
                    realReturn={realReturn}
                    onRealReturnChange={setRealReturn}
                    targetYears={targetYears}
                    onTargetYearsChange={setTargetYears}
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
            one_over_n: (
              <>
                <OneOverNIndicator
                  patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                  avgExpenses={expensesIndicators?.fire_avg ?? 0}
                  isLoading={isLoading || isExpensesIndicatorsLoading}
                  dateOfBirth={dateOfBirth}
                  targetDepletionAge={targetDepletionAge}
                  onTargetDepletionAgeChange={setTargetDepletionAge}
                  realReturn={realReturn}
                  onRealReturnChange={setRealReturn}
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
                  patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
                  avgExpenses={expensesIndicators?.fire_avg ?? 0}
                  isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
                  dateOfBirth={dateOfBirth}
                  fixedIncomeTotal={fixedIncomeTotal}
                  variableIncomeTotal={variableIncomeTotal}
                  targetAge={vpwTargetAge}
                  onTargetAgeChange={setVpwTargetAge}
                  stockReturn={vpwStockReturn}
                  onStockReturnChange={setVpwStockReturn}
                  bondReturn={vpwBondReturn}
                  onBondReturnChange={setVpwBondReturn}
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
          }[selectedMethod] satisfies Record<WithdrawalMethodKey, React.ReactNode>[WithdrawalMethodKey]}
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
