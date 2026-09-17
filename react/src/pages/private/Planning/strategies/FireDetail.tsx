import { useLayoutEffect, useMemo, useState } from "react";

import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";

import ConstantDollarAgeInBondsIndicator from "../../Home/ConstantDollarAgeInBondsIndicator";
import ConstantDollarIndicator from "../../Home/ConstantDollarIndicator";
import { buildPortfolio } from "../../Home/firePortfolio";
import type {
  CryptoProxy,
  GlobalEquityProxy,
  ReturnCategory,
  SamplingMethod,
  UsEquityProxy,
} from "../../Home/fireReturnTypes";
import AgeInBondsExplainer from "../AgeInBondsExplainer";
import {
  getFirePlanningPreferences,
  type PlanningPreferences,
} from "../api";
import DefaultsPanel from "../DefaultsPanel";
import FireHistoricalDataControls from "../FireHistoricalDataControls";
import {
  useFireAllocation,
  type FireAllocationBucket,
} from "../fireAllocation";
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
  const [samplingMethod, setSamplingMethod] = useState<SamplingMethod>(
    firePreferences.sampling_method,
  );
  const [usEquityProxy, setUsEquityProxy] = useState<UsEquityProxy>(
    firePreferences.us_equity_proxy,
  );
  const [globalEquityProxy, setGlobalEquityProxy] = useState<GlobalEquityProxy>(
    firePreferences.global_equity_proxy,
  );
  const [cryptoProxy, setCryptoProxy] = useState<CryptoProxy>(
    firePreferences.crypto_proxy,
  );
  const [excludedReturnCategories, setExcludedReturnCategories] = useState<
    ReturnCategory[]
  >(firePreferences.excluded_return_categories);
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
    setSamplingMethod(firePreferences.sampling_method);
    setUsEquityProxy(firePreferences.us_equity_proxy);
    setGlobalEquityProxy(firePreferences.global_equity_proxy);
    setCryptoProxy(firePreferences.crypto_proxy);
    setExcludedReturnCategories(firePreferences.excluded_return_categories);
  }, [
    firePreferences.crypto_proxy,
    firePreferences.excluded_return_categories,
    firePreferences.global_equity_proxy,
    firePreferences.monthly_expenses_override,
    firePreferences.sampling_method,
    firePreferences.target_years,
    firePreferences.us_equity_proxy,
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
  const { data: allocationData, isPending: isAllocationLoading } =
    useFireAllocation();
  const allocation = useMemo<FireAllocationBucket[]>(
    () => allocationData?.buckets ?? [],
    [allocationData?.buckets],
  );
  const patrimonyTotal = allocation.reduce((sum, bucket) => sum + bucket.total, 0);
  const isDataLoading = isCommonLoading || isAllocationLoading;
  const fixedIncomeTotal = allocation
    .filter((bucket) => bucket.category.startsWith("FIXED_"))
    .reduce((sum, bucket) => sum + bucket.total, 0);
  const variableIncomeTotal = allocation
    .filter(
      (bucket) =>
        bucket.category !== "CASH" && !bucket.category.startsWith("FIXED_"),
    )
    .reduce((sum, bucket) => sum + bucket.total, 0);

  const localFirePreferences = useMemo(
    () => ({
      withdrawal_rate: withdrawalRate,
      target_years: targetYears,
      monthly_expenses_override: expensesOverride,
      sampling_method: samplingMethod,
      us_equity_proxy: usEquityProxy,
      global_equity_proxy: globalEquityProxy,
      crypto_proxy: cryptoProxy,
      excluded_return_categories: excludedReturnCategories,
    }),
    [
      cryptoProxy,
      excludedReturnCategories,
      expensesOverride,
      globalEquityProxy,
      samplingMethod,
      targetYears,
      usEquityProxy,
      withdrawalRate,
    ],
  );
  const portfolio = useMemo(
    () => buildPortfolio(allocation, localFirePreferences),
    [allocation, localFirePreferences],
  );

  const isDirty = useMemo(
    () =>
      isActive &&
      !!planningData &&
      (withdrawalRate !== firePreferences.withdrawal_rate ||
        targetYears !== firePreferences.target_years ||
        expensesOverride !== firePreferences.monthly_expenses_override ||
        samplingMethod !== firePreferences.sampling_method ||
        usEquityProxy !== firePreferences.us_equity_proxy ||
        globalEquityProxy !== firePreferences.global_equity_proxy ||
        cryptoProxy !== firePreferences.crypto_proxy ||
        JSON.stringify(excludedReturnCategories) !==
          JSON.stringify(firePreferences.excluded_return_categories) ||
        showAgeInBonds !== (preferences?.show_age_in_bonds ?? false)),
    [
      isActive,
      planningData,
      cryptoProxy,
      excludedReturnCategories,
      firePreferences.monthly_expenses_override,
      firePreferences.sampling_method,
      firePreferences.target_years,
      firePreferences.us_equity_proxy,
      firePreferences.global_equity_proxy,
      firePreferences.crypto_proxy,
      firePreferences.excluded_return_categories,
      globalEquityProxy,
      firePreferences.withdrawal_rate,
      preferences,
      withdrawalRate,
      targetYears,
      expensesOverride,
      samplingMethod,
      usEquityProxy,
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
        sampling_method: samplingMethod,
        us_equity_proxy: usEquityProxy,
        global_equity_proxy: globalEquityProxy,
        crypto_proxy: cryptoProxy,
        excluded_return_categories: excludedReturnCategories,
      },
      show_age_in_bonds: showAgeInBonds,
    };
    updatePreferences(patch);
  };

  const displayTitle = showAgeInBonds
    ? (AGE_IN_BONDS_TITLES[METHOD]?.title ?? content.title)
    : content.title;

  const monthlySavings = monthlySavingsOverride ?? derivedMonthlySavings;

  const historicalDataControls = (
    <FireHistoricalDataControls
      allocation={allocation}
      preferences={localFirePreferences}
      onChange={(field, value) => {
        if (field === "us_equity_proxy") setUsEquityProxy(value as UsEquityProxy);
        if (field === "global_equity_proxy") {
          setGlobalEquityProxy(value as GlobalEquityProxy);
        }
        if (field === "crypto_proxy") setCryptoProxy(value as CryptoProxy);
        if (field === "excluded_return_categories") {
          setExcludedReturnCategories(value as ReturnCategory[]);
        }
      }}
    />
  );

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
      portfolio={portfolio}
      samplingMethod={samplingMethod}
      onSamplingMethodChange={setSamplingMethod}
      historicalDataControls={historicalDataControls}
      fixedIncomeTotal={fixedIncomeTotal}
      variableIncomeTotal={variableIncomeTotal}
      monthlySavings={monthlySavings}
      defaultMonthlySavings={derivedMonthlySavings}
      onMonthlySavingsChange={setMonthlySavingsOverride}
      onMonthlySavingsReset={() => setMonthlySavingsOverride(null)}
      isMonthlySavingsOverridden={monthlySavingsOverride !== null}
      simulatedExpenses={expensesOverride}
      onSimulatedExpensesChange={setExpensesOverride}
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
      portfolio={portfolio}
      samplingMethod={samplingMethod}
      onSamplingMethodChange={setSamplingMethod}
      historicalDataControls={historicalDataControls}
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
