import type { RefObject } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";

import { FontSizes, FontWeights, Text } from "../../../../design-system";
import ExpenseSimulator from "../../Home/ExpenseSimulator";
import PatrimonySimulator from "../../Home/PatrimonySimulator";
import PersistedSlider from "../../Home/PersistedSlider";
import SavingsSimulator from "../../Home/SavingsSimulator";
import type { SamplingMethod } from "../../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "../api";
import FireHistoricalDataControls from "../FireHistoricalDataControls";
import type { FireAllocationBucket } from "../fireAllocation";

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
};

const compactSimulatorSx = {
  "& > .MuiStack-root": {
    alignItems: "stretch",
    flexDirection: "column",
    gap: 1,
  },
  "& .MuiTextField-root, & .MuiSlider-root": {
    width: "100%",
  },
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
}: FireScenarioPanelProps) => {
  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;
  const effectiveExpenses = expensesOverride ?? avgExpenses;
  const effectiveMonthlySavings =
    monthlySavingsOverride ?? derivedMonthlySavings;

  return (
    <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
      <Stack gap={2}>
        <Stack gap={0.25}>
          <Text size={FontSizes.MEDIUM} weight={FontWeights.SEMI_BOLD}>
            Seu cenário
          </Text>
          <Text size={FontSizes.EXTRA_SMALL}>
            Edite os valores e recalcule quando estiver pronto.
          </Text>
        </Stack>

        <Box sx={compactSimulatorSx}>
          <PatrimonySimulator
            value={effectivePatrimony}
            onChange={onSimulatedPatrimonyChange}
            onReset={() => onSimulatedPatrimonyChange(null)}
            patrimonyTotal={patrimonyTotal}
            showReset={simulatedPatrimony !== null}
            isPersisting={isPersisting}
          />
        </Box>
        <Box sx={compactSimulatorSx}>
          <ExpenseSimulator
            value={effectiveExpenses}
            onChange={onExpensesChange}
            onReset={() => onExpensesChange(null)}
            avgMonthlyExpenses={avgExpenses}
            showReset={expensesOverride !== null}
            isPersisting={isPersisting}
          />
        </Box>
        <Box sx={compactSimulatorSx}>
          <SavingsSimulator
            value={Math.max(0, effectiveMonthlySavings)}
            onChange={onMonthlySavingsChange}
            onReset={() => onMonthlySavingsChange(null)}
            avgMonthlySavings={Math.max(0, derivedMonthlySavings)}
            showReset={monthlySavingsOverride !== null}
            isPersisting={isPersisting}
          />
        </Box>

        <Stack gap={1}>
          <PersistedSlider
            value={withdrawalRate}
            onChange={onWithdrawalRateChange}
            renderLabel={(value) => (
              <Text size={FontSizes.EXTRA_SMALL}>
                Taxa de retirada: {value}% a.a.
              </Text>
            )}
            min={2}
            max={6}
            step={0.5}
            marks
            isPersisting={isPersisting}
          />
        </Stack>

        <Stack gap={1}>
          <PersistedSlider
            value={targetYears}
            onChange={onTargetYearsChange}
            renderLabel={(value) => (
              <Text size={FontSizes.EXTRA_SMALL}>
                Horizonte de aposentadoria: {value} anos
              </Text>
            )}
            min={20}
            max={80}
            step={5}
            marks
            isPersisting={isPersisting}
          />
        </Stack>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={samplingMethod === "contiguous_12_month_blocks"}
              onChange={(_, checked) =>
                onSamplingMethodChange(
                  checked ? "contiguous_12_month_blocks" : "independent_months",
                )
              }
            />
          }
          label="Preservar sequências históricas de 12 meses"
        />

        <Accordion
          expanded={advancedOpen}
          onChange={(_, expanded) => onAdvancedOpenChange(expanded)}
          disableGutters
          elevation={0}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Text size={FontSizes.SMALL} weight={FontWeights.MEDIUM}>
              Premissas avançadas
            </Text>
          </AccordionSummary>
          {advancedOpen && (
            <AccordionDetails>
              <Stack gap={2}>
                <FireHistoricalDataControls
                  allocation={allocation}
                  preferences={firePreferences}
                  onChange={onHistoricalPreferenceChange}
                  showShortPeriodWarning={false}
                  controlsRef={historicalControlsRef}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={showAgeInBonds}
                      onChange={(_, checked) => onShowAgeInBondsChange(checked)}
                    />
                  }
                  label="Alocação Idade em Renda Fixa"
                />
              </Stack>
            </AccordionDetails>
          )}
        </Accordion>

        <Button
          variant="contained"
          color="success"
          fullWidth
          disabled={isCalculating}
          onClick={onRecalculate}
        >
          {isCalculating ? "Recalculando…" : "Recalcular"}
        </Button>
      </Stack>
    </Paper>
  );
};

export default FireScenarioPanel;
