import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";

import type { SamplingMethod } from "../../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "../api";
import type { FireAllocationBucket } from "../fireAllocation";
import FireResultsPanel from "./FireResultsPanel";
import type { FireCalculationState } from "./FireResultsSkeleton";
import FireScenarioPanel from "./FireScenarioPanel";
import {
  buildFireStudioSnapshot,
  resubmitFireStudioSnapshot,
  type FireStudioDraft,
  type FireStudioSnapshot,
} from "./fireStudioScenario";

type Preferences = Required<FirePlanningPreferences>;

export type FireSimulationStudioProps = {
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

  const handleRecalculate = () => {
    const next = resubmitFireStudioSnapshot(draft);
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
          sx={{ position: "sticky", top: 16, p: 1, borderRadius: 2 }}
        >
          <IconButton
            aria-label="Expandir cenário"
            onClick={() => setPanelCollapsed(false)}
          >
            <ChevronRightIcon />
          </IconButton>
        </Paper>
      ) : (
        <Stack gap={1} sx={{ position: "sticky", top: 16 }}>
          {scenarioPanel}
        </Stack>
      )}

      <FireResultsPanel
        snapshot={submittedSnapshot}
        dateOfBirth={dateOfBirth}
        fixedIncomeTotal={fixedIncomeTotal}
        variableIncomeTotal={variableIncomeTotal}
        calculationState={calculationState}
        onCalculationStateChange={handleCalculationStateChange}
        onAdjustHistoricalSources={handleAdjustHistoricalSources}
      />
    </Box>
  );
};

export default FireSimulationStudio;
