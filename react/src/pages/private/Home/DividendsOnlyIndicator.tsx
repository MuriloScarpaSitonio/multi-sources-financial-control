import { useMemo, useState } from "react";

import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";
import { BarChartCreditedAndProvisionedWithAvg } from "../Incomes/Reports/charts";
import { useIncomesHistoric } from "../Incomes/Reports/hooks";
import { useHomeRevenuesIndicators } from "../Revenues/hooks/useRevenuesIndicators";
import {
  TYPICAL_DIVIDEND_YIELD,
  TYPICAL_TRAILING_IPCA_PCT,
} from "./consts";
import ExpenseSimulator from "./ExpenseSimulator";
import PatrimonySimulator from "./PatrimonySimulator";
import PersistedSlider from "./PersistedSlider";
import SavingsSimulator from "./SavingsSimulator";

// Format months as "~Xa Ym" or "~Xa" or "~Ym".
const formatMonthsAsDuration = (months: number): string => {
  if (!isFinite(months)) return "nunca";
  if (months <= 0) return "agora";
  if (months < 12) {
    const m = Math.max(1, Math.ceil(months));
    return `~${m} ${m === 1 ? "mês" : "meses"}`;
  }
  const years = Math.floor(months / 12);
  const rem = Math.round(months - years * 12);
  if (rem === 0) return `~${years} ano${years === 1 ? "" : "s"}`;
  return `~${years}a ${rem}m`;
};

const formatMonthsAsCompactDuration = (months: number): string => {
  if (!isFinite(months)) return "nunca";
  if (months <= 0) return "agora";
  if (months < 12) {
    const m = Math.max(1, Math.ceil(months));
    return `~${m}m`;
  }
  const years = Math.floor(months / 12);
  const rem = Math.round(months - years * 12);
  if (rem === 0) return `~${years}a`;
  return `~${years}a ${rem}m`;
};

const ProgressBar = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral600),
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 10,
    backgroundColor:
      value && value >= 100 ? getColor(Colors.brand) : getColor(Colors.danger200),
  },
}));

type DividendsOnlyIndicatorProps = {
  avgPassiveIncome: number;
  avgExpenses: number;
  patrimonyTotal: number;
  isLoading: boolean;
  compact?: boolean;
  hideLabel?: boolean;
  persistEnabled?: boolean;
  isPersisting?: boolean;
  simulatedYield?: number | null;
  onSimulatedYieldChange?: (value: number | null) => void;
  simulatedSavings?: number | null;
  onSimulatedSavingsChange?: (value: number | null) => void;
  simulatedExpenses?: number | null;
  onSimulatedExpensesChange?: (value: number | null) => void;
};

