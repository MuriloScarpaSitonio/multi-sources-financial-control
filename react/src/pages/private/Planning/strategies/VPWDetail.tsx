import { useLayoutEffect, useMemo, useState } from "react";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

import VPWIndicator from "../../Home/VPWIndicator";
import { useAssetsReports } from "../../Assets/Reports/AssetAggregationReports/hooks";
import { GroupBy, Kinds } from "../../Assets/Reports/types";
import type { ReportAggregatedByTypeDataItem } from "../../Assets/Reports/types";
import {
  getVPWPlanningPreferences,
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
import { STRATEGY_CONTENT } from "../strategyContent";
import { useStrategyCommonData } from "../useStrategyCommonData";

const METHOD = "vpw" as const;

const VPWDetail = () => {
  const content = STRATEGY_CONTENT[METHOD];
  const { selectedMethod } = useSelectedMethod();
  const isActive = selectedMethod === METHOD;

  const { data: planningData } = usePlanningPreferences();
  const preferences = planningData?.preferences;
  const vpwPreferences = getVPWPlanningPreferences(preferences);
  const dateOfBirth = planningData?.dateOfBirth ?? null;
  const { mutate: updatePreferences, isPending: isUpdating } =
    useUpdatePlanningPreferences();

  const [targetAge, setTargetAge] = useState(vpwPreferences.target_age);
  const [stockReturn, setStockReturn] = useState(vpwPreferences.stock_return);
  const [bondReturn, setBondReturn] = useState(vpwPreferences.bond_return);
  const [stockAllocationOverride, setStockAllocationOverride] = useState<number | null>(
    vpwPreferences.stock_allocation_override,
  );
  const [savingsOverride, setSavingsOverride] = useState<number | null>(
    vpwPreferences.monthly_savings_override,
  );
  const [expensesOverride, setExpensesOverride] = useState<number | null>(
    vpwPreferences.monthly_expenses_override,
  );

  useLayoutEffect(() => {
    setTargetAge(vpwPreferences.target_age);
    setStockReturn(vpwPreferences.stock_return);
    setBondReturn(vpwPreferences.bond_return);
    setStockAllocationOverride(vpwPreferences.stock_allocation_override);
    setSavingsOverride(vpwPreferences.monthly_savings_override);
    setExpensesOverride(vpwPreferences.monthly_expenses_override);
  }, [
    vpwPreferences.bond_return,
    vpwPreferences.monthly_expenses_override,
    vpwPreferences.monthly_savings_override,
    vpwPreferences.stock_allocation_override,
    vpwPreferences.stock_return,
    vpwPreferences.target_age,
  ]);

  const {
    avgExpenses,
    derivedMonthlySavings,
    isLoading: isCommonLoading,
  } = useStrategyCommonData();
  const { data: assetsReportData, isPending: isReportsLoading } = useAssetsReports({
    kind: Kinds.TOTAL_INVESTED,
    group_by: GroupBy.TYPE,
    current: true,
    percentage: false,
  });

  const { equityTotal, ifixTotal, fixedIncomeTotal } = useMemo(() => {
    const data = (assetsReportData ?? []) as ReportAggregatedByTypeDataItem[];
    const fixed = data.find((d) => d.type === "Renda fixa BR")?.total ?? 0;
    const ifix = data.find((d) => d.type === "FII")?.total ?? 0;
    const equity = data
      .filter((d) => ["Ação BR", "Ação EUA", "Cripto"].includes(d.type))
      .reduce((sum, d) => sum + d.total, 0);
    return { equityTotal: equity, ifixTotal: ifix, fixedIncomeTotal: fixed };
  }, [assetsReportData]);

  const isDataLoading = isCommonLoading || isReportsLoading;

  const isDirty = useMemo(
    () =>
      isActive &&
      !!planningData &&
      (targetAge !== vpwPreferences.target_age ||
        stockReturn !== vpwPreferences.stock_return ||
        bondReturn !== vpwPreferences.bond_return ||
        stockAllocationOverride !== vpwPreferences.stock_allocation_override ||
        savingsOverride !== vpwPreferences.monthly_savings_override ||
        expensesOverride !== vpwPreferences.monthly_expenses_override),
    [
      isActive,
      planningData,
      vpwPreferences.bond_return,
      vpwPreferences.monthly_expenses_override,
      vpwPreferences.monthly_savings_override,
      vpwPreferences.stock_allocation_override,
      vpwPreferences.stock_return,
      vpwPreferences.target_age,
      targetAge,
      stockReturn,
      bondReturn,
      stockAllocationOverride,
      savingsOverride,
      expensesOverride,
    ],
  );

  const handleSelect = () => updatePreferences({ selected_method: METHOD });

  const handleSave = () => {
    if (!isActive) return;
    const patch: PlanningPreferences = {
      vpw: {
        target_age: targetAge,
        stock_return: stockReturn,
        bond_return: bondReturn,
        stock_allocation_override: stockAllocationOverride,
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
        <VPWIndicator
          equityTotal={equityTotal}
          ifixTotal={ifixTotal}
          fixedIncomeTotal={fixedIncomeTotal}
          avgExpenses={avgExpenses}
          avgMonthlySavings={derivedMonthlySavings}
          isLoading={isDataLoading}
          dateOfBirth={dateOfBirth}
          targetAge={targetAge}
          onTargetAgeChange={setTargetAge}
          stockReturn={stockReturn}
          onStockReturnChange={setStockReturn}
          bondReturn={bondReturn}
          onBondReturnChange={setBondReturn}
          persistEnabled={isActive}
          isPersisting={isUpdating}
          stockAllocationOverride={stockAllocationOverride}
          onStockAllocationOverrideChange={setStockAllocationOverride}
          simulatedSavings={savingsOverride}
          onSimulatedSavingsChange={setSavingsOverride}
          simulatedExpenses={expensesOverride}
          onSimulatedExpensesChange={setExpensesOverride}
        />
      </Paper>

      <DefaultsPanel
        items={content.defaultsExplained}
        extra={<FireMethodologyWalkthrough />}
      />

      <StrategyChrome
        rationale={content.rationale}
        pros={content.pros}
        cons={content.cons}
      />
    </Stack>
  );
};

export default VPWDetail;
