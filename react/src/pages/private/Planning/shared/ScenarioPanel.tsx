import { useState, type ReactNode } from "react";
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
import FireScenarioNumberInput from "../fire/FireScenarioNumberInput";

type AmountField = {
  value: number;
  isOverridden: boolean;
  onChange: (value: number | null) => void;
};

type Props = {
  patrimony: AmountField;
  expenses: AmountField & { tooltip?: string };
  monthlySavings: AmountField & { allowNegative?: boolean };
  // Strategy-specific inputs rendered after the shared amounts.
  fields?: ReactNode;
  // Strategy-specific advanced inputs rendered before the sampling switch.
  advanced?: ReactNode;
  // Rendered after the sampling switch.
  advancedFooter?: ReactNode;
  forceAdvancedOpen?: boolean;
  samplingMethod: SamplingMethod;
  onSamplingMethodChange: (value: SamplingMethod) => void;
  canRecalculate: boolean;
  isCalculating: boolean;
  isPersisting: boolean;
  onRecalculate: () => void;
  onCollapse?: () => void;
};

export const switchLabelSx = {
  m: 0,
  display: "flex",
  flexDirection: "row",
  flexWrap: "nowrap",
  alignItems: "center",
  gap: 0.5,
  "& .MuiSwitch-root": { flexShrink: 0 },
} as const;

const ScenarioPanel = ({
  patrimony,
  expenses,
  monthlySavings,
  fields,
  advanced,
  advancedFooter,
  forceAdvancedOpen = false,
  samplingMethod,
  onSamplingMethodChange,
  canRecalculate,
  isCalculating,
  isPersisting,
  onRecalculate,
  onCollapse,
}: Props) => {
  const [assumptionsExpanded, setAssumptionsExpanded] = useState(false);

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
          value={patrimony.value}
          step={100_000}
          prefix="R$ "
          disabled={isPersisting}
          onChange={patrimony.onChange}
          onReset={
            patrimony.isOverridden ? () => patrimony.onChange(null) : undefined
          }
        />
        <FireScenarioNumberInput
          label="Despesas mensais"
          tooltip={expenses.tooltip}
          value={expenses.value}
          step={500}
          prefix="R$ "
          disabled={isPersisting}
          onChange={expenses.onChange}
          onReset={
            expenses.isOverridden ? () => expenses.onChange(null) : undefined
          }
        />
        <FireScenarioNumberInput
          label="Aportes mensais"
          value={
            monthlySavings.allowNegative
              ? monthlySavings.value
              : Math.max(0, monthlySavings.value)
          }
          allowNegative={monthlySavings.allowNegative}
          min={monthlySavings.allowNegative ? -Number.MAX_VALUE : 0}
          step={500}
          prefix="R$ "
          disabled={isPersisting}
          onChange={monthlySavings.onChange}
          onReset={
            monthlySavings.isOverridden
              ? () => monthlySavings.onChange(null)
              : undefined
          }
        />
        {fields}

        <Accordion
          expanded={assumptionsExpanded || forceAdvancedOpen}
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
              {advanced}
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
                  sx={switchLabelSx}
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
              {advancedFooter}
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

export default ScenarioPanel;
