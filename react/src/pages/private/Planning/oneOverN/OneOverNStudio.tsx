import { useEffect, useMemo, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import OneOverNComparisonPanel from "./OneOverNComparisonPanel";
import { historicalSourceForMonth } from "../../Home/firePortfolio";
import { FontSizes, Text } from "../../../../design-system";
import type { OneOverNPlanningPreferences } from "../api";
import { useFireSimulationWorker } from "../../Home/useFireSimulationWorker";
import FireHistoricalSettings from "../fire/FireHistoricalSettings";
import FireScenarioNumberInput from "../fire/FireScenarioNumberInput";
import FireResultsSkeleton from "../fire/FireResultsSkeleton";
import ScenarioPanel from "../shared/ScenarioPanel";
import SimulationStudioShell, {
  useStudioLayout,
} from "../shared/SimulationStudioShell";
import {
  buildOneOverNSnapshot,
  type OneOverNDraft,
  type OneOverNSnapshot,
} from "./oneOverNScenario";
import OneOverNResults from "./OneOverNResults";

type Props = {
  draft: OneOverNDraft;
  isPersisting: boolean;
  dataError?: boolean;
  onPreferencesChange: (patch: OneOverNPlanningPreferences) => void;
  onPatrimonyChange: (value: number | null) => void;
  renderHeader?: (action: ReactNode) => ReactNode;
  renderExplanation?: (
    snapshot: OneOverNSnapshot | null,
    output:
      | import("../../Home/oneOverNSimulation").OneOverNSimulationOutput
      | null,
  ) => ReactNode;
  onRetryData: () => void;
};
export default function OneOverNStudio({
  draft,
  isPersisting,
  dataError = false,
  onPreferencesChange: change,
  onPatrimonyChange,
  renderHeader,
  renderExplanation,
  onRetryData,
}: Props) {
  const layout = useStudioLayout();
  const [historyOpen, setHistoryOpen] = useState(false);
  const current = useMemo(() => {
    try {
      return { snapshot: buildOneOverNSnapshot(draft), error: null };
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
  const [submitted, setSubmitted] = useState<OneOverNSnapshot | null>(null);
  useEffect(() => {
    if (!submitted && current.snapshot && !dataError)
      setSubmitted(current.snapshot);
  }, [current.snapshot, submitted, dataError]);
  const [comparison, setComparison] = useState(false);
  const dataAvailable = !dataError && draft.isReady;
  const comparisonOpen = comparison && dataAvailable;
  useEffect(() => {
    if (!dataAvailable) setComparison(false);
  }, [dataAvailable]);
  const hasFallbackHistory = submitted?.portfolio.some(
    (slice) =>
      slice.fallbackSeries &&
      submitted.historyMonths.some(
        (month) => historicalSourceForMonth(slice, month) !== slice.series,
      ),
  );
  const worker = useFireSimulationWorker(
    dataAvailable ? (submitted?.request ?? null) : null,
  );
  const canRecalculate = Boolean(
    dataAvailable &&
    current.snapshot &&
    !worker.isCalculating &&
    !isPersisting &&
    (worker.error ||
      JSON.stringify(current.snapshot) !== JSON.stringify(submitted)),
  );
  const recalculate = () => {
    if (canRecalculate) {
      setComparison(false);
      setSubmitted(buildOneOverNSnapshot(draft));
    }
  };
  const p = draft.preferences;
  const modeled = useMemo(
    () => ({
      investmentTotal: draft.allocation.reduce(
        (sum, b) => sum + Math.max(0, b.total),
        0,
      ),
      modeledAllocation:
        current.snapshot?.modeledAllocation ?? draft.allocation,
    }),
    [draft.allocation, current.snapshot],
  );
  const ageLimit = draft.currentAge !== null && draft.currentAge >= 105;
  const minimumAge = Math.min(105, Math.max(70, (draft.currentAge ?? 0) + 1));
  const signedSavings = p.monthly_savings_override ?? draft.monthlySavings;
  return (
    <SimulationStudioShell
      layout={layout}
      testId="one-over-n-simulation-studio"
      resultsId="one-over-n-simulation-results"
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
              "Referência para avaliar a cobertura dos gastos. O 1/N retira e gasta o valor integral calculado, mesmo acima das despesas.",
          }}
          monthlySavings={{
            allowNegative: true,
            value: p.monthly_savings_override ?? draft.monthlySavings,
            isOverridden: p.monthly_savings_override !== null,
            onChange: (value) => change({ monthly_savings_override: value }),
          }}
          fields={
            <>
              <FireScenarioNumberInput
                label="Idade alvo"
                value={p.target_depletion_age}
                step={1}
                min={minimumAge}
                max={105}
                suffix=" anos"
                decimalScale={0}
                disabled={isPersisting || ageLimit}
                onChange={(value) => change({ target_depletion_age: value })}
              />
              {signedSavings < 0 && (
                <Text size={FontSizes.EXTRA_SMALL}>
                  Déficit mensal:{" "}
                  {Math.abs(signedSavings).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  . Esse fluxo negativo é preservado na simulação.
                </Text>
              )}
            </>
          }
          forceAdvancedOpen={historyOpen}
          advanced={
            <>
              <FireScenarioNumberInput
                label="Anos extras de acumulação"
                tooltip="Após atingir a meta 1/N, continue aportando por esse período antes de começar as retiradas. A idade alvo permanece a mesma."
                value={p.extra_accumulation_years}
                step={1}
                min={0}
                max={Math.min(
                  60,
                  Math.max(
                    0,
                    p.target_depletion_age - (draft.currentAge ?? 0) - 1,
                  ),
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
                Sem investimentos cadastrados: carteira de referência de 60%
                IBOV e 40% CDI.
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
      comparisonOpen={comparisonOpen}
      comparisonDisabled={
        !dataAvailable ||
        worker.isCalculating ||
        !worker.result ||
        Boolean(worker.error)
      }
      onComparisonOpenChange={setComparison}
      comparison={
        comparisonOpen &&
        submitted &&
        worker.result && (
          <OneOverNComparisonPanel
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
              Não foi possível carregar os dados do cenário.
              <Button size="small" onClick={onRetryData}>
                Tentar novamente
              </Button>
            </Alert>
          ) : current.error ? (
            <Alert severity="warning">{current.error}</Alert>
          ) : !draft.isReady ? (
            <FireResultsSkeleton />
          ) : draft.currentAge === null ? (
            <Alert severity="info">
              Cadastre sua data de nascimento no perfil para calcular o 1/N.
            </Alert>
          ) : worker.error ? (
            <Alert severity="error">
              {worker.error ||
                "Não foi possível recalcular a simulação. Seus valores foram preservados; tente novamente."}
            </Alert>
          ) : !submitted || worker.isCalculating || !worker.result ? (
            <FireResultsSkeleton />
          ) : (
            <OneOverNResults
              snapshot={submitted}
              output={worker.result.output}
            />
          )}
        </Paper>
      }
      explanation={renderExplanation?.(
        dataAvailable ? submitted : null,
        dataAvailable && !worker.isCalculating && !worker.error
          ? (worker.result?.output ?? null)
          : null,
      )}
    />
  );
}
