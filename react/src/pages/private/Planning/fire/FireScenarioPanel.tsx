import { useState, type RefObject } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";

import {
  Colors,
  getColor,
  InfoIconTooltip,
  FontSizes,
  FontWeights,
  Text,
} from "../../../../design-system";
import type { SamplingMethod } from "../../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "../api";
import type { FireAllocationBucket } from "../fireAllocation";

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
  const [assumptionsExpanded, setAssumptionsExpanded] = useState(false);
  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;
  const effectiveExpenses = expensesOverride ?? avgExpenses;
  const effectiveMonthlySavings =
    monthlySavingsOverride ?? derivedMonthlySavings;

  return (
    <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
      <Stack gap={2}>
        <Stack gap={0.25}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
          >
            <Text size={FontSizes.MEDIUM} weight={FontWeights.SEMI_BOLD}>
              Seu cenário
            </Text>
            {onCollapse && (
              <Button
                variant="brand-text"
                size="small"
                aria-label="Recolher cenário"
                onClick={onCollapse}
                sx={{
                  minWidth: 28,
                  width: 28,
                  height: 28,
                  p: 0,
                  flexShrink: 0,
                }}
              >
                <ChevronLeftIcon fontSize="small" />
              </Button>
            )}
          </Stack>
          <Text size={FontSizes.EXTRA_SMALL}>
            Edite os valores e recalcule quando estiver pronto.
          </Text>
        </Stack>

        <FireScenarioNumberInput
          label="Patrimônio"
          value={effectivePatrimony}
          step={100_000}
          prefix="R$ "
          disabled={isPersisting}
          onChange={onSimulatedPatrimonyChange}
          onReset={
            simulatedPatrimony !== null
              ? () => onSimulatedPatrimonyChange(null)
              : undefined
          }
        />
        <FireScenarioNumberInput
          label="Despesas mensais"
          value={effectiveExpenses}
          step={500}
          prefix="R$ "
          disabled={isPersisting}
          onChange={onExpensesChange}
          onReset={
            expensesOverride !== null ? () => onExpensesChange(null) : undefined
          }
        />
        <FireScenarioNumberInput
          label="Aportes mensais"
          value={Math.max(0, effectiveMonthlySavings)}
          step={500}
          prefix="R$ "
          disabled={isPersisting}
          onChange={onMonthlySavingsChange}
          onReset={
            monthlySavingsOverride !== null
              ? () => onMonthlySavingsChange(null)
              : undefined
          }
        />
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

        <Accordion
          expanded={assumptionsExpanded || advancedOpen}
          onChange={(_, expanded) => setAssumptionsExpanded(expanded)}
          disableGutters
          elevation={0}
          sx={{
            background: "transparent",
            minWidth: 0,
            "&::before": { display: "none" },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon fontSize="small" />}
            sx={{
              px: 0,
              minHeight: 32,
              "&.Mui-expanded": { minHeight: 32 },
              "& .MuiAccordionSummary-content": { my: 0.5 },
              "& .MuiAccordionSummary-content.Mui-expanded": { my: 0.5 },
            }}
          >
            <Text size={FontSizes.EXTRA_SMALL}>Premissas avançadas</Text>
          </AccordionSummary>
          <AccordionDetails
            sx={{
              mt: 0.5,
              p: 1.5,
              backgroundColor: getColor(Colors.neutral800),
              border: `1px solid ${getColor(Colors.neutral600)}`,
              borderRadius: 1.5,
            }}
          >
            <Stack gap={1.5}>
              <Stack gap={0.5}>
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
                    onHistoricalPreferenceChange(
                      "extra_accumulation_years",
                      value,
                    )
                  }
                />
              </Stack>
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
              <Stack direction="row" alignItems="center" gap={0.5}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={samplingMethod === "contiguous_12_month_blocks"}
                      onChange={(_, checked) =>
                        onSamplingMethodChange(
                          checked
                            ? "contiguous_12_month_blocks"
                            : "independent_months",
                        )
                      }
                    />
                  }
                  disableTypography
                  sx={{
                    m: 0,
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "nowrap",
                    alignItems: "center",
                    gap: 0.5,
                    "& .MuiSwitch-root": { flexShrink: 0 },
                  }}
                  label={
                    <Text
                      component="span"
                      size={FontSizes.EXTRA_SMALL}
                      extraStyle={{ minWidth: 0 }}
                    >
                      Preservar sequências históricas de 12 meses
                    </Text>
                  }
                />
                <Text
                  component="span"
                  size={FontSizes.EXTRA_SMALL}
                  extraStyle={{ display: "inline-flex", flexShrink: 0 }}
                >
                  <InfoIconTooltip text="Usa trechos reais de 12 meses para manter sequências de altas e quedas na simulação. Do contrário, mistura meses isolados do histórico. Exemplo: pode sortear março de 2008 a fevereiro de 2009, mantendo os 12 meses nessa ordem. Sem essa opção, março de 2008 pode ser seguido por julho de 2015." />
                </Text>
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={showAgeInBonds}
                    onChange={(_, checked) => onShowAgeInBondsChange(checked)}
                  />
                }
                disableTypography
                sx={{
                  m: 0,
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "nowrap",
                  alignItems: "center",
                  gap: 0.5,
                  "& .MuiSwitch-root": { flexShrink: 0 },
                }}
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
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Button
          variant="contained"
          color="success"
          fullWidth
          disabled={isCalculating || isPersisting || !canRecalculate}
          onClick={onRecalculate}
        >
          {isCalculating ? "Recalculando…" : "Recalcular"}
        </Button>
      </Stack>
    </Paper>
  );
};

export default FireScenarioPanel;
