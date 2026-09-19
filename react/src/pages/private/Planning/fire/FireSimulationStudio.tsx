import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";

import { historicalSourceForMonth } from "../../Home/firePortfolio";
import type { SamplingMethod } from "../../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "../api";
import type { FireAllocationBucket } from "../fireAllocation";
import { historicalPhases } from "./fireHistoricalDatasets";
import FireResultsPanel from "./FireResultsPanel";
import type { FireCalculationState } from "./FireResultsSkeleton";
import FireScenarioPanel from "./FireScenarioPanel";
import {
  buildFireStudioSnapshot,
  withoutHistoricalFallbacks,
  resubmitFireStudioSnapshot,
  type FireStudioDraft,
  type FireStudioSnapshot,
} from "./fireStudioScenario";

type Preferences = Required<FirePlanningPreferences>;

export type FireSimulationStudioProps = {
  renderHeader?: (recalculate: ReactNode) => ReactNode;
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
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("md"),
  );
  const draftSnapshot = useMemo(() => buildFireStudioSnapshot(draft), [draft]);
  const [submittedSnapshot, setSubmittedSnapshot] =
    useState<FireStudioSnapshot | null>(null);
  const [calculationState, setCalculationState] =
    useState<FireCalculationState>({
      isCalculating: draftSnapshot !== null && draftSnapshot.request !== null,
      error: null,
    });
  const [comparisonWithoutFallback, setComparisonWithoutFallback] =
    useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
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

  const displayedSnapshot = useMemo(
    () =>
      submittedSnapshot && comparisonWithoutFallback
        ? withoutHistoricalFallbacks(submittedSnapshot)
        : submittedSnapshot,
    [submittedSnapshot, comparisonWithoutFallback],
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
    setPanelCollapsed(false);
    setMobilePanelOpen(true);
    setAdvancedOpen(true);
  };

  const scenarioPanel = (
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
      onCollapse={isMobile ? undefined : () => setPanelCollapsed(true)}
    />
  );

  return (
    <>
      {renderHeader?.(
        <Button
          size="small"
          variant="brand"
          disabled={!canRecalculate}
          onClick={handleRecalculate}
        >
          {calculationState.isCalculating ? "Recalculando…" : "Recalcular"}
        </Button>,
      )}
      <Box
        data-testid="fire-simulation-studio"
        data-panel-collapsed={panelCollapsed}
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: panelCollapsed ? "56px minmax(0, 1fr)" : "360px minmax(0, 1fr)",
          },
          gap: 2,
          alignItems: "start",
        }}
      >
        {isMobile ? (
          <Stack gap={1}>
            <Button
              variant="outlined"
              onClick={() => setMobilePanelOpen((open) => !open)}
            >
              {mobilePanelOpen ? "Ocultar cenário" : "Editar cenário"}
            </Button>
            {mobilePanelOpen && scenarioPanel}
          </Stack>
        ) : panelCollapsed ? (
          <Paper
            elevation={1}
            sx={{
              position: "sticky",
              top: 80,
              p: 1,
              borderRadius: 2,
            }}
          >
            <IconButton
              aria-label="Expandir cenário"
              onClick={() => setPanelCollapsed(false)}
            >
              <ChevronRightIcon />
            </IconButton>
          </Paper>
        ) : (
          <Stack
            gap={1}
            sx={{
              position: "sticky",
              top: 80,
            }}
          >
            {scenarioPanel}
          </Stack>
        )}

        <Stack gap={1} sx={{ minWidth: 0 }}>
          {hasFallbackHistory && (
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                size="small"
                variant="brand"
                label={
                  comparisonWithoutFallback
                    ? "Sem complemento"
                    : "Histórico complementado"
                }
              />
              <Button
                variant="brand-text"
                size="small"
                disabled={
                  calculationState.isCalculating || !submittedSnapshot?.request
                }
                onClick={() => {
                  setCalculationState({ isCalculating: true, error: null });
                  setComparisonWithoutFallback((current) => !current);
                }}
              >
                {comparisonWithoutFallback
                  ? "Voltar ao histórico complementado"
                  : "Comparar sem complemento"}
              </Button>
            </Stack>
          )}
          <FireResultsPanel
            snapshot={displayedSnapshot}
            dateOfBirth={dateOfBirth}
            fixedIncomeTotal={fixedIncomeTotal}
            variableIncomeTotal={variableIncomeTotal}
            calculationState={calculationState}
            onCalculationStateChange={handleCalculationStateChange}
            onAdjustHistoricalSources={handleAdjustHistoricalSources}
          />
        </Stack>
      </Box>
    </>
  );
};

export default FireSimulationStudio;
