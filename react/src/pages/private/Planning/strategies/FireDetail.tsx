import { useLayoutEffect, useMemo, useState } from "react";

import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";

import ConstantDollarAgeInBondsIndicator from "../../Home/ConstantDollarAgeInBondsIndicator";
import ConstantDollarIndicator from "../../Home/ConstantDollarIndicator";
import { useAssetsIndicators } from "../../Assets/Indicators/hooks";
import { useAssetsReports } from "../../Assets/Reports/AssetAggregationReports/hooks";
import { GroupBy, Kinds } from "../../Assets/Reports/types";
import type { ReportAggregatedByTypeDataItem } from "../../Assets/Reports/types";
import { useBankAccountsSummary } from "../../Expenses/hooks";
import AgeInBondsExplainer from "../AgeInBondsExplainer";
import {
  getFirePlanningPreferences,
  type PlanningPreferences,
} from "../api";
import DefaultsPanel from "../DefaultsPanel";
import FireMethodologyWalkthrough from "../FireMethodologyWalkthrough";
import {
  usePlanningPreferences,
  useSelectedMethod,
  useUpdatePlanningPreferences,
} from "../hooks";
import StrategyChrome from "../StrategyChrome";
import StrategyHeader from "../StrategyHeader";
import { AGE_IN_BONDS_TITLES, STRATEGY_CONTENT } from "../strategyContent";
import { useStrategyCommonData } from "../useStrategyCommonData";

const METHOD = "fire" as const;

