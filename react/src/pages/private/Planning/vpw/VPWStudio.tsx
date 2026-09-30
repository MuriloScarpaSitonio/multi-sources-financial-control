import { useEffect, useMemo, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import VPWComparisonPanel from "./VPWComparisonPanel";
import { historicalSourceForMonth } from "../../Home/firePortfolio";
import { FontSizes, Text } from "../../../../design-system";
import type { VPWPlanningPreferences } from "../api";
import { buildVPWPortfolio } from "../../Home/vpwPortfolio";
import { useFireSimulationWorker } from "../../Home/useFireSimulationWorker";
import FireHistoricalSettings from "../fire/FireHistoricalSettings";
import FireScenarioNumberInput from "../fire/FireScenarioNumberInput";
import FireResultsSkeleton from "../fire/FireResultsSkeleton";
import ScenarioPanel from "../shared/ScenarioPanel";
import SimulationStudioShell, {
  useStudioLayout,
} from "../shared/SimulationStudioShell";
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
  renderExplanation?: (snapshot: VPWSnapshot | null) => ReactNode;
};
export default function VPWStudio({
  draft,
  isPersisting,
  dataError = false,
  onPreferencesChange: change,
  onPatrimonyChange,
  renderHeader,
  renderExplanation,
}: Props) {
  const layout = useStudioLayout();
  const [historyOpen, setHistoryOpen] = useState(false);
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
  return (
    <SimulationStudioShell
      layout={layout}
      testId="vpw-simulation-studio"
      resultsId="vpw-simulation-results"
      renderHeader={renderHeader}
      canRecalculate={canRecalculate}
      onRecalculate={recalculate}
      renderPanel={(onCollapse) => (
        <ScenarioPanel
          patrimony={{
            value: draft.simulatedPatrimony ?? modeled.investmentTotal,
            isOverridden: draft.simulatedPatrimony !== null,
            onChange: onPatrimonyChange,
          }}
          expenses={{
            value: p.monthly_expenses_override ?? draft.avgExpenses,
            isOverridden: p.monthly_expenses_override !== null,
            onChange: (value) => change({ monthly_expenses_override: value }),
            tooltip:
              "Valor mensal que você pretende retirar dos investimentos. É o teto de cada saque.",
          }}
          monthlySavings={{
            value: p.monthly_savings_override ?? draft.monthlySavings,
            isOverridden: p.monthly_savings_override !== null,
            onChange: (value) => change({ monthly_savings_override: value }),
          }}
          fields={
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
          }
          forceAdvancedOpen={historyOpen}
          advanced={
            <>
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
                onChange={(value) =>
                  change({ extra_accumulation_years: value })
                }
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
            </>
          }
          samplingMethod={p.sampling_method}
          onSamplingMethodChange={(sampling_method) =>
            change({ sampling_method })
          }
          advancedFooter={
            modeled.investmentTotal === 0 && (
              <Text size={FontSizes.EXTRA_SMALL}>
                Sem investimentos cadastrados: carteira de referência de{" "}
                {modeled.stockPct.toFixed(0)}% IBOV e{" "}
                {(100 - modeled.stockPct).toFixed(0)}% CDI.
              </Text>
            )
          }
          canRecalculate={canRecalculate}
          isCalculating={worker.isCalculating}
          isPersisting={isPersisting}
          onRecalculate={recalculate}
          onCollapse={onCollapse}
        />
      )}
      hasFallbackHistory={Boolean(hasFallbackHistory)}
      comparisonOpen={comparison}
      comparisonDisabled={
        worker.isCalculating || !worker.result || Boolean(worker.error)
      }
      onComparisonOpenChange={setComparison}
      comparison={
        submitted &&
        worker.result && (
          <VPWComparisonPanel
            snapshot={submitted}
            baseline={worker.result.output}
          />
        )
      }
      results={
        <Paper
          elevation={1}
          sx={{ p: { xs: 2, md: 3 }, minWidth: 0, borderRadius: 2 }}
        >
          {dataError ? (
            <Alert severity="error">
              Não foi possível carregar os dados do cenário. Recarregue a página
              para tentar novamente.
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
      }
      explanation={renderExplanation?.(current.snapshot)}
    />
  );
}
