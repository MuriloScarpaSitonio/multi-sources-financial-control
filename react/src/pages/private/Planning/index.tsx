import { useState } from "react";

import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";

import { Text, FontWeights } from "../../../design-system";
import { useAssetsIndicators } from "../Assets/Indicators/hooks";
import { useAssetsReports } from "../Assets/Reports/AssetAggregationReports/hooks";
import { GroupBy, Kinds } from "../Assets/Reports/types";
import type { ReportAggregatedByTypeDataItem } from "../Assets/Reports/types";
import { useBankAccountsSummary } from "../Expenses/hooks";
import { useHomeExpensesIndicators } from "../Expenses/Indicators/hooks";
import { useIncomesAvg } from "../Incomes/Indicators/hooks";
import FIREProgressBar from "../Home/FIREProgressBar";
import DividendsOnlyIndicator from "../Home/DividendsOnlyIndicator";
import ConstantDollarIndicator from "../Home/ConstantDollarIndicator";
import GalenoIndicator from "../Home/GalenoIndicator";
import OneOverNIndicator from "../Home/OneOverNIndicator";
import { usePlanningPreferences, useUpdatePlanningPreferences } from "./hooks";
import type { WithdrawalMethodKey } from "./api";
import { METHODS, GALENO_RATIONALE, GALENO_PROS, GALENO_CONS } from "./consts";
import MethodCard from "./MethodCard";

