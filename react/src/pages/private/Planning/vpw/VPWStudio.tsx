import { useEffect, useMemo, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import VPWComparisonPanel from "./VPWComparisonPanel";
import { historicalSourceForMonth } from "../../Home/firePortfolio";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { FontSizes, FontWeights, Text } from "../../../../design-system";
import type { VPWPlanningPreferences } from "../api";
import { buildVPWPortfolio } from "../../Home/vpwPortfolio";
import { useFireSimulationWorker } from "../../Home/useFireSimulationWorker";
import FireHistoricalSettings from "../fire/FireHistoricalSettings";
import FireScenarioNumberInput from "../fire/FireScenarioNumberInput";
import FireResultsSkeleton from "../fire/FireResultsSkeleton";
import {
  buildVPWSnapshot,
  type VPWDraft,
  type VPWSnapshot,
} from "./vpwScenario";
import VPWResults from "./VPWResults";
import { VPW_SCENARIO_ERRORS } from "../../Home/vpwErrors";

type Props = {
  draft: VPWDraft;
  isPersisting: boolean;
  dataError?: boolean;
  onPreferencesChange: (patch: VPWPlanningPreferences) => void;
  onPatrimonyChange: (value: number | null) => void;
  renderHeader?: (action: ReactNode) => ReactNode;
};
export default function VPWStudio({
  draft,
  isPersisting,
  dataError = false,
  onPreferencesChange: change,
  onPatrimonyChange,
  renderHeader,
}: Props) {
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("md"),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const current = useMemo(() => {
    try {
      return { snapshot: buildVPWSnapshot(draft), error: null };
    } catch (error) {
      return {
        snapshot: null,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar o cenário.",
      };
    }
  }, [draft]);
  const [submitted, setSubmitted] = useState<VPWSnapshot | null>(null);
  useEffect(() => {
    if (!submitted && current.snapshot) setSubmitted(current.snapshot);
  }, [current.snapshot, submitted]);
  const [comparison, setComparison] = useState(false);
  const hasFallbackHistory = submitted?.portfolio.some(
    (slice) =>
      slice.fallbackSeries &&
      submitted.historyMonths.some(
        (month) => historicalSourceForMonth(slice, month) !== slice.series,
      ),
  );
  const worker = useFireSimulationWorker(submitted?.request ?? null);
  const canRecalculate = Boolean(
    current.snapshot &&
    !worker.isCalculating &&
    !isPersisting &&
    (worker.error ||
      JSON.stringify(current.snapshot) !== JSON.stringify(submitted)),
  );
  const recalculate = () => {
    if (canRecalculate) {
      setComparison(false);
      setSubmitted(buildVPWSnapshot(draft));
    }
  };
  const p = draft.preferences;
  const modeled = useMemo(
    () => buildVPWPortfolio(draft.allocation, p),
    [draft.allocation, p],
  );
  const ageLimit = draft.currentAge !== null && draft.currentAge >= 105;
  const minimumAge = Math.min(105, Math.max(70, (draft.currentAge ?? 0) + 1));
  const panel = (
    <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
      <Stack gap={2}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Text size={FontSizes.MEDIUM} weight={FontWeights.SEMI_BOLD}>
            Seu cenário
          </Text>
          {!isMobile && (
            <Button
              aria-label="Recolher cenário"
              variant="brand-text"
              sx={{ minWidth: 28, p: 0 }}
              onClick={() => setCollapsed(true)}
            >
              <ChevronLeftIcon />
            </Button>
          )}
        </Stack>
        <Text size={FontSizes.EXTRA_SMALL}>
          Edite os valores e recalcule quando estiver pronto.
        </Text>
        <FireScenarioNumberInput
          label="Patrimônio"
          value={draft.simulatedPatrimony ?? modeled.investmentTotal}
          step={100000}
          prefix="R$ "
          disabled={isPersisting}
          onChange={onPatrimonyChange}
          onReset={
            draft.simulatedPatrimony !== null
              ? () => onPatrimonyChange(null)
              : undefined
          }
        />
        <FireScenarioNumberInput
          label="Despesas mensais"
          tooltip="Valor mensal que você pretende retirar dos investimentos. É o teto de cada saque."
          value={p.monthly_expenses_override ?? draft.avgExpenses}
          step={500}
          prefix="R$ "
          disabled={isPersisting}
          onChange={(value) => change({ monthly_expenses_override: value })}
          onReset={
            p.monthly_expenses_override !== null
              ? () => change({ monthly_expenses_override: null })
              : undefined
          }
        />
        <FireScenarioNumberInput
          label="Aportes mensais"
          value={Math.max(
            0,
            p.monthly_savings_override ?? draft.monthlySavings,
          )}
          step={500}
          prefix="R$ "
          disabled={isPersisting}
          onChange={(value) => change({ monthly_savings_override: value })}
          onReset={
            p.monthly_savings_override !== null
              ? () => change({ monthly_savings_override: null })
              : undefined
          }
        />
        <FireScenarioNumberInput
          label="Idade alvo"
          value={p.target_age}
          step={1}
          min={minimumAge}
          max={105}
          suffix=" anos"
          decimalScale={0}
          disabled={isPersisting || ageLimit}
          onChange={(value) => change({ target_age: value })}
        />
        <Button
          variant="brand-text"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          Premissas avançadas
        </Button>
        {advancedOpen && (
          <Stack gap={2}>
            <FireScenarioNumberInput
              label="Anos extras de acumulação"
              tooltip="Após atingir a meta VPW, continue aportando por esse período antes de começar as retiradas. A idade alvo permanece a mesma."
              value={p.extra_accumulation_years}
              step={1}
              min={0}
              max={Math.min(
                60,
                Math.max(0, p.target_age - (draft.currentAge ?? 0) - 1),
              )}
              suffix=" anos"
              decimalScale={0}
              disabled={isPersisting}
              onChange={(value) => change({ extra_accumulation_years: value })}
            />
            <FireHistoricalSettings
              allocation={modeled.modeledAllocation}
              showAmounts={false}
              preferences={p}
              showAgeInBonds={false}
              open={historyOpen}
              onOpenChange={setHistoryOpen}
              onApply={(
                historical_series_overrides,
                historical_series_fallbacks,
              ) =>
                change({
                  historical_series_overrides,
                  historical_series_fallbacks,
                })
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={p.sampling_method === "contiguous_12_month_blocks"}
                  onChange={(_, checked) =>
                    change({
                      sampling_method: checked
                        ? "contiguous_12_month_blocks"
                        : "independent_months",
                    })
                  }
                />
              }
              label={
                <Text size={FontSizes.EXTRA_SMALL}>
                  Preservar sequências históricas de 12 meses
                </Text>
              }
            />
            {modeled.investmentTotal === 0 && (
              <Text size={FontSizes.EXTRA_SMALL}>
                Sem investimentos cadastrados: carteira de referência de{" "}
                {modeled.stockPct.toFixed(0)}% IBOV e{" "}
                {(100 - modeled.stockPct).toFixed(0)}% CDI.
              </Text>
            )}
          </Stack>
        )}
        <Button
          variant="contained"
          color="success"
          fullWidth
          disabled={!canRecalculate}
          onClick={recalculate}
        >
          {worker.isCalculating ? "Recalculando…" : "Recalcular"}
        </Button>
      </Stack>
    </Paper>
  );
  return (
    <>
      {renderHeader?.(
        canRecalculate ? (
          <Button variant="brand" size="small" onClick={recalculate}>
            Recalcular
          </Button>
        ) : null,
      )}
      <Box
        data-testid="vpw-simulation-studio"
        data-panel-collapsed={collapsed}
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: collapsed ? "56px minmax(0, 1fr)" : "360px minmax(0, 1fr)",
          },
          gap: 2,
          alignItems: "start",
        }}
      >
        {isMobile ? (
          <Stack gap={1}>
            <Button variant="outlined" onClick={() => setMobileOpen((v) => !v)}>
              {mobileOpen ? "Ocultar cenário" : "Editar cenário"}
            </Button>
            {mobileOpen && panel}
          </Stack>
        ) : collapsed ? (
          <Paper sx={{ p: 1, position: "sticky", top: 80 }}>
            <Button
              aria-label="Expandir cenário"
              sx={{ minWidth: 28, p: 0 }}
              onClick={() => setCollapsed(false)}
            >
              <ChevronRightIcon />
            </Button>
          </Paper>
        ) : (
          panel
        )}
        <Stack gap={1} sx={{ minWidth: 0 }}>
          {hasFallbackHistory && (
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                size="small"
                variant="brand"
                label="Histórico complementado"
              />
              <Button
                variant="brand-text"
                size="small"
                disabled={
                  !comparison &&
                  (worker.isCalculating ||
                    !worker.result ||
                    Boolean(worker.error))
                }
                onClick={() => setComparison((value) => !value)}
              >
                {comparison ? "Fechar comparação" : "Comparar sem complemento"}
              </Button>
            </Stack>
          )}
          {comparison && submitted && worker.result && (
            <VPWComparisonPanel
              snapshot={submitted}
              baseline={worker.result.output}
            />
          )}
          <Paper
            elevation={1}
            sx={{
              p: { xs: 2, md: 3 },
              minWidth: 0,
              borderRadius: 2,
              display: comparison ? "none" : "block",
            }}
          >
            {dataError ? (
              <Alert severity="error">
                Não foi possível carregar os dados do cenário. Recarregue a
                página para tentar novamente.
              </Alert>
            ) : current.error ? (
              <Alert severity="warning">{current.error}</Alert>
            ) : !draft.isReady ? (
              <FireResultsSkeleton />
            ) : draft.currentAge === null ? (
              <Alert severity="info">
                Cadastre sua data de nascimento no perfil para calcular o VPW.
              </Alert>
            ) : worker.error ? (
              <Alert severity="error">
                {Object.values(VPW_SCENARIO_ERRORS).some(
                  (message) => message === worker.error,
                )
                  ? worker.error
                  : "Não foi possível recalcular a simulação. Seus valores foram preservados; tente novamente."}
              </Alert>
            ) : !submitted || worker.isCalculating || !worker.result ? (
              <FireResultsSkeleton />
            ) : (
              <VPWResults snapshot={submitted} output={worker.result.output} />
            )}
          </Paper>
        </Stack>
      </Box>
    </>
  );
}
