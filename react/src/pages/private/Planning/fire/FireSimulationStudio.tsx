import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { historicalSourceForMonth } from "../../Home/firePortfolio";
import type { SamplingMethod } from "../../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "../api";
import type { FireAllocationBucket } from "../fireAllocation";
import { historicalPhases } from "./fireHistoricalDatasets";
import FireComparisonPanel from "./FireComparisonPanel";
import type { FireSimulationResult } from "../../Home/fireSimulation";
import FireResultsPanel from "./FireResultsPanel";
import type { FireCalculationState } from "./FireResultsSkeleton";
import FireScenarioPanel from "./FireScenarioPanel";
import SimulationStudioShell, {
  useStudioLayout,
} from "../shared/SimulationStudioShell";
import {
  buildFireStudioSnapshot,
  resubmitFireStudioSnapshot,
  type FireStudioDraft,
  type FireStudioSnapshot,
} from "./fireStudioScenario";

type Preferences = Required<FirePlanningPreferences>;

export type FireSimulationStudioProps = {
  renderHeader?: (recalculate: ReactNode) => ReactNode;
  renderExplanation?: (snapshot: FireStudioSnapshot | null) => ReactNode;
  draft: FireStudioDraft;
  allocation: readonly FireAllocationBucket[];
  firePreferences: Preferences;
  dateOfBirth: string | null;
  fixedIncomeTotal: number;
  variableIncomeTotal: number;
  isPersisting: boolean;
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
};

const FireSimulationStudio = ({
  draft,
  renderHeader,
  renderExplanation,
  allocation,
  firePreferences,
  dateOfBirth,
  fixedIncomeTotal,
  variableIncomeTotal,
  isPersisting,
  onSimulatedPatrimonyChange,
  onExpensesChange,
  onMonthlySavingsChange,
  onWithdrawalRateChange,
  onTargetYearsChange,
  onSamplingMethodChange,
  onShowAgeInBondsChange,
  onHistoricalPreferenceChange,
}: FireSimulationStudioProps) => {
  const draftSnapshot = useMemo(() => buildFireStudioSnapshot(draft), [draft]);
  const [submittedSnapshot, setSubmittedSnapshot] =
    useState<FireStudioSnapshot | null>(null);
  const [calculationState, setCalculationState] =
    useState<FireCalculationState>({
      isCalculating: draftSnapshot !== null && draftSnapshot.request !== null,
      error: null,
    });
  const [baselineResult, setBaselineResult] =
    useState<FireSimulationResult | null>(null);
  const [comparisonWithoutFallback, setComparisonWithoutFallback] =
    useState(false);
  const layout = useStudioLayout();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const historicalControlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (submittedSnapshot === null && draftSnapshot !== null) {
      setCalculationState({
        isCalculating: draftSnapshot.request !== null,
        error: null,
      });
      setSubmittedSnapshot(draftSnapshot);
    }
  }, [draftSnapshot, submittedSnapshot]);

  const handleCalculationStateChange = useCallback(
    (next: FireCalculationState) => {
      setCalculationState((current) =>
        current.isCalculating === next.isCalculating &&
        current.error === next.error
          ? current
          : next,
      );
    },
    [],
  );

  const hasFallbackHistory = useMemo(() => {
    if (!submittedSnapshot) return false;
    return historicalPhases(
      submittedSnapshot.portfolio,
      submittedSnapshot.showAgeInBonds,
    ).some(({ portfolio, months }) =>
      portfolio.some(
        (slice) =>
          slice.fallbackSeries &&
          months.some(
            (month) => historicalSourceForMonth(slice, month) !== slice.series,
          ),
      ),
    );
  }, [submittedSnapshot]);

  const canRecalculate = Boolean(
    draftSnapshot?.request &&
    !calculationState.isCalculating &&
    !isPersisting &&
    (calculationState.error ||
      JSON.stringify(draftSnapshot) !== JSON.stringify(submittedSnapshot)),
  );

  const handleRecalculate = () => {
    if (!canRecalculate) return;
    const next = resubmitFireStudioSnapshot(draft);
    setComparisonWithoutFallback(false);
    if (next === null) return;
    setCalculationState({
      isCalculating: next.request !== null,
      error: null,
    });
    setSubmittedSnapshot(next);
  };

  const handleAdjustHistoricalSources = () => {
    layout.openPanel();
    setAdvancedOpen(true);
  };

  return (
    <SimulationStudioShell
      layout={layout}
      testId="fire-simulation-studio"
      resultsId="fire-simulation-results"
      renderHeader={renderHeader}
      canRecalculate={canRecalculate}
      onRecalculate={handleRecalculate}
      renderPanel={(onCollapse) => (
        <FireScenarioPanel
          allocation={allocation}
          firePreferences={firePreferences}
          patrimonyTotal={draft.patrimonyTotal}
          simulatedPatrimony={draft.simulatedPatrimony}
          avgExpenses={draft.avgExpenses}
          expensesOverride={draft.expensesOverride}
          derivedMonthlySavings={draft.derivedMonthlySavings}
          monthlySavingsOverride={draft.monthlySavingsOverride}
          withdrawalRate={draft.withdrawalRate}
          targetYears={draft.targetYears}
          samplingMethod={draft.samplingMethod}
          showAgeInBonds={draft.showAgeInBonds}
          canRecalculate={canRecalculate}
          isCalculating={calculationState.isCalculating}
          isPersisting={isPersisting}
          advancedOpen={advancedOpen}
          historicalControlsRef={historicalControlsRef}
          onAdvancedOpenChange={setAdvancedOpen}
          onSimulatedPatrimonyChange={onSimulatedPatrimonyChange}
          onExpensesChange={onExpensesChange}
          onMonthlySavingsChange={onMonthlySavingsChange}
          onWithdrawalRateChange={onWithdrawalRateChange}
          onTargetYearsChange={onTargetYearsChange}
          onSamplingMethodChange={onSamplingMethodChange}
          onShowAgeInBondsChange={onShowAgeInBondsChange}
          onHistoricalPreferenceChange={onHistoricalPreferenceChange}
          onRecalculate={handleRecalculate}
          onCollapse={onCollapse}
        />
      )}
      hasFallbackHistory={hasFallbackHistory}
      comparisonOpen={comparisonWithoutFallback}
      comparisonDisabled={
        calculationState.isCalculating ||
        !baselineResult ||
        !submittedSnapshot?.request
      }
      onComparisonOpenChange={setComparisonWithoutFallback}
      comparison={
        submittedSnapshot &&
        baselineResult && (
          <FireComparisonPanel
            snapshot={submittedSnapshot}
            baseline={baselineResult}
          />
        )
      }
      results={
        <FireResultsPanel
          snapshot={submittedSnapshot}
          onSimulationResult={setBaselineResult}
          dateOfBirth={dateOfBirth}
          fixedIncomeTotal={fixedIncomeTotal}
          variableIncomeTotal={variableIncomeTotal}
          calculationState={calculationState}
          onCalculationStateChange={handleCalculationStateChange}
          onAdjustHistoricalSources={handleAdjustHistoricalSources}
        />
      }
      explanation={renderExplanation?.(draftSnapshot)}
    />
  );
};

export default FireSimulationStudio;
