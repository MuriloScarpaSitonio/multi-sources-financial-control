import { useMemo, useState } from "react";

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
import AgeInBondsIndicator from "../Home/AgeInBondsIndicator";
import ConstantDollarAgeInBondsIndicator from "../Home/ConstantDollarAgeInBondsIndicator";
import VPWIndicator from "../Home/VPWIndicator";
import { usePlanningPreferences, useUpdatePlanningPreferences } from "./hooks";
import type { WithdrawalMethodKey } from "./api";
import { METHODS, GALENO_RATIONALE, GALENO_PROS, GALENO_CONS, AGE_IN_BONDS_RATIONALE, AGE_IN_BONDS_PROS, AGE_IN_BONDS_CONS, AGE_IN_BONDS_TITLES } from "./consts";
import MethodCard from "./MethodCard";

const Planning = () => {
  const [fireWithdrawalRate, setFireWithdrawalRate] = useState(4);
  const [realReturn, setRealReturn] = useState(5);
  const [targetYears, setTargetYears] = useState(30);
  const [galenoTransferRate, setGalenoTransferRate] = useState(6);
  const [galenoTargetBufferYears, setGalenoTargetBufferYears] = useState(7);
  const [localGalenoFire, setLocalGalenoFire] = useState(false);
  const [localGalenoConstant, setLocalGalenoConstant] = useState(false);
  const [targetDepletionAge, setTargetDepletionAge] = useState(90);
  const [localGalenoOneOverN, setLocalGalenoOneOverN] = useState(false);
  const [localAgeInBondsFire, setLocalAgeInBondsFire] = useState(false);
  const [localAgeInBondsConstant, setLocalAgeInBondsConstant] = useState(false);
  const [ageInBondsWithdrawalRate, setAgeInBondsWithdrawalRate] = useState(4);
  const [ageInBondsStockReturn, setAgeInBondsStockReturn] = useState(8);
  const [ageInBondsBondReturn, setAgeInBondsBondReturn] = useState(3);
  const [cdAibInflation, setCdAibInflation] = useState(4.5);
  const [cdAibStockReturn, setCdAibStockReturn] = useState(8);
  const [cdAibBondReturn, setCdAibBondReturn] = useState(3);
  const [cdAibTargetYears, setCdAibTargetYears] = useState(30);
  const [localGalenoVpw, setLocalGalenoVpw] = useState(false);
  const [vpwTargetAge, setVpwTargetAge] = useState(100);
  const [vpwStockReturn, setVpwStockReturn] = useState(5);
  const [vpwBondReturn, setVpwBondReturn] = useState(1.8);

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

  const validMethods: WithdrawalMethodKey[] = ["fire", "dividends_only", "constant_withdrawal", "one_over_n", "vpw"];
  const saved = preferences?.selected_method;
  const selectedMethod: WithdrawalMethodKey =
    saved && validMethods.includes(saved as WithdrawalMethodKey)
      ? (saved as WithdrawalMethodKey)
      : "fire";

  const patrimonyTotal = (assetsIndicators?.total ?? 0) + bankAmount;
  const avgExpenses = expensesIndicators?.fire_avg ?? 0;
  const isDataLoading = isAssetsLoading || isBankLoading || isExpensesLoading;

  const { fixedIncomeTotal, variableIncomeTotal } = useMemo(() => {
    const data = (assetsReportData ?? []) as ReportAggregatedByTypeDataItem[];
    const fixed = data.find((d) => d.type === "Renda fixa BR")?.total ?? 0;
    const variable = data
      .filter((d) => ["Ação BR", "Ação EUA", "Cripto", "FII"].includes(d.type))
      .reduce((sum, d) => sum + d.total, 0);
    return { fixedIncomeTotal: fixed, variableIncomeTotal: variable };
  }, [assetsReportData]);

  const showGaleno = preferences?.show_galeno ?? false;
  const showAgeInBonds = preferences?.show_age_in_bonds ?? false;

  const handleSelect = (method: WithdrawalMethodKey) => {
    updatePreferences({ selected_method: method });
  };

  const handleToggleGaleno = (checked: boolean) => {
    updatePreferences({ show_galeno: checked });
  };

  const handleToggleAgeInBonds = (checked: boolean) => {
    updatePreferences({ show_age_in_bonds: checked });
  };

  const isGalenoChecked = (method: WithdrawalMethodKey) => {
    if (selectedMethod === method) return showGaleno;
    if (method === "fire") return localGalenoFire;
    if (method === "constant_withdrawal") return localGalenoConstant;
    if (method === "one_over_n") return localGalenoOneOverN;
    if (method === "vpw") return localGalenoVpw;
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
    } else if (method === "vpw") {
      setLocalGalenoVpw(checked);
    }
  };

  const isAgeInBondsChecked = (method: WithdrawalMethodKey) => {
    if (selectedMethod === method) return showAgeInBonds;
    if (method === "fire") return localAgeInBondsFire;
    if (method === "constant_withdrawal") return localAgeInBondsConstant;
    return false;
  };

  const handleAgeInBondsChange = (method: WithdrawalMethodKey, checked: boolean) => {
    if (selectedMethod === method) {
      handleToggleAgeInBonds(checked);
    } else if (method === "fire") {
      setLocalAgeInBondsFire(checked);
    } else if (method === "constant_withdrawal") {
      setLocalAgeInBondsConstant(checked);
    }
  };

  const ageInBondsToggle = (method: WithdrawalMethodKey) => {
    const checked = isAgeInBondsChecked(method);
    return (
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            onChange={(_, value) => handleAgeInBondsChange(method, value)}
            disabled={selectedMethod === method && isUpdating}
            size="small"
          />
        }
        label="Alocação Idade em Renda Fixa"
        slotProps={{ typography: { variant: "caption" } }}
      />
    );
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
        {isAgeInBondsChecked("fire") ? (
          <AgeInBondsIndicator
            patrimonyTotal={patrimonyTotal}
            avgExpenses={avgExpenses}
            isLoading={isDataLoading || isReportsLoading}
            dateOfBirth={dateOfBirth}
            fixedIncomeTotal={fixedIncomeTotal}
            variableIncomeTotal={variableIncomeTotal}
            withdrawalRate={ageInBondsWithdrawalRate}
            onWithdrawalRateChange={setAgeInBondsWithdrawalRate}
            stockReturn={ageInBondsStockReturn}
            onStockReturnChange={setAgeInBondsStockReturn}
            bondReturn={ageInBondsBondReturn}
            onBondReturnChange={setAgeInBondsBondReturn}
          />
        ) : (
          <FIREProgressBar
            patrimonyTotal={patrimonyTotal}
            avgExpenses={avgExpenses}
            isLoading={isDataLoading}
            withdrawalRate={fireWithdrawalRate}
            onWithdrawalRateChange={setFireWithdrawalRate}
          />
        )}
        {ageInBondsToggle("fire")}
        {!isAgeInBondsChecked("fire") && galenoToggle("fire")}
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
        {isAgeInBondsChecked("constant_withdrawal") ? (
          <ConstantDollarAgeInBondsIndicator
            patrimonyTotal={patrimonyTotal}
            avgExpenses={avgExpenses}
            isLoading={isDataLoading || isReportsLoading}
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
          />
        ) : (
          <ConstantDollarIndicator
            patrimonyTotal={patrimonyTotal}
            avgExpenses={avgExpenses}
            isLoading={isDataLoading}
            realReturn={realReturn}
            onRealReturnChange={setRealReturn}
            targetYears={targetYears}
            onTargetYearsChange={setTargetYears}
          />
        )}
        {ageInBondsToggle("constant_withdrawal")}
        {!isAgeInBondsChecked("constant_withdrawal") && galenoToggle("constant_withdrawal")}
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
        />
        {galenoToggle("one_over_n")}
      </>
    ),
    vpw: (
      <>
        <VPWIndicator
          patrimonyTotal={patrimonyTotal}
          avgExpenses={avgExpenses}
          isLoading={isDataLoading || isReportsLoading}
          dateOfBirth={dateOfBirth}
          fixedIncomeTotal={fixedIncomeTotal}
          variableIncomeTotal={variableIncomeTotal}
          targetAge={vpwTargetAge}
          onTargetAgeChange={setVpwTargetAge}
          stockReturn={vpwStockReturn}
          onStockReturnChange={setVpwStockReturn}
          bondReturn={vpwBondReturn}
          onBondReturnChange={setVpwBondReturn}
        />
        {galenoToggle("vpw")}
      </>
    ),
  };

  return (
    <Stack spacing={3} pb={3}>
      <Text weight={FontWeights.SEMI_BOLD}>Estratégias</Text>
      {METHODS.map((method) => (
        <MethodCard
          key={method.key}
          title={isAgeInBondsChecked(method.key) ? (AGE_IN_BONDS_TITLES[method.key]?.title ?? method.title) : method.title}
          subtitle={isAgeInBondsChecked(method.key) ? (AGE_IN_BONDS_TITLES[method.key]?.subtitle ?? method.subtitle) : method.subtitle}
          rationale={
            [
              method.rationale,
              isGalenoChecked(method.key) ? GALENO_RATIONALE : "",
              isAgeInBondsChecked(method.key) ? AGE_IN_BONDS_RATIONALE : "",
            ].filter(Boolean).join(" ")
          }
          pros={[
            ...method.pros,
            ...(isGalenoChecked(method.key) ? GALENO_PROS : []),
            ...(isAgeInBondsChecked(method.key) ? AGE_IN_BONDS_PROS : []),
          ]}
          cons={[
            ...method.cons,
            ...(isGalenoChecked(method.key) ? GALENO_CONS : []),
            ...(isAgeInBondsChecked(method.key) ? AGE_IN_BONDS_CONS : []),
          ]}
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
