import { useLayoutEffect, useMemo, useState } from "react";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

import DividendsOnlyIndicator from "../../Home/DividendsOnlyIndicator";
import { useAssetsIndicators } from "../../Assets/Indicators/hooks";
import { useBankAccountsSummary } from "../../Expenses/hooks";
import { useIncomesAvg } from "../../Incomes/Indicators/hooks";
import {
  getDividendsOnlyPlanningPreferences,
  type PlanningPreferences,
} from "../api";
import DefaultsPanel from "../DefaultsPanel";
import {
  usePlanningPreferences,
  useSelectedMethod,
  useUpdatePlanningPreferences,
} from "../hooks";
import StrategyChrome from "../StrategyChrome";
import StrategyHeader from "../StrategyHeader";
import { STRATEGY_CONTENT } from "../strategyContent";
import { useStrategyCommonData } from "../useStrategyCommonData";

const METHOD = "dividends_only" as const;

const DividendsOnlyDetail = () => {
  const content = STRATEGY_CONTENT[METHOD];
  const { selectedMethod } = useSelectedMethod();
  const isActive = selectedMethod === METHOD;

  const { data: planningData } = usePlanningPreferences();
  const preferences = planningData?.preferences;
  const dividendsOnlyPreferences = getDividendsOnlyPlanningPreferences(preferences);
  const { mutate: updatePreferences, isPending: isUpdating } =
    useUpdatePlanningPreferences();

  // Draft state — initialized from saved prefs, re-synced on refetch (post-save
  // reconciles, refetches from other surfaces overwrite local edits).
  const [yieldOverride, setYieldOverride] = useState<number | null>(
    dividendsOnlyPreferences.yield_override,
  );
  const [savingsOverride, setSavingsOverride] = useState<number | null>(
    dividendsOnlyPreferences.monthly_savings_override,
  );
  const [expensesOverride, setExpensesOverride] = useState<number | null>(
    dividendsOnlyPreferences.monthly_expenses_override,
  );

  useLayoutEffect(() => {
    setYieldOverride(dividendsOnlyPreferences.yield_override);
    setSavingsOverride(dividendsOnlyPreferences.monthly_savings_override);
    setExpensesOverride(dividendsOnlyPreferences.monthly_expenses_override);
  }, [
    dividendsOnlyPreferences.monthly_expenses_override,
    dividendsOnlyPreferences.monthly_savings_override,
    dividendsOnlyPreferences.yield_override,
  ]);

  const { avgExpenses, isLoading: isCommonLoading } = useStrategyCommonData();
  const { data: assetsIndicators, isPending: isAssetsLoading } = useAssetsIndicators({
    includeYield: true,
  });
  const { data: { total: bankAmount } = { total: 0 }, isPending: isBankLoading } =
    useBankAccountsSummary();
  const {
    data: { avg: avgPassiveIncome } = { avg: 0 },
    isPending: isIncomesLoading,
  } = useIncomesAvg();

  const patrimonyTotal = (assetsIndicators?.total ?? 0) + bankAmount;
  const isDataLoading =
    isAssetsLoading || isBankLoading || isCommonLoading || isIncomesLoading;

  const isDirty = useMemo(
    () =>
      isActive &&
      !!planningData &&
      (yieldOverride !== dividendsOnlyPreferences.yield_override ||
        savingsOverride !== dividendsOnlyPreferences.monthly_savings_override ||
        expensesOverride !== dividendsOnlyPreferences.monthly_expenses_override),
    [
      isActive,
      planningData,
      dividendsOnlyPreferences.monthly_expenses_override,
      dividendsOnlyPreferences.monthly_savings_override,
      dividendsOnlyPreferences.yield_override,
      yieldOverride,
      savingsOverride,
      expensesOverride,
    ],
  );

  const handleSelect = () => updatePreferences({ selected_method: METHOD });

  const handleSave = () => {
    if (!isActive) return;
    const patch: PlanningPreferences = {
      dividends_only: {
        yield_override: yieldOverride,
        monthly_savings_override: savingsOverride,
        monthly_expenses_override: expensesOverride,
      },
    };
    updatePreferences(patch);
  };

  return (
    <Stack spacing={3} pb={3}>
      <StrategyHeader
        title={content.title}
        subtitle={content.subtitle}
        isActive={isActive}
        isMutating={isUpdating}
        onSelect={handleSelect}
        isDirty={isDirty}
        onSave={handleSave}
      />

      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <DividendsOnlyIndicator
          avgPassiveIncome={avgPassiveIncome}
          avgExpenses={avgExpenses}
          patrimonyTotal={patrimonyTotal}
          isLoading={isDataLoading}
          persistEnabled={isActive}
          isPersisting={isUpdating}
          simulatedYield={yieldOverride}
          onSimulatedYieldChange={setYieldOverride}
          simulatedSavings={savingsOverride}
          onSimulatedSavingsChange={setSavingsOverride}
          simulatedExpenses={expensesOverride}
          onSimulatedExpensesChange={setExpensesOverride}
        />
      </Paper>

      <DefaultsPanel items={content.defaultsExplained} />

      <StrategyChrome
        rationale={content.rationale}
        pros={content.pros}
        cons={content.cons}
      />
    </Stack>
  );
};

export default DividendsOnlyDetail;