const FireDetail = () => {
  const content = STRATEGY_CONTENT[METHOD];
  const { selectedMethod } = useSelectedMethod();
  const isActive = selectedMethod === METHOD;

  const { data: planningData } = usePlanningPreferences();
  const preferences = planningData?.preferences;
  const firePreferences = getFirePlanningPreferences(preferences);
  const dateOfBirth = planningData?.dateOfBirth ?? null;
  const { mutate: updatePreferences, isPending: isUpdating } =
    useUpdatePlanningPreferences();

  const [withdrawalRate, setWithdrawalRate] = useState(firePreferences.withdrawal_rate);
  const [targetYears, setTargetYears] = useState(firePreferences.target_years);
  const [expensesOverride, setExpensesOverride] = useState<number | null>(
    firePreferences.monthly_expenses_override,
  );
  const [excludeIfixFromSim, setExcludeIfixFromSim] = useState(
    firePreferences.exclude_ifix_from_sim,
  );
  const [showAgeInBonds, setShowAgeInBonds] = useState(
    preferences?.show_age_in_bonds ?? false,
  );
  // Local what-if state — never persisted (no FIRE monthly_savings field).
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);
  const [monthlySavingsOverride, setMonthlySavingsOverride] = useState<number | null>(
    null,
  );

  useLayoutEffect(() => {
    setWithdrawalRate(firePreferences.withdrawal_rate);
    setTargetYears(firePreferences.target_years);
    setExpensesOverride(firePreferences.monthly_expenses_override);
    setExcludeIfixFromSim(firePreferences.exclude_ifix_from_sim);
  }, [
    firePreferences.exclude_ifix_from_sim,
    firePreferences.monthly_expenses_override,
    firePreferences.target_years,
    firePreferences.withdrawal_rate,
  ]);

  useLayoutEffect(() => {
    setShowAgeInBonds(preferences?.show_age_in_bonds ?? false);
  }, [preferences?.show_age_in_bonds]);

  const {
    avgExpenses,
    derivedMonthlySavings,
    isLoading: isCommonLoading,
  } = useStrategyCommonData();
  const { data: assetsIndicators, isPending: isAssetsLoading } = useAssetsIndicators({
    includeYield: true,
  });
  const { data: { total: bankAmount } = { total: 0 }, isPending: isBankLoading } =
    useBankAccountsSummary();
  const { data: assetsReportData, isPending: isReportsLoading } = useAssetsReports({
    kind: Kinds.TOTAL_INVESTED,
    group_by: GroupBy.TYPE,
    current: true,
    percentage: false,
  });

  const patrimonyTotal = (assetsIndicators?.total ?? 0) + bankAmount;
  const isDataLoading =
    isAssetsLoading || isBankLoading || isCommonLoading || isReportsLoading;

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

  const isDirty = useMemo(
    () =>
      isActive &&
      !!planningData &&
      (withdrawalRate !== firePreferences.withdrawal_rate ||
        targetYears !== firePreferences.target_years ||
        expensesOverride !== firePreferences.monthly_expenses_override ||
        excludeIfixFromSim !== firePreferences.exclude_ifix_from_sim ||
        showAgeInBonds !== (preferences?.show_age_in_bonds ?? false)),
    [
      isActive,
      planningData,
      firePreferences.exclude_ifix_from_sim,
      firePreferences.monthly_expenses_override,
      firePreferences.target_years,
      firePreferences.withdrawal_rate,
      preferences,
      withdrawalRate,
      targetYears,
      expensesOverride,
      excludeIfixFromSim,
      showAgeInBonds,
    ],
  );

  const handleSelect = () => updatePreferences({ selected_method: METHOD });

  const handleSave = () => {
    if (!isActive) return;
    const patch: PlanningPreferences = {
      fire: {
        withdrawal_rate: withdrawalRate,
        target_years: targetYears,
        monthly_expenses_override: expensesOverride,
        exclude_ifix_from_sim: excludeIfixFromSim,
      },
      show_age_in_bonds: showAgeInBonds,
    };
    updatePreferences(patch);
  };

  const displayTitle = showAgeInBonds
    ? (AGE_IN_BONDS_TITLES[METHOD]?.title ?? content.title)
    : content.title;

  const monthlySavings = monthlySavingsOverride ?? derivedMonthlySavings;

  const indicator = showAgeInBonds ? (
    <ConstantDollarAgeInBondsIndicator
      patrimonyTotal={patrimonyTotal}
      avgExpenses={avgExpenses}
      isLoading={isDataLoading}
      persistEnabled={isActive}
      isPersisting={isUpdating}
      dateOfBirth={dateOfBirth}
      withdrawalRate={withdrawalRate}
      onWithdrawalRateChange={setWithdrawalRate}
      targetYears={targetYears}
      onTargetYearsChange={setTargetYears}
      fixedIncomeTotal={fixedIncomeTotal}
      variableIncomeTotal={variableIncomeTotal}
      equityTotal={equityTotal}
      ifixTotal={ifixTotal}
      monthlySavings={monthlySavings}
      defaultMonthlySavings={derivedMonthlySavings}
      onMonthlySavingsChange={setMonthlySavingsOverride}
      onMonthlySavingsReset={() => setMonthlySavingsOverride(null)}
      isMonthlySavingsOverridden={monthlySavingsOverride !== null}
      simulatedExpenses={expensesOverride}
      onSimulatedExpensesChange={setExpensesOverride}
      excludeIfixFromSim={excludeIfixFromSim}
      onExcludeIfixFromSimChange={setExcludeIfixFromSim}
    />
  ) : (
    <ConstantDollarIndicator
      patrimonyTotal={patrimonyTotal}
      avgExpenses={avgExpenses}
      isLoading={isDataLoading}
      persistEnabled={isActive}
      isPersisting={isUpdating}
      withdrawalRate={withdrawalRate}
      onWithdrawalRateChange={setWithdrawalRate}
      targetYears={targetYears}
      onTargetYearsChange={setTargetYears}
      equityTotal={equityTotal}
      ifixTotal={ifixTotal}
      fixedIncomeTotal={fixedIncomeTotal + bankAmount}
      monthlySavings={monthlySavings}
      defaultMonthlySavings={derivedMonthlySavings}
      onMonthlySavingsChange={setMonthlySavingsOverride}
      onMonthlySavingsReset={() => setMonthlySavingsOverride(null)}
      isMonthlySavingsOverridden={monthlySavingsOverride !== null}
      dateOfBirth={dateOfBirth}
      simulatedPatrimony={simulatedPatrimony}
      onSimulatedPatrimonyChange={setSimulatedPatrimony}
      simulatedExpenses={expensesOverride}
      onSimulatedExpensesChange={setExpensesOverride}
      excludeIfixFromSim={excludeIfixFromSim}
      onExcludeIfixFromSimChange={setExcludeIfixFromSim}
    />
  );

  return (
    <Stack spacing={3} pb={3}>
      <StrategyHeader
        title={displayTitle}
        subtitle={content.subtitle}
        isActive={isActive}
        isMutating={isUpdating}
        onSelect={handleSelect}
        isDirty={isDirty}
        onSave={handleSave}
      />

      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>{indicator}</Paper>

      {showAgeInBonds && (
        <DefaultsPanel
          items={content.defaultsExplained}
          extra={<FireMethodologyWalkthrough />}
        />
      )}

      <Stack gap={1}>
        <FormControlLabel
          control={
            <Switch
              checked={showAgeInBonds}
              onChange={(_, value) => setShowAgeInBonds(value)}
              disabled={isUpdating}
              size="small"
            />
          }
          label="Alocação Idade em Renda Fixa"
          slotProps={{ typography: { variant: "caption" } }}
        />
      </Stack>

      {showAgeInBonds && (
        <AgeInBondsExplainer
          dateOfBirth={dateOfBirth}
          fixedIncomeTotal={fixedIncomeTotal}
          variableIncomeTotal={variableIncomeTotal}
        />
      )}

      <StrategyChrome
        rationale={content.rationale}
        pros={content.pros}
        cons={content.cons}
      />
    </Stack>
  );
};

export default FireDetail;
