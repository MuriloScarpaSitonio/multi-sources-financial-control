import { useLayoutEffect, useMemo, useState } from "react";

import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

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
import { getFirePlanningPreferences, type PlanningPreferences } from "../api";
import DefaultsPanel from "../DefaultsPanel";
import FireHistoricalSettings from "../fire/FireHistoricalSettings";
import {
  useFireAllocation,
  type FireAllocationBucket,
} from "../fireAllocation";
import FireMethodologyWalkthrough from "../FireMethodologyWalkthrough";
import FireSimulationStudio from "../fire/FireSimulationStudio";
import type { FireStudioDraft } from "../fire/fireStudioScenario";
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

const ageFromDateOfBirth = (dateOfBirth: string | null): number | null => {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
};

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

  const [withdrawalRate, setWithdrawalRate] = useState(
    firePreferences.withdrawal_rate,
  );
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
  const [historicalSeriesOverrides, setHistoricalSeriesOverrides] = useState(
    firePreferences.historical_series_overrides,
  );
  const [showAgeInBonds, setShowAgeInBonds] = useState(
    preferences?.show_age_in_bonds ?? false,
  );
  // Local what-if state — never persisted (no FIRE monthly_savings field).
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(
    null,
  );
  const [monthlySavingsOverride, setMonthlySavingsOverride] = useState<
    number | null
  >(null);
  const [historicalDrawerOpen, setHistoricalDrawerOpen] = useState(false);
  const [view, setView] = useState<"legacy" | "new">("new");

  useLayoutEffect(() => {
    setWithdrawalRate(firePreferences.withdrawal_rate);
    setTargetYears(firePreferences.target_years);
    setExpensesOverride(firePreferences.monthly_expenses_override);
    setSamplingMethod(firePreferences.sampling_method);
    setUsEquityProxy(firePreferences.us_equity_proxy);
    setGlobalEquityProxy(firePreferences.global_equity_proxy);
    setCryptoProxy(firePreferences.crypto_proxy);
    setExcludedReturnCategories(firePreferences.excluded_return_categories);
    setHistoricalSeriesOverrides(firePreferences.historical_series_overrides);
  }, [
    firePreferences.historical_series_overrides,
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
  const patrimonyTotal = allocation.reduce(
    (sum, bucket) => sum + bucket.total,
    0,
  );
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
      historical_series_overrides: historicalSeriesOverrides,
    }),
    [
      cryptoProxy,
      historicalSeriesOverrides,
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
      (JSON.stringify(historicalSeriesOverrides) !==
        JSON.stringify(firePreferences.historical_series_overrides) ||
        withdrawalRate !== firePreferences.withdrawal_rate ||
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
      historicalSeriesOverrides,
      excludedReturnCategories,
      firePreferences.historical_series_overrides,
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
        historical_series_overrides: historicalSeriesOverrides,
      },
      show_age_in_bonds: showAgeInBonds,
    };
    updatePreferences(patch);
  };

  const displayTitle = showAgeInBonds
    ? (AGE_IN_BONDS_TITLES[METHOD]?.title ?? content.title)
    : content.title;

  const monthlySavings = monthlySavingsOverride ?? derivedMonthlySavings;

  const handleHistoricalPreferenceChange = <
    K extends keyof typeof localFirePreferences,
  >(
    field: K,
    value: (typeof localFirePreferences)[K],
  ) => {
    if (field === "historical_series_overrides")
      setHistoricalSeriesOverrides(value as typeof historicalSeriesOverrides);
    if (field === "us_equity_proxy") {
      setUsEquityProxy(value as UsEquityProxy);
    }
    if (field === "global_equity_proxy") {
      setGlobalEquityProxy(value as GlobalEquityProxy);
    }
    if (field === "crypto_proxy") setCryptoProxy(value as CryptoProxy);
    if (field === "excluded_return_categories") {
      setExcludedReturnCategories(value as ReturnCategory[]);
    }
  };

  const historicalDataControls = (
    <FireHistoricalSettings
      allocation={allocation}
      preferences={localFirePreferences}
      showAgeInBonds={showAgeInBonds}
      open={historicalDrawerOpen}
      onOpenChange={setHistoricalDrawerOpen}
      onApply={setHistoricalSeriesOverrides}
    />
  );

  const studioDraft = useMemo<FireStudioDraft>(
    () => ({
      isReady: !isDataLoading,
      showAgeInBonds,
      currentAge: ageFromDateOfBirth(dateOfBirth),
      patrimonyTotal,
      simulatedPatrimony,
      avgExpenses,
      expensesOverride,
      derivedMonthlySavings,
      monthlySavingsOverride,
      withdrawalRate,
      targetYears,
      samplingMethod,
      portfolio,
    }),
    [
      avgExpenses,
      dateOfBirth,
      derivedMonthlySavings,
      expensesOverride,
      isDataLoading,
      monthlySavingsOverride,
      patrimonyTotal,
      portfolio,
      samplingMethod,
      showAgeInBonds,
      simulatedPatrimony,
      targetYears,
      withdrawalRate,
    ],
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
      simulatedPatrimony={simulatedPatrimony}
      onSimulatedPatrimonyChange={setSimulatedPatrimony}
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
        actions={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, next: "legacy" | "new" | null) => {
              if (next) setView(next);
            }}
            aria-label="Visualização FIRE"
          >
            <ToggleButton value="legacy">Legacy</ToggleButton>
            <ToggleButton value="new">New</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      {view === "legacy" ? (
        <Paper
          data-testid="fire-legacy-view"
          elevation={1}
          sx={{ p: 3, borderRadius: 2 }}
        >
          {indicator}
        </Paper>
      ) : (
        <FireSimulationStudio
          draft={studioDraft}
          allocation={allocation}
          firePreferences={localFirePreferences}
          dateOfBirth={dateOfBirth}
          fixedIncomeTotal={fixedIncomeTotal}
          variableIncomeTotal={variableIncomeTotal}
          isPersisting={isUpdating}
          onSimulatedPatrimonyChange={setSimulatedPatrimony}
          onExpensesChange={setExpensesOverride}
          onMonthlySavingsChange={setMonthlySavingsOverride}
          onWithdrawalRateChange={setWithdrawalRate}
          onTargetYearsChange={setTargetYears}
          onSamplingMethodChange={setSamplingMethod}
          onShowAgeInBondsChange={setShowAgeInBonds}
          onHistoricalPreferenceChange={handleHistoricalPreferenceChange}
        />
      )}

      {(view === "new" || showAgeInBonds) && (
        <DefaultsPanel
          items={content.defaultsExplained}
          extra={<FireMethodologyWalkthrough />}
        />
      )}

      {view === "legacy" && (
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
      )}

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
