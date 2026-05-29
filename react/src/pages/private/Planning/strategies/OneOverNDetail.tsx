import { useLayoutEffect, useMemo, useState } from "react";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

import OneOverNIndicator from "../../Home/OneOverNIndicator";
import { useAssetsIndicators } from "../../Assets/Indicators/hooks";
import { useBankAccountsSummary } from "../../Expenses/hooks";
import {
  getOneOverNPlanningPreferences,
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

const METHOD = "one_over_n" as const;

const OneOverNDetail = () => {
  const content = STRATEGY_CONTENT[METHOD];
  const { selectedMethod } = useSelectedMethod();
  const isActive = selectedMethod === METHOD;

  const { data: planningData } = usePlanningPreferences();
  const preferences = planningData?.preferences;
  const oneOverNPreferences = getOneOverNPlanningPreferences(preferences);
  const dateOfBirth = planningData?.dateOfBirth ?? null;
  const { mutate: updatePreferences, isPending: isUpdating } =
    useUpdatePlanningPreferences();

  const [targetDepletionAge, setTargetDepletionAge] = useState(
    oneOverNPreferences.target_depletion_age,
  );
  const [realReturn, setRealReturn] = useState(oneOverNPreferences.real_return);
  const [savingsOverride, setSavingsOverride] = useState<number | null>(
    oneOverNPreferences.monthly_savings_override,
  );
  const [expensesOverride, setExpensesOverride] = useState<number | null>(
    oneOverNPreferences.monthly_expenses_override,
  );

  useLayoutEffect(() => {
    setTargetDepletionAge(oneOverNPreferences.target_depletion_age);
    setRealReturn(oneOverNPreferences.real_return);
    setSavingsOverride(oneOverNPreferences.monthly_savings_override);
    setExpensesOverride(oneOverNPreferences.monthly_expenses_override);
  }, [
    oneOverNPreferences.monthly_expenses_override,
    oneOverNPreferences.monthly_savings_override,
    oneOverNPreferences.real_return,
    oneOverNPreferences.target_depletion_age,
  ]);

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

  const patrimonyTotal = (assetsIndicators?.total ?? 0) + bankAmount;
  const isDataLoading = isAssetsLoading || isBankLoading || isCommonLoading;

  const isDirty = useMemo(
    () =>
      isActive &&
      !!planningData &&
      (targetDepletionAge !== oneOverNPreferences.target_depletion_age ||
        realReturn !== oneOverNPreferences.real_return ||
        savingsOverride !== oneOverNPreferences.monthly_savings_override ||
        expensesOverride !== oneOverNPreferences.monthly_expenses_override),
    [
      isActive,
      planningData,
      oneOverNPreferences.monthly_expenses_override,
      oneOverNPreferences.monthly_savings_override,
      oneOverNPreferences.real_return,
      oneOverNPreferences.target_depletion_age,
      targetDepletionAge,
      realReturn,
      savingsOverride,
      expensesOverride,
    ],
  );

  const handleSelect = () => updatePreferences({ selected_method: METHOD });

  const handleSave = () => {
    if (!isActive) return;
    const patch: PlanningPreferences = {
      one_over_n: {
        target_depletion_age: targetDepletionAge,
        real_return: realReturn,
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
        <OneOverNIndicator
          patrimonyTotal={patrimonyTotal}
          avgExpenses={avgExpenses}
          avgMonthlySavings={derivedMonthlySavings}
          isLoading={isDataLoading}
          dateOfBirth={dateOfBirth}
          targetDepletionAge={targetDepletionAge}
          onTargetDepletionAgeChange={setTargetDepletionAge}
          realReturn={realReturn}
          onRealReturnChange={setRealReturn}
          persistEnabled={isActive}
          isPersisting={isUpdating}
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

export default OneOverNDetail;