const DividendsOnlyIndicator = ({
  avgPassiveIncome,
  avgExpenses,
  patrimonyTotal,
  isLoading,
  compact = false,
  hideLabel = false,
  persistEnabled = false,
  isPersisting = false,
  simulatedYield: controlledSimulatedYield,
  onSimulatedYieldChange,
  simulatedSavings: controlledSimulatedSavings,
  onSimulatedSavingsChange,
  simulatedExpenses: controlledSimulatedExpenses,
  onSimulatedExpensesChange,
}: DividendsOnlyIndicatorProps) => {
  const { hideValues } = useHideValues();
  const currentYield = patrimonyTotal > 0 ? (avgPassiveIncome * 12 / patrimonyTotal) * 100 : 6;
  const [localSimulatedYield, setLocalSimulatedYield] = useState<number | null>(null);
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);
  const [localSimulatedSavings, setLocalSimulatedSavings] = useState<number | null>(null);
  const [localSimulatedExpenses, setLocalSimulatedExpenses] = useState<number | null>(null);
  const [windowYears, setWindowYears] = useState(3);
  const simulatedYield =
    controlledSimulatedYield !== undefined
      ? controlledSimulatedYield
      : localSimulatedYield;
  const simulatedSavings =
    controlledSimulatedSavings !== undefined
      ? controlledSimulatedSavings
      : localSimulatedSavings;
  const simulatedExpenses =
    controlledSimulatedExpenses !== undefined
      ? controlledSimulatedExpenses
      : localSimulatedExpenses;
  const setSimulatedYield = (value: number | null) => {
    if (onSimulatedYieldChange) onSimulatedYieldChange(value);
    else setLocalSimulatedYield(value);
  };
  const setSimulatedSavings = (value: number | null) => {
    if (onSimulatedSavingsChange) onSimulatedSavingsChange(value);
    else setLocalSimulatedSavings(value);
  };
  const setSimulatedExpenses = (value: number | null) => {
    if (onSimulatedExpensesChange) onSimulatedExpensesChange(value);
    else setLocalSimulatedExpenses(value);
  };
  const effectiveYield = simulatedYield ?? currentYield;
  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;
  // Forward-looking only: coverage %, required patrimony, time-to-goal use this.
  // Historical diagnostics (Pior trimestre, Cobertura média, YoY) intentionally stay anchored
  // to the real avgExpenses so they don't shift counterfactually with the slider.
  const effectiveExpenses = simulatedExpenses ?? avgExpenses;

  const { data: revenuesIndicators } = useHomeRevenuesIndicators();
  const avgRevenues = revenuesIndicators?.avg ?? 0;
  const defaultSavings = Math.max(0, avgRevenues - avgExpenses);
  const monthlySavings = simulatedSavings ?? defaultSavings;

  const simulatedMonthlyIncome = (effectivePatrimony * (effectiveYield / 100)) / 12;
  const displayIncome = simulatedPatrimony !== null || simulatedYield !== null
    ? simulatedMonthlyIncome
    : avgPassiveIncome;
  const coveragePercentage =
    effectiveExpenses > 0 ? (displayIncome / effectiveExpenses) * 100 : 0;

  // Historical passive income, window controlled by the user (windowYears).
  const { historyStartDate, historyEndDate } = useMemo(() => {
    const now = new Date();
    const months = windowYears * 12;
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { historyStartDate: start, historyEndDate: end };
  }, [windowYears]);

  const { data: historicData, isPending: isHistoricLoading } = useIncomesHistoric({
    startDate: historyStartDate,
    endDate: historyEndDate,
    aggregatePeriod: "month",
  });

  const history = historicData?.historic ?? [];

  const monthsAboveExpenses = useMemo(
    () =>
      avgExpenses > 0
        ? history.filter((h) => h.credited >= avgExpenses).length
        : 0,
    [history, avgExpenses],
  );

  // Diagnostics on the actual history window. Sorted ascending by date so
  // rolling-window and YoY comparisons are chronological. API returns
  // "DD/MM/YYYY"; we reorder to "YYYYMMDD" via split/reverse for lex sort.
  const diagnostics = useMemo(() => {
    if (history.length === 0 || avgExpenses <= 0) return null;

    const sorted = [...history].sort((a, b) => {
      const ka = (a.month ?? "").split("/").reverse().join("");
      const kb = (b.month ?? "").split("/").reverse().join("");
      return ka.localeCompare(kb);
    });

    const coverages = sorted.map((h) => (h.credited / avgExpenses) * 100);
    const meanCoverage =
      coverages.reduce((s, c) => s + c, 0) / coverages.length;
    const variance =
      coverages.reduce((s, c) => s + (c - meanCoverage) ** 2, 0) /
      coverages.length;
    const stdevCoverage = Math.sqrt(variance);

    let worstQuarterCoverage: number | null = null;
    if (sorted.length >= 3) {
      let minSum = Infinity;
      for (let i = 0; i <= sorted.length - 3; i++) {
        const sum =
          sorted[i].credited + sorted[i + 1].credited + sorted[i + 2].credited;
        if (sum < minSum) minSum = sum;
      }
      worstQuarterCoverage = (minSum / (3 * avgExpenses)) * 100;
    }

    let yoyDeltaPct: number | null = null;
    // Need at least one full prior year (12m) plus some recent months to compare.
    // Use the most recent 12m vs the 12m before that (require >=6m of prior).
    if (sorted.length >= 18) {
      const recent = sorted.slice(-12);
      const priorEnd = sorted.length - 12;
      const priorStart = Math.max(0, priorEnd - 12);
      const prior = sorted.slice(priorStart, priorEnd);
      if (prior.length >= 6) {
        const recentAvg =
          recent.reduce((s, h) => s + h.credited, 0) / recent.length;
        const priorAvg =
          prior.reduce((s, h) => s + h.credited, 0) / prior.length;
        if (priorAvg > 0) {
          yoyDeltaPct = ((recentAvg - priorAvg) / priorAvg) * 100;
        }
      }
    }

    const yoyRealDeltaPct =
      yoyDeltaPct !== null
        ? ((1 + yoyDeltaPct / 100) / (1 + TYPICAL_TRAILING_IPCA_PCT / 100) - 1) * 100
        : null;

    return {
      meanCoverage,
      stdevCoverage,
      worstQuarterCoverage,
      yoyDeltaPct,
      yoyRealDeltaPct,
    };
  }, [history, avgExpenses]);

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const avgPassiveIncomeFormatted = hideValues
    ? "***"
    : formatCurrency(avgPassiveIncome);
  const avgExpensesFormatted = hideValues ? "***" : formatCurrency(avgExpenses);
  const tooltipTitle = `Viver apenas de proventos: média mensal de proventos (${avgPassiveIncomeFormatted}) / média mensal de despesas FIRE (${avgExpensesFormatted}). Meta: 100% para cobrir todas as despesas apenas com dividendos e proventos.`;

  const requiredPatrimony =
    effectiveYield > 0
      ? (effectiveExpenses * 12) / (effectiveYield / 100)
      : 0;

  // Months until effectivePatrimony reaches requiredPatrimony, given monthlySavings + reinvested yield.
  // Formula: t = ln((goal + c/r) / (current + c/r)) / ln(1+r), where r = yield/12.
  // Treats yield as the compounding rate — i.e., assumes asset prices stay flat in real terms
  // (conservative bound — see "Entenda esses valores").
  const monthsToGoal = (() => {
    if (effectivePatrimony >= requiredPatrimony) return 0;
    if (requiredPatrimony <= 0) return 0;
    const r = effectiveYield / 100 / 12;
    const c = monthlySavings;
    const p0 = effectivePatrimony;
    const goal = requiredPatrimony;
    if (r <= 0 && c <= 0) return Infinity;
    if (r <= 0) return (goal - p0) / c;
    if (c <= 0) {
      if (p0 <= 0) return Infinity;
      return Math.log(goal / p0) / Math.log(1 + r);
    }
    return Math.log((goal + c / r) / (p0 + c / r)) / Math.log(1 + r);
  })();

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <ProgressBar
            variant="determinate"
            value={Math.min(coveragePercentage, 100)}
          />
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              transform: "translateY(-50%)",
              px: 1.5,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
            }}
          >
            {!hideLabel && (
              <Text
                color={Colors.neutral0}
                weight={FontWeights.MEDIUM}
                size={FontSizes.SEMI_SMALL}
              >
                Viver de proventos
              </Text>
            )}
            {hideValues ? (
              <Skeleton
                sx={{
                  bgcolor: getColor(Colors.neutral300),
                  width: "60px",
                }}
                animation={false}
              />
            ) : (
              <Text
                color={Colors.neutral0}
                weight={FontWeights.SEMI_BOLD}
                size={FontSizes.SEMI_SMALL}
              >
                {coveragePercentage.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {compact
            ? `Meta: ${hideValues ? "***" : formatCurrency(requiredPatrimony)}${
                coveragePercentage < 100 && monthlySavings > 0
                  ? ` (${formatMonthsAsCompactDuration(monthsToGoal)} no ritmo atual)`
                  : ""
              }`
            : `Proventos: ${hideValues ? "***" : formatCurrency(displayIncome)}/mês · Despesas: ${
                hideValues ? "***" : formatCurrency(avgExpenses)
              }/mês`}
        </Text>
        {!compact && effectiveYield > 0 && avgExpenses > 0 && (
          <Text
            size={FontSizes.EXTRA_SMALL}
            color={coveragePercentage >= 100 ? Colors.brand : Colors.danger200}
            weight={FontWeights.MEDIUM}
          >
            {coveragePercentage >= 100
              ? `Independência financeira atingida! Sobram ${hideValues ? '***' : formatCurrency(displayIncome - effectiveExpenses)}/mês`
              : `Com yield ${effectiveYield.toFixed(1)}%, independência financeira quando acumular ${
                  hideValues ? "***" : formatCurrency(requiredPatrimony)
                } (faltam ${
                  hideValues
                    ? "***"
                    : formatCurrency(
                        Math.max(requiredPatrimony - effectivePatrimony, 0),
                      )
                }, ${formatMonthsAsDuration(monthsToGoal)} a esse ritmo de aporte)`}
          </Text>
        )}
      </Stack>
      {!compact && (
        <>
          <Stack direction="row" alignItems="center" gap={2}>
            <PersistedSlider
              value={effectiveYield}
              onChange={(v) => setSimulatedYield(v)}
              renderLabel={(v) => (
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  Yield: {v.toFixed(1)}% a.a.
                </Text>
              )}
              enabled={persistEnabled}
              isPersisting={isPersisting}
              min={1}
              max={15}
              step={0.5}
              showReset={simulatedYield !== null}
              onReset={() => setSimulatedYield(null)}
            />
            <PatrimonySimulator
              value={effectivePatrimony}
              onChange={setSimulatedPatrimony}
              onReset={() => setSimulatedPatrimony(null)}
              patrimonyTotal={patrimonyTotal}
              showReset={simulatedPatrimony !== null}
              isPersisting={isPersisting}
            />
            <ExpenseSimulator
              value={effectiveExpenses}
              onChange={setSimulatedExpenses}
              onReset={() => setSimulatedExpenses(null)}
              avgMonthlyExpenses={avgExpenses}
              showReset={simulatedExpenses !== null}
              enabled={persistEnabled}
              isPersisting={isPersisting}
            />
          </Stack>
          <SavingsSimulator
            value={monthlySavings}
            onChange={setSimulatedSavings}
            onReset={() => setSimulatedSavings(null)}
            avgMonthlySavings={defaultSavings}
            showReset={simulatedSavings !== null}
            enabled={persistEnabled}
            isPersisting={isPersisting}
          />
        </>
      )}
      {!compact && (
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Faixa típica para carteiras focadas em dividendos:{" "}
          {TYPICAL_DIVIDEND_YIELD.rangeMin}%–{TYPICAL_DIVIDEND_YIELD.rangeMax}%
          {" "}(IDIV ~{TYPICAL_DIVIDEND_YIELD.idiv}%, IFIX ~{TYPICAL_DIVIDEND_YIELD.ifix}%)
        </Text>
      )}
      {!compact && (
        <Stack gap={0.5} mt={1}>
          {history.length > 0 && avgExpenses > 0 && (
            <Stack
              direction="row"
              alignItems="baseline"
              gap={3}
              flexWrap="wrap"
            >
              <Stack direction="row" alignItems="baseline" gap={1}>
                <Text size={FontSizes.LARGE} weight={FontWeights.SEMI_BOLD} color={Colors.brand}>
                  {((monthsAboveExpenses / history.length) * 100).toFixed(0)}%
                </Text>
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  dos últimos {windowYears} {windowYears === 1 ? "ano" : "anos"} cobriram as despesas
                </Text>
              </Stack>
              {diagnostics && (
                <>
                  <Tooltip
                    title="Para cada mês: cobertura = proventos / despesas × 100. Mostra a média e o desvio padrão (raiz da média dos quadrados dos desvios em relação à média). Cerca de 2/3 dos meses ficam dentro da faixa média ± desvio."
                    arrow
                    placement="top"
                  >
                    <Stack direction="row" alignItems="baseline" gap={0.5}>
                      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                        Cobertura média
                      </Text>
                      <Text size={FontSizes.SMALL} weight={FontWeights.MEDIUM}>
                        {hideValues
                          ? "***"
                          : `${diagnostics.meanCoverage.toFixed(0)}% (± ${diagnostics.stdevCoverage.toFixed(0)}%)`}
                      </Text>
                    </Stack>
                  </Tooltip>
                  {diagnostics.worstQuarterCoverage !== null && (
                    <Tooltip
                      title="Pior janela de 3 meses consecutivos: total de proventos recebidos dividido por 3× a média mensal de despesas. Análogo a 'sequence-of-returns risk'."
                      arrow
                      placement="top"
                    >
                      <Stack direction="row" alignItems="baseline" gap={0.5}>
                        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                          Pior trimestre
                        </Text>
                        <Text
                          size={FontSizes.SMALL}
                          weight={FontWeights.MEDIUM}
                          color={
                            diagnostics.worstQuarterCoverage >= 100
                              ? Colors.brand
                              : Colors.danger200
                          }
                        >
                          {hideValues
                            ? "***"
                            : `${diagnostics.worstQuarterCoverage.toFixed(0)}%`}
                        </Text>
                      </Stack>
                    </Tooltip>
                  )}
                  {diagnostics.yoyDeltaPct !== null && (
                    <Tooltip
                      title="Variação % entre a média mensal de proventos dos últimos 12 meses e dos 12 meses anteriores. Mostra se sua renda passiva está crescendo ou encolhendo ano a ano."
                      arrow
                      placement="top"
                    >
                      <Stack direction="row" alignItems="baseline" gap={0.5}>
                        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                          Tendência YoY
                        </Text>
                        <Text
                          size={FontSizes.SMALL}
                          weight={FontWeights.MEDIUM}
                          color={
                            diagnostics.yoyDeltaPct >= 0
                              ? Colors.brand
                              : Colors.danger200
                          }
                        >
                          {hideValues
                            ? "***"
                            : `${diagnostics.yoyDeltaPct >= 0 ? "+" : ""}${diagnostics.yoyDeltaPct.toFixed(0)}%`}
                        </Text>
                      </Stack>
                    </Tooltip>
                  )}
                  {diagnostics.yoyRealDeltaPct !== null && (
                    <Tooltip
                      title={`YoY descontando inflação. Calculado como (1 + YoY nominal) ÷ (1 + IPCA) − 1, com IPCA de referência de ${TYPICAL_TRAILING_IPCA_PCT}% a.a. (revisado anualmente). Negativo significa que seus proventos estão perdendo poder de compra real.`}
                      arrow
                      placement="top"
                    >
                      <Stack direction="row" alignItems="baseline" gap={0.5}>
                        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                          YoY real
                        </Text>
                        <Text
                          size={FontSizes.SMALL}
                          weight={FontWeights.MEDIUM}
                          color={
                            diagnostics.yoyRealDeltaPct >= 0
                              ? Colors.brand
                              : Colors.danger200
                          }
                        >
                          {hideValues
                            ? "***"
                            : `${diagnostics.yoyRealDeltaPct >= 0 ? "+" : ""}${diagnostics.yoyRealDeltaPct.toFixed(0)}%`}
                        </Text>
                      </Stack>
                    </Tooltip>
                  )}
                </>
              )}
              <Stack direction="row" alignItems="center" gap={1}>
                <PersistedSlider
                  value={windowYears}
                  onChange={(v) => setWindowYears(v)}
                  renderLabel={(v) => (
                    <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                      Janela: {v}a
                    </Text>
                  )}
                  isPersisting={isPersisting}
                  min={1}
                  max={10}
                  step={1}
                  marks
                />
              </Stack>
            </Stack>
          )}
          {isHistoricLoading ? (
            <Skeleton height={240} sx={{ borderRadius: "10px" }} />
          ) : history.length === 0 ? (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Sem histórico de proventos para exibir.
            </Text>
          ) : (
            <BarChartCreditedAndProvisionedWithAvg
              data={history}
              avg={avgExpenses}
              aggregatePeriod="month"
              chartType="bar"
              responsive
              height={240}
              referenceLabel="Despesas"
              referenceStroke={getColor(Colors.danger200)}
              showLegend={false}
              creditedFill={getColor(Colors.brand400)}
              hideProvisioned
            />
          )}
        </Stack>
      )}
    </Stack>
  );
};

export default DividendsOnlyIndicator;
