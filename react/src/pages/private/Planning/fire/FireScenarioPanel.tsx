import type { RefObject } from "react";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";

import { FontSizes, Text } from "../../../../design-system";
import type { SamplingMethod } from "../../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "../api";
import type { FireAllocationBucket } from "../fireAllocation";
import ScenarioPanel, { switchLabelSx } from "../shared/ScenarioPanel";

import FireHistoricalSettings from "./FireHistoricalSettings";
import FireScenarioNumberInput from "./FireScenarioNumberInput";

type Preferences = Required<FirePlanningPreferences>;

export type FireScenarioPanelProps = {
  allocation: readonly FireAllocationBucket[];
  firePreferences: Preferences;
  patrimonyTotal: number;
  simulatedPatrimony: number | null;
  avgExpenses: number;
  expensesOverride: number | null;
  derivedMonthlySavings: number;
  monthlySavingsOverride: number | null;
  withdrawalRate: number;
  targetYears: number;
  samplingMethod: SamplingMethod;
  showAgeInBonds: boolean;
  canRecalculate?: boolean;
  isCalculating: boolean;
  isPersisting: boolean;
  advancedOpen: boolean;
  historicalControlsRef: RefObject<HTMLDivElement>;
  onAdvancedOpenChange: (open: boolean) => void;
  onSimulatedPatrimonyChange: (value: number | null) => void;
  onExpensesChange: (value: number | null) => void;
  onMonthlySavingsChange: (value: number | null) => void;
  onWithdrawalRateChange: (value: number) => void;
  onTargetYearsChange: (value: number) => void;
  onSamplingMethodChange: (value: SamplingMethod) => void;
  onShowAgeInBondsChange: (value: boolean) => void;
  onHistoricalPreferenceChange: <K extends keyof Preferences>(
    field: K,
    value: Preferences[K],
  ) => void;
  onRecalculate: () => void;
  onCollapse?: () => void;
};

const FireScenarioPanel = ({
  allocation,
  firePreferences,
  patrimonyTotal,
  simulatedPatrimony,
  avgExpenses,
  expensesOverride,
  derivedMonthlySavings,
  monthlySavingsOverride,
  withdrawalRate,
  targetYears,
  samplingMethod,
  showAgeInBonds,
  canRecalculate = true,
  isCalculating,
  isPersisting,
  advancedOpen,
  historicalControlsRef,
  onAdvancedOpenChange,
  onSimulatedPatrimonyChange,
  onExpensesChange,
  onMonthlySavingsChange,
  onWithdrawalRateChange,
  onTargetYearsChange,
  onSamplingMethodChange,
  onShowAgeInBondsChange,
  onHistoricalPreferenceChange,
  onRecalculate,
  onCollapse,
}: FireScenarioPanelProps) => {
  return (
    <ScenarioPanel
      patrimony={{
        value: simulatedPatrimony ?? patrimonyTotal,
        isOverridden: simulatedPatrimony !== null,
        onChange: onSimulatedPatrimonyChange,
      }}
      expenses={{
        value: expensesOverride ?? avgExpenses,
        isOverridden: expensesOverride !== null,
        onChange: onExpensesChange,
      }}
      monthlySavings={{
        value: monthlySavingsOverride ?? derivedMonthlySavings,
        isOverridden: monthlySavingsOverride !== null,
        onChange: onMonthlySavingsChange,
      }}
      fields={
        <>
          <FireScenarioNumberInput
            label="Taxa de retirada"
            value={withdrawalRate}
            step={0.25}
            min={2}
            max={6}
            suffix="% a.a."
            disabled={isPersisting}
            onChange={onWithdrawalRateChange}
          />
          <FireScenarioNumberInput
            label="Horizonte"
            value={targetYears}
            step={1}
            min={20}
            max={80}
            suffix=" anos"
            decimalScale={0}
            disabled={isPersisting}
            onChange={onTargetYearsChange}
          />
        </>
      }
      forceAdvancedOpen={advancedOpen}
      advanced={
        <>
          <FireScenarioNumberInput
            label="Anos extras de acumulação"
            tooltip="Após atingir a meta FIRE, continue aportando por esse período antes de começar as retiradas."
            value={firePreferences.extra_accumulation_years}
            step={1}
            min={0}
            max={60}
            suffix=" anos"
            decimalScale={0}
            disabled={isPersisting}
            onChange={(value) =>
              onHistoricalPreferenceChange("extra_accumulation_years", value)
            }
          />
          <FireHistoricalSettings
            allocation={allocation}
            preferences={firePreferences}
            showAgeInBonds={showAgeInBonds}
            open={advancedOpen}
            onOpenChange={onAdvancedOpenChange}
            controlsRef={historicalControlsRef}
            onApply={(overrides, fallbacks) => {
              onHistoricalPreferenceChange(
                "historical_series_overrides",
                overrides,
              );
              onHistoricalPreferenceChange(
                "historical_series_fallbacks",
                fallbacks,
              );
            }}
          />
        </>
      }
      samplingMethod={samplingMethod}
      onSamplingMethodChange={onSamplingMethodChange}
      advancedFooter={
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showAgeInBonds}
              onChange={(_, checked) => onShowAgeInBondsChange(checked)}
            />
          }
          disableTypography
          sx={switchLabelSx}
          label={
            <Text
              component="span"
              size={FontSizes.EXTRA_SMALL}
              extraStyle={{ minWidth: 0 }}
            >
              Alocação Idade em Renda Fixa
            </Text>
          }
        />
      }
      canRecalculate={canRecalculate}
      isCalculating={isCalculating}
      isPersisting={isPersisting}
      onRecalculate={onRecalculate}
      onCollapse={onCollapse}
    />
  );
};

export default FireScenarioPanel;
