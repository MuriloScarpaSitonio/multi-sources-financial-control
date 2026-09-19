import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, {
  linearProgressClasses,
} from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";
import FireSimulationResults from "./FireSimulationResults";
import type { PortfolioSlice } from "./firePortfolio";
import type { BootstrapBand } from "./fireBootstrap";
import type { FireSimulationRequest } from "./fireSimulation";
import type { SamplingMethod } from "./fireReturnTypes";
import { useFireSimulationWorker } from "./useFireSimulationWorker";
import FireResultsSkeleton, {
  type FireCalculationState,
} from "../Planning/fire/FireResultsSkeleton";

// Bar value is patrimony / fireTarget × 100. ≥100 = FIRE'd.
const ProgressBar = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral600),
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 10,
    backgroundColor:
      value && value >= 100
        ? getColor(Colors.brand)
        : getColor(Colors.danger200),
  },
}));

const numberTickFormatter = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const ChartTooltipContent = ({
  active,
  payload,
  hideValues,
  valueFormatter = formatCurrency,
  showOtimista = true,
  showMediana = true,
  showPessimista = true,
  invertLabels = false,
}: {
  active?: boolean;
  payload?: { payload: BootstrapBand }[];
  hideValues?: boolean;
  valueFormatter?: (v: number) => string;
  showOtimista?: boolean;
  showMediana?: boolean;
  showPessimista?: boolean;
  invertLabels?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  // For balance-based bands (drawdown), p10 = small balance = pessimista.
  // For gap-based bands (accumulation), p10 = small gap = otimista — invert.
  const otimistaValue = invertLabels ? data.p10 : data.p90;
  const pessimistaValue = invertLabels ? data.p90 : data.p10;
  const otimistaPercentile = invertLabels ? "p10" : "p90";
  const pessimistaPercentile = invertLabels ? "p90" : "p10";
  return (
    <Stack
      spacing={0.5}
      sx={{
        border: "1px solid",
        p: 1,
        borderColor: getColor(Colors.brand400),
        backgroundColor: getColor(Colors.neutral600),
      }}
    >
      <p style={{ color: getColor(Colors.neutral300) }}>Ano {data.year}</p>
      {showPessimista && (
        <p style={{ color: getColor(Colors.danger200) }}>
          Pessimista ({pessimistaPercentile}):{" "}
          {hideValues ? "***" : valueFormatter(pessimistaValue)}
        </p>
      )}
      {showMediana && (
        <p style={{ color: getColor(Colors.brand200) }}>
          Mediana (p50): {hideValues ? "***" : valueFormatter(data.p50)}
        </p>
      )}
      {showOtimista && (
        <p style={{ color: getColor(Colors.brand) }}>
          Otimista ({otimistaPercentile}):{" "}
          {hideValues ? "***" : valueFormatter(otimistaValue)}
        </p>
      )}
    </Stack>
  );
};

const ConstantDollarIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  withdrawalRate,
  targetYears,
  portfolio,
  samplingMethod,
  monthlySavings = 0,
  dateOfBirth = null,
  compact = false,
  hideLabel = false,
  simulatedPatrimony = null,
  simulatedExpenses = null,
  onProgressClick,
  onCalculationStateChange,
  simulationRequestOverride,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  withdrawalRate: number;
  targetYears: number;
  portfolio: readonly PortfolioSlice[];
  samplingMethod: SamplingMethod;
  monthlySavings?: number;
  dateOfBirth?: string | null;
  compact?: boolean;
  hideLabel?: boolean;
  simulatedPatrimony?: number | null;
  simulatedExpenses?: number | null;
  onProgressClick?: () => void;
  onCalculationStateChange?: (state: FireCalculationState) => void;
  simulationRequestOverride?: FireSimulationRequest | null;
}) => {
  const { hideValues } = useHideValues();
  const [visibleScenarios, setVisibleScenarios] = useState<
    ("otimista" | "mediana" | "pessimista")[]
  >(["otimista", "mediana", "pessimista"]);
  const effectiveMonthlyExpenses = simulatedExpenses ?? avgExpenses;
  const showOtimista = visibleScenarios.includes("otimista");
  const showMediana = visibleScenarios.includes("mediana");
  const showPessimista = visibleScenarios.includes("pessimista");
  const toggleScenario = (
    scenario: "otimista" | "mediana" | "pessimista",
    checked: boolean,
  ) => {
    setVisibleScenarios((prev) =>
      checked ? [...prev, scenario] : prev.filter((v) => v !== scenario),
    );
  };

  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;

  const currentAge = (() => {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth + "T00:00:00");
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  })();

  const annualExpenses = effectiveMonthlyExpenses * 12;

  const annualSavings = Math.max(0, monthlySavings) * 12;
  const derivedSimulationRequest = useMemo<FireSimulationRequest>(
    () => ({
      kind: "constant_dollar",
      input: {
        targetYears,
        portfolio,
        samplingMethod,
        annualExpenses,
        withdrawalRate,
        patrimonyTotal,
        simulatedPatrimony,
        annualSavings,
      },
    }),
    [
      annualExpenses,
      annualSavings,
      patrimonyTotal,
      portfolio,
      samplingMethod,
      simulatedPatrimony,
      targetYears,
      withdrawalRate,
    ],
  );
  const simulationRequest =
    simulationRequestOverride === undefined
      ? derivedSimulationRequest
      : simulationRequestOverride;
  const {
    result: simulationResult,
    isCalculating,
    error: simulationError,
  } = useFireSimulationWorker(simulationRequest);
  const simulation =
    simulationResult?.kind === "constant_dollar"
      ? simulationResult.output
      : null;

  useEffect(() => {
    onCalculationStateChange?.({
      isCalculating,
      error: simulationError,
    });
  }, [isCalculating, onCalculationStateChange, simulationError]);

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }
  if (!compact && isCalculating) {
    return <FireResultsSkeleton />;
  }
  if (!compact && simulationError) {
    return (
      <Alert severity="error">
        Não foi possível recalcular a simulação. Seus valores foram preservados;
        tente novamente.
      </Alert>
    );
  }
  if (simulationError && simulation === null) {
    return <Text color={Colors.danger200}>{simulationError}</Text>;
  }
  if (simulation === null) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const {
    safeRate,
    fireTarget,
    patrimonyInputs,
    bootstrap,
    rateBootstrap,
    accumulation,
  } = simulation;

  const tooltipTitle =
    "Mostra quanto o patrimônio usado neste cenário representa da meta FIRE. " +
    (hideValues
      ? ""
      : `${formatCurrency(effectivePatrimony)} ÷ ${formatCurrency(fireTarget)} × 100. `) +
    "Usa o valor simulado de patrimônio quando você o altera. Esse percentual não é a probabilidade de sucesso da simulação.";

  const lifestyleSuccess = bootstrap.successRate;
  const fireProgress = patrimonyInputs.scenarioProgress;
  const retirementProgress = patrimonyInputs.accumulationProgress;
  const medianDepletionLabel =
    bootstrap.medianDepletionYear !== null
      ? `${bootstrap.medianDepletionYear} anos`
      : `${targetYears}+ anos`;
  const p10DepletionLabel =
    bootstrap.p10DepletionYear !== null
      ? `${bootstrap.p10DepletionYear} anos`
      : `${targetYears}+ anos`;

  const progressBar = (
    <Tooltip title={tooltipTitle} arrow placement="top">
      <div
        role={onProgressClick ? "link" : undefined}
        tabIndex={onProgressClick ? 0 : undefined}
        onClick={onProgressClick}
        onKeyDown={(event) => {
          if (!onProgressClick) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onProgressClick();
          }
        }}
        style={{
          position: "relative",
          cursor: onProgressClick ? "pointer" : undefined,
        }}
      >
        <ProgressBar
          variant="determinate"
          value={Math.min(fireProgress, 100)}
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
              Retirada constante (FIRE)
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
              {fireProgress.toFixed(0)}%
            </Text>
          )}
        </Stack>
      </div>
    </Tooltip>
  );

  return (
    <Stack gap={0.5}>
      {compact && progressBar}
      {compact && (
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Meta: {hideValues ? "***" : formatCurrency(fireTarget)}
          {retirementProgress < 100 &&
          annualSavings > 0 &&
          accumulation.medianYearsToTarget !== null
            ? ` (~${accumulation.medianYearsToTarget}a no ritmo atual)`
            : ""}
        </Text>
      )}
      {!compact && annualExpenses > 0 && (
        <FireSimulationResults
          isPatrimonySimulated={simulatedPatrimony !== null}
          patrimony={effectivePatrimony}
          currentPatrimony={patrimonyTotal}
          monthlyExpenses={effectiveMonthlyExpenses}
          annualExpenses={annualExpenses}
          withdrawalRate={withdrawalRate}
          targetYears={targetYears}
          safeRate={safeRate}
          fireTarget={fireTarget}
          fireProgress={fireProgress}
          retirementProgress={retirementProgress}
          bootstrap={bootstrap}
          rateBootstrap={rateBootstrap}
          accumulation={accumulation}
          currentAge={currentAge}
          showOtimista={showOtimista}
          showMediana={showMediana}
          showPessimista={showPessimista}
          onScenarioVisibilityChange={toggleScenario}
          hideValues={hideValues}
        />
      )}
      {!compact && annualExpenses > 0 && fireProgress >= 100 && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Sustentabilidade em {targetYears}a:{" "}
            {(lifestyleSuccess * 100).toFixed(0)}% · Sucesso da taxa{" "}
            {withdrawalRate}%: {(rateBootstrap.successRate * 100).toFixed(0)}% ·
            Depleção p10: {p10DepletionLabel} · Mediana: {medianDepletionLabel}
          </Text>
        </Stack>
      )}
      {!compact && annualExpenses > 0 && retirementProgress < 100 && (
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          {annualSavings <= 0 ? (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.danger200}>
              Receitas ≤ despesas no momento — comece a poupar para projetar o
              tempo até a meta.
            </Text>
          ) : accumulation.medianYearsToTarget === null ? (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.danger200}>
              No ritmo de {hideValues ? "***" : formatCurrency(monthlySavings)}
              /mês, improvável atingir a meta em 60 anos (sucesso histórico{" "}
              {(accumulation.successRate * 100).toFixed(0)}%).
            </Text>
          ) : (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              No ritmo de {hideValues ? "***" : formatCurrency(monthlySavings)}
              /mês: mediana <strong>
                {accumulation.medianYearsToTarget}a
              </strong>{" "}
              · otimista (p10) {accumulation.p10YearsToTarget}a · pessimista
              (p90) {accumulation.p90YearsToTarget}a · sucesso{" "}
              {(accumulation.successRate * 100).toFixed(0)}% em 60a
            </Text>
          )}
        </Stack>
      )}
      {!compact &&
        retirementProgress < 100 &&
        accumulation.gapBands.length > 1 &&
        (() => {
          // Acumulação chart: gap-to-target shrinking. Past p90 crossing all
          // bands are 0, so trim a few years after.
          const accTrimEnd =
            accumulation.p90YearsToTarget !== null
              ? Math.min(
                  accumulation.gapBands.length,
                  accumulation.p90YearsToTarget + 3,
                )
              : accumulation.gapBands.length;
          // X-axis uses age (consistent with the second chart) when DOB is set;
          // falls back to year-from-now when not. Each gapBand entry gets an
          // `age` field = currentAge + year for the chart to read.
          const useAgeAxis = currentAge !== null;
          const accData = accumulation.gapBands
            .slice(0, accTrimEnd)
            .map((b) => ({
              ...b,
              age: useAgeAxis ? (currentAge as number) + b.year : b.year,
            }));
          const ageLabel = (years: number) =>
            useAgeAxis
              ? `aos ${(currentAge as number) + years}`
              : `em ${years} anos`;
          const refX = (years: number) =>
            useAgeAxis ? (currentAge as number) + years : years;
          return (
            <>
              <Stack gap={0.5} sx={{ mt: 2 }}>
                <Text
                  size={FontSizes.SMALL}
                  weight={FontWeights.SEMI_BOLD}
                  color={Colors.neutral200}
                >
                  Quando posso me aposentar?
                </Text>
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  O gráfico mostra quanto ainda falta para atingir a meta FIRE
                  em cada ano. As linhas verticais marcam quando os cenários
                  otimista, mediano e pessimista cruzam a meta.
                </Text>
              </Stack>

              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart
                  data={accData}
                  margin={{ top: 50, right: 5, left: 5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="5" vertical={false} />
                  <XAxis
                    dataKey={useAgeAxis ? "age" : "year"}
                    stroke={getColor(Colors.neutral0)}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                  />
                  <YAxis
                    stroke={getColor(Colors.brand400)}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={numberTickFormatter}
                    tickCount={hideValues ? 0 : undefined}
                  />
                  <RechartsTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideValues={hideValues}
                        showOtimista={showOtimista}
                        showMediana={showMediana}
                        showPessimista={showPessimista}
                        invertLabels
                      />
                    }
                  />
                  {showOtimista && accumulation.p10YearsToTarget !== null && (
                    <ReferenceLine
                      x={refX(accumulation.p10YearsToTarget)}
                      stroke={getColor(Colors.brand)}
                      strokeDasharray="3 3"
                      label={{
                        value: `otimista · aposenta ${ageLabel(accumulation.p10YearsToTarget)}`,
                        position: "top",
                        dy: -34,
                        fill: getColor(Colors.brand),
                        fontSize: 12,
                      }}
                    />
                  )}
                  {showMediana && accumulation.medianYearsToTarget !== null && (
                    <ReferenceLine
                      x={refX(accumulation.medianYearsToTarget)}
                      stroke={getColor(Colors.brand)}
                      strokeDasharray="3 3"
                      label={{
                        value: `mediana · aposenta ${ageLabel(accumulation.medianYearsToTarget)}`,
                        position: "top",
                        dy: -18,
                        fill: getColor(Colors.brand),
                        fontSize: 12,
                      }}
                    />
                  )}
                  {showPessimista && accumulation.p90YearsToTarget !== null && (
                    <ReferenceLine
                      x={refX(accumulation.p90YearsToTarget)}
                      stroke={getColor(Colors.danger200)}
                      strokeDasharray="3 3"
                      label={{
                        value: `pessimista · aposenta ${ageLabel(accumulation.p90YearsToTarget)}`,
                        position: "top",
                        dy: -2,
                        fill: getColor(Colors.danger200),
                        fontSize: 12,
                      }}
                    />
                  )}
                  {/* For gap: smallest gap = best case = otimista → green → p10 */}
                  {showOtimista && (
                    <Line
                      type="monotone"
                      dataKey="p10"
                      stroke={getColor(Colors.brand)}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                      name="p10 (otimista)"
                    />
                  )}
                  {showMediana && (
                    <Line
                      type="monotone"
                      dataKey="p50"
                      stroke={getColor(Colors.brand200)}
                      strokeWidth={2}
                      dot={false}
                      name="Mediana"
                    />
                  )}
                  {showPessimista && (
                    <Line
                      type="monotone"
                      dataKey="p90"
                      stroke={getColor(Colors.danger200)}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                      name="p90 (pessimista)"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </>
          );
        })()}
    </Stack>
  );
};

export default ConstantDollarIndicator;
