import type { ReactNode } from "react";
import { FontSizes } from "../../../../design-system";
import { useLayoutEffect, useMemo, useState } from "react";

import Stack from "@mui/material/Stack";

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
  const [historicalSeriesFallbacks, setHistoricalSeriesFallbacks] = useState(
    firePreferences.historical_series_fallbacks,
  );
  const [showAgeInBonds, setShowAgeInBonds] = useState(
    preferences?.show_age_in_bonds ?? false,
  );
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(
    firePreferences.simulated_patrimony,
  );
  const [monthlySavingsOverride, setMonthlySavingsOverride] = useState<
    number | null
  >(null);

  useLayoutEffect(() => {
    setSimulatedPatrimony(firePreferences.simulated_patrimony);
    setWithdrawalRate(firePreferences.withdrawal_rate);
    setTargetYears(firePreferences.target_years);
    setExpensesOverride(firePreferences.monthly_expenses_override);
    setSamplingMethod(firePreferences.sampling_method);
    setUsEquityProxy(firePreferences.us_equity_proxy);
    setGlobalEquityProxy(firePreferences.global_equity_proxy);
    setCryptoProxy(firePreferences.crypto_proxy);
    setExcludedReturnCategories(firePreferences.excluded_return_categories);
    setHistoricalSeriesOverrides(firePreferences.historical_series_overrides);
    setHistoricalSeriesFallbacks(firePreferences.historical_series_fallbacks);
  }, [
    firePreferences.simulated_patrimony,
    firePreferences.historical_series_overrides,
    firePreferences.historical_series_fallbacks,
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
      simulated_patrimony: simulatedPatrimony,
      monthly_expenses_override: expensesOverride,
      sampling_method: samplingMethod,
      us_equity_proxy: usEquityProxy,
      global_equity_proxy: globalEquityProxy,
      crypto_proxy: cryptoProxy,
      excluded_return_categories: excludedReturnCategories,
      historical_series_overrides: historicalSeriesOverrides,
      historical_series_fallbacks: historicalSeriesFallbacks,
    }),
    [
      cryptoProxy,
      historicalSeriesOverrides,
      historicalSeriesFallbacks,
      excludedReturnCategories,
      simulatedPatrimony,
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
      (JSON.stringify(historicalSeriesFallbacks) !==
        JSON.stringify(firePreferences.historical_series_fallbacks) ||
        JSON.stringify(historicalSeriesOverrides) !==
          JSON.stringify(firePreferences.historical_series_overrides) ||
        simulatedPatrimony !== firePreferences.simulated_patrimony ||
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
      historicalSeriesFallbacks,
      excludedReturnCategories,
      firePreferences.historical_series_overrides,
      firePreferences.historical_series_fallbacks,
      firePreferences.simulated_patrimony,
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
      simulatedPatrimony,
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
        simulated_patrimony: simulatedPatrimony,
        monthly_expenses_override: expensesOverride,
        sampling_method: samplingMethod,
        us_equity_proxy: usEquityProxy,
        global_equity_proxy: globalEquityProxy,
        crypto_proxy: cryptoProxy,
        excluded_return_categories: excludedReturnCategories,
        historical_series_overrides: historicalSeriesOverrides,
        historical_series_fallbacks: historicalSeriesFallbacks,
      },
      show_age_in_bonds: showAgeInBonds,
    };
    updatePreferences(patch);
  };

  const displayTitle = showAgeInBonds
    ? (AGE_IN_BONDS_TITLES[METHOD]?.title ?? content.title)
    : content.title;

  const handleHistoricalPreferenceChange = <
    K extends keyof typeof localFirePreferences,
  >(
    field: K,
    value: (typeof localFirePreferences)[K],
  ) => {
    if (field === "historical_series_fallbacks")
      setHistoricalSeriesFallbacks(value as typeof historicalSeriesFallbacks);
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

  const renderHeader = (recalculate?: ReactNode) => (
    <StrategyHeader
      sticky
      title={displayTitle}
      titleSize={FontSizes.REGULAR}
      isActive={isActive}
      isMutating={isUpdating}
      onSelect={handleSelect}
      isDirty={isDirty}
      onSave={handleSave}
      activeBadgeByTitle
      actions={recalculate}
    />
  );

  return (
    <Stack spacing={3} pb={3}>
      <FireSimulationStudio
        renderHeader={renderHeader}
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
      <DefaultsPanel
        items={content.defaultsExplained}
        extra={<FireMethodologyWalkthrough />}
      />

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