const Planning = () => {
  const [fireMultiplier, setFireMultiplier] = useState(25);
  const [realReturn, setRealReturn] = useState(5);
  const [targetYears, setTargetYears] = useState(30);
  const [galenoTransferRate, setGalenoTransferRate] = useState(6);
  const [galenoTargetBufferYears, setGalenoTargetBufferYears] = useState(7);
  const [localGalenoFire, setLocalGalenoFire] = useState(false);
  const [localGalenoConstant, setLocalGalenoConstant] = useState(false);
  const [targetDepletionAge, setTargetDepletionAge] = useState(90);
  const [oneOverNInflation, setOneOverNInflation] = useState(4.5);
  const [localGalenoOneOverN, setLocalGalenoOneOverN] = useState(false);

  const { data: planningData } = usePlanningPreferences();
  const preferences = planningData?.preferences;
  const dateOfBirth = planningData?.dateOfBirth ?? null;
  const { mutate: updatePreferences, isPending: isUpdating } =
    useUpdatePlanningPreferences();

  const {
    data: assetsIndicators,
    isPending: isAssetsLoading,
  } = useAssetsIndicators({ includeYield: true });
  const {
    data: { total: bankAmount } = { total: 0 },
    isPending: isBankLoading,
  } = useBankAccountsSummary();
  const {
    data: expensesIndicators,
    isPending: isExpensesLoading,
  } = useHomeExpensesIndicators({ includeFireAvg: true });
  const {
    data: { avg: avgPassiveIncome } = { avg: 0 },
    isPending: isIncomesLoading,
  } = useIncomesAvg();
  const {
    data: assetsReportData,
    isPending: isReportsLoading,
  } = useAssetsReports({
    kind: Kinds.TOTAL_INVESTED,
    group_by: GroupBy.TYPE,
    current: true,
    percentage: false,
  });

  const validMethods: WithdrawalMethodKey[] = ["fire", "dividends_only", "constant_withdrawal", "one_over_n"];
  const saved = preferences?.selected_method;
  const selectedMethod: WithdrawalMethodKey =
    saved && validMethods.includes(saved as WithdrawalMethodKey)
      ? (saved as WithdrawalMethodKey)
      : "fire";

  const patrimonyTotal = (assetsIndicators?.total ?? 0) + bankAmount;
  const avgExpenses = expensesIndicators?.fire_avg ?? 0;
  const isDataLoading = isAssetsLoading || isBankLoading || isExpensesLoading;

  const showGaleno = preferences?.show_galeno ?? false;

  const handleSelect = (method: WithdrawalMethodKey) => {
    updatePreferences({ selected_method: method });
  };

  const handleToggleGaleno = (checked: boolean) => {
    updatePreferences({ show_galeno: checked });
  };

  const isGalenoChecked = (method: WithdrawalMethodKey) => {
    if (selectedMethod === method) return showGaleno;
    if (method === "fire") return localGalenoFire;
    if (method === "constant_withdrawal") return localGalenoConstant;
    if (method === "one_over_n") return localGalenoOneOverN;
    return false;
  };

  const handleGalenoChange = (method: WithdrawalMethodKey, checked: boolean) => {
    if (selectedMethod === method) {
      handleToggleGaleno(checked);
    } else if (method === "fire") {
      setLocalGalenoFire(checked);
    } else if (method === "constant_withdrawal") {
      setLocalGalenoConstant(checked);
    } else if (method === "one_over_n") {
      setLocalGalenoOneOverN(checked);
    }
  };

  const galenoProps = {
    reportData: (assetsReportData ?? []) as ReportAggregatedByTypeDataItem[],
    bankAmount,
    avgExpenses,
    isLoading: isDataLoading || isReportsLoading,
    transferRate: galenoTransferRate,
    onTransferRateChange: setGalenoTransferRate,
    targetBufferYears: galenoTargetBufferYears,
    onTargetBufferYearsChange: setGalenoTargetBufferYears,
  };

  const galenoToggle = (method: WithdrawalMethodKey) => {
    const checked = isGalenoChecked(method);
    return (
      <>
        <FormControlLabel
          control={
            <Switch
              checked={checked}
              onChange={(_, value) => handleGalenoChange(method, value)}
              disabled={selectedMethod === method && isUpdating}
              size="small"
            />
          }
          label="Incluir colchão de renda fixa (Galeno)"
          slotProps={{ typography: { variant: "caption" } }}
        />
        {checked && <GalenoIndicator {...galenoProps} />}
      </>
    );
  };

  const indicators: Record<WithdrawalMethodKey, React.ReactNode> = {
    fire: (
      <>
        <FIREProgressBar
          patrimonyTotal={patrimonyTotal}
          avgExpenses={avgExpenses}
          isLoading={isDataLoading}
          multiplier={fireMultiplier}
          onMultiplierChange={setFireMultiplier}
        />
        {galenoToggle("fire")}
      </>
    ),
    dividends_only: (
      <DividendsOnlyIndicator
        avgPassiveIncome={avgPassiveIncome}
        avgExpenses={avgExpenses}
        patrimonyTotal={patrimonyTotal}
        isLoading={isDataLoading || isIncomesLoading}
      />
    ),
    constant_withdrawal: (
      <>
        <ConstantDollarIndicator
          patrimonyTotal={patrimonyTotal}
          avgExpenses={avgExpenses}
          isLoading={isDataLoading}
          realReturn={realReturn}
          onRealReturnChange={setRealReturn}
          targetYears={targetYears}
          onTargetYearsChange={setTargetYears}
        />
        {galenoToggle("constant_withdrawal")}
      </>
    ),
    one_over_n: (
      <>
        <OneOverNIndicator
          patrimonyTotal={patrimonyTotal}
          avgExpenses={avgExpenses}
          isLoading={isDataLoading}
          dateOfBirth={dateOfBirth}
          targetDepletionAge={targetDepletionAge}
          onTargetDepletionAgeChange={setTargetDepletionAge}
          realReturn={realReturn}
          onRealReturnChange={setRealReturn}
          inflation={oneOverNInflation}
          onInflationChange={setOneOverNInflation}
        />
        {galenoToggle("one_over_n")}
      </>
    ),
  };

  return (
    <Stack spacing={3} pb={3}>
      <Text weight={FontWeights.SEMI_BOLD}>Estratégias</Text>
      {METHODS.map((method) => (
        <MethodCard
          key={method.key}
          title={method.title}
          subtitle={method.subtitle}
          rationale={
            isGalenoChecked(method.key)
              ? method.rationale + " " + GALENO_RATIONALE
              : method.rationale
          }
          pros={
            isGalenoChecked(method.key)
              ? [...method.pros, ...GALENO_PROS]
              : method.pros
          }
          cons={
            isGalenoChecked(method.key)
              ? [...method.cons, ...GALENO_CONS]
              : method.cons
          }
          isSelected={selectedMethod === method.key}
          onSelect={() => handleSelect(method.key)}
          isSelectLoading={isUpdating}
        >
          {indicators[method.key]}
        </MethodCard>
      ))}
    </Stack>
  );
};

export default Planning;
