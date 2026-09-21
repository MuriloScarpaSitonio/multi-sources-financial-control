import FireAccumulationExtensionNotice from "./FireAccumulationExtensionNotice";
import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
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
import type { BootstrapBand } from "./fireBootstrap";
import type {
  FireSimulationRequest,
  FireSimulationResult,
} from "./fireSimulation";
import type { SamplingMethod } from "./fireReturnTypes";
import type { PortfolioSlice } from "./firePortfolio";
import { useFireSimulationWorker } from "./useFireSimulationWorker";
import FireResultsSkeleton, {
  type FireCalculationState,
} from "../Planning/fire/FireResultsSkeleton";

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

const computeAge = (dateOfBirth: string): number => {
  const birth = new Date(dateOfBirth + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const numberTickFormatter = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
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

type DrawdownPoint = {
  age: number;
  year: number;
  balanceP10: number;
  balanceP50: number;
  balanceP90: number;
  withdrawalP10: number | null;
  withdrawalP50: number | null;
  withdrawalP90: number | null;
};

const DrawdownTooltipContent = ({
  active,
  payload,
  hideValues,
  showOtimista = true,
  showMediana = true,
  showPessimista = true,
  xLabel = "Idade",
}: {
  active?: boolean;
  payload?: { payload: DrawdownPoint }[];
  hideValues?: boolean;
  showOtimista?: boolean;
  showMediana?: boolean;
  showPessimista?: boolean;
  xLabel?: string;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const fmtBal = (v: number) => (hideValues ? "***" : formatCurrency(v));
  const fmtWd = (v: number | null) =>
    v === null ? "—" : hideValues ? "***" : `${formatCurrency(v / 12)}/mês`;
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
      <p style={{ color: getColor(Colors.neutral300) }}>
        {xLabel}: {xLabel === "Idade" ? data.age : data.year}
      </p>
      {showPessimista && (
        <p style={{ color: getColor(Colors.danger200) }}>
          Pessimista (p10): {fmtBal(data.balanceP10)} ·{" "}
          {fmtWd(data.withdrawalP10)}
        </p>
      )}
      {showMediana && (
        <p style={{ color: getColor(Colors.brand200) }}>
          Mediana (p50): {fmtBal(data.balanceP50)} · {fmtWd(data.withdrawalP50)}
        </p>
      )}
      {showOtimista && (
        <p style={{ color: getColor(Colors.brand) }}>
          Otimista (p90): {fmtBal(data.balanceP90)} ·{" "}
          {fmtWd(data.withdrawalP90)}
        </p>
      )}
    </Stack>
  );
};

const ConstantDollarAgeInBondsIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  dateOfBirth,
  withdrawalRate,
  targetYears,
  portfolio,
  samplingMethod,
  fixedIncomeTotal,
  variableIncomeTotal,
  monthlySavings = 0,
  simulatedExpenses = null,
  simulatedPatrimony = null,
  onProgressClick,
  compact = false,
  hideLabel = false,
  onCalculationStateChange,
  simulationRequestOverride,
  onSimulationResult,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  dateOfBirth: string | null;
  withdrawalRate: number;
  targetYears: number;
  portfolio: readonly PortfolioSlice[];
  samplingMethod: SamplingMethod;
  fixedIncomeTotal: number;
  variableIncomeTotal: number;
  monthlySavings?: number;
  simulatedExpenses?: number | null;
  simulatedPatrimony?: number | null;
  onProgressClick?: () => void;
  compact?: boolean;
  hideLabel?: boolean;
  onCalculationStateChange?: (state: FireCalculationState) => void;
  simulationRequestOverride?: FireSimulationRequest | null;
  onSimulationResult?: (result: FireSimulationResult) => void;
}) => {
  const { hideValues } = useHideValues();
  const [visibleScenarios, setVisibleScenarios] = useState<
    ("otimista" | "mediana" | "pessimista")[]
  >(["otimista", "mediana", "pessimista"]);
  const effectiveMonthlyExpenses = simulatedExpenses ?? avgExpenses;
  const showOtimista = visibleScenarios.includes("otimista");
  const showMediana = visibleScenarios.includes("mediana");
  const showPessimista = visibleScenarios.includes("pessimista");

  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;
  const currentAge = dateOfBirth ? computeAge(dateOfBirth) : null;

  const annualExpenses = effectiveMonthlyExpenses * 12;
  const annualWithdrawal = effectivePatrimony * (withdrawalRate / 100);
  const monthlyWithdrawal = annualWithdrawal / 12;

  const investmentTotal = fixedIncomeTotal + variableIncomeTotal;
  const currentBondPct =
    investmentTotal > 0 ? (fixedIncomeTotal / investmentTotal) * 100 : 0;
  const targetBondPct = currentAge !== null ? Math.min(currentAge, 100) : 0;
  const isOnTarget = Math.abs(currentBondPct - targetBondPct) <= 5;
  const rebalanceAmount =
    investmentTotal > 0
      ? (targetBondPct / 100) * investmentTotal - fixedIncomeTotal
      : 0;

  const annualSavings = Math.max(0, monthlySavings) * 12;
  const derivedSimulationRequest = useMemo<FireSimulationRequest | null>(() => {
    if (currentAge === null) return null;
    return {
      kind: "age_in_bonds",
      input: {
        currentAge,
        targetYears,
        portfolio,
        samplingMethod,
        effectivePatrimony,
        annualExpenses,
        annualSavings,
        withdrawalRate,
      },
    };
  }, [
    currentAge,
    annualExpenses,
    annualSavings,
    effectivePatrimony,
    portfolio,
    samplingMethod,
    targetYears,
    withdrawalRate,
  ]);
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
    simulationResult?.kind === "age_in_bonds" ? simulationResult.output : null;

  useEffect(() => {
    onCalculationStateChange?.({
      isCalculating,
      error: simulationError,
    });
  }, [isCalculating, onCalculationStateChange, simulationError]);

  useEffect(() => {
    if (!isCalculating && !simulationError && simulationResult) {
      onSimulationResult?.(simulationResult);
    }
  }, [isCalculating, simulationError, simulationResult, onSimulationResult]);

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

  if (!dateOfBirth || currentAge === null) {
    return (
      <Stack
        sx={{
          height: 24,
          borderRadius: "10px",
          backgroundColor: getColor(Colors.neutral600),
          justifyContent: "center",
          px: 1.5,
        }}
      >
        <Text
          color={Colors.neutral300}
          size={FontSizes.SEMI_SMALL}
          weight={FontWeights.MEDIUM}
        >
          Retirada constante (Idade em RF) — configure sua data de nascimento no
          perfil
        </Text>
      </Stack>
    );
  }

  if (simulationError && simulation === null) {
    return <Text color={Colors.danger200}>{simulationError}</Text>;
  }
  if (simulation === null) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  if (simulation.extendedAccumulation?.retirementStartRate === 0)
    return (
      <FireAccumulationExtensionNotice
        result={simulation.extendedAccumulation}
        hideValues={hideValues}
        horizon={targetYears}
      />
    );
  const bootstrap = simulation.lifestyleBootstrap;
  const solverState = simulation.solverState;
  const {
    fireTarget,
    safeRate,
    rateBootstrap,
    accumulation,
    drawdownAtTarget,
  } = solverState;

  const monthlyWithdrawalFormatted = hideValues
    ? "***"
    : formatCurrency(monthlyWithdrawal);
  const monthlyExpensesFormatted = hideValues
    ? "***"
    : formatCurrency(effectiveMonthlyExpenses);
  const isAggressiveRate = rateBootstrap.successRate < 0.85;
  const tooltipTitle =
    "Mostra quanto o patrimônio usado neste cenário representa da meta FIRE. " +
    (hideValues
      ? ""
      : `${formatCurrency(effectivePatrimony)} ÷ ${formatCurrency(fireTarget)} × 100. `) +
    "100% significa atingir a meta; 121% significa ter 21% a mais que o necessário para ela. " +
    "Usa o valor simulado de patrimônio quando você o altera. Esse percentual não é a probabilidade de sucesso da simulação.";

  const lifestyleSuccess = bootstrap.successRate;
  const fireProgress =
    fireTarget > 0 ? (effectivePatrimony / fireTarget) * 100 : 0;
  const medianDepletionLabel =
    bootstrap.medianDepletionYear !== null
      ? `${bootstrap.medianDepletionYear} anos`
      : `${targetYears}+ anos`;
  const p10DepletionLabel =
    bootstrap.p10DepletionYear !== null
      ? `${bootstrap.p10DepletionYear} anos`
      : `${targetYears}+ anos`;

  return (
    <Stack gap={0.5}>
      {simulation.extendedAccumulation && (
        <FireAccumulationExtensionNotice
          result={simulation.extendedAccumulation}
          hideValues={hideValues}
          horizon={targetYears}
        />
      )}
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
                Retirada constante (Idade em RF)
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
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {(() => {
            const compactTargetTail =
              fireProgress < 100 &&
              annualSavings > 0 &&
              accumulation.medianYearsToTarget !== null
                ? ` (~${accumulation.medianYearsToTarget}a no ritmo atual)`
                : "";
            if (compact) {
              return `Meta: ${hideValues ? "***" : formatCurrency(fireTarget)}${compactTargetTail}`;
            }
            const gap = monthlyWithdrawal - effectiveMonthlyExpenses;
            const gapFormatted = hideValues
              ? "***"
              : formatCurrency(Math.abs(gap));
            const sign = gap >= 0 ? "sobram" : "faltam";
            const accumulationTail =
              fireProgress < 100 &&
              annualSavings > 0 &&
              accumulation.medianYearsToTarget !== null
                ? ` em ~${accumulation.medianYearsToTarget}a no ritmo atual`
                : "";
            const targetSegment =
              annualExpenses > 0
                ? fireProgress < 100
                  ? ` · Meta: ${hideValues ? "***" : formatCurrency(fireTarget)} (faltam ${hideValues ? "***" : formatCurrency(fireTarget - effectivePatrimony)}${accumulationTail})`
                  : ` · Meta atingida: ${hideValues ? "***" : formatCurrency(fireTarget)}`
                : "";
            return `Retirada: ${monthlyWithdrawalFormatted}/mês · Despesas: ${monthlyExpensesFormatted}/mês (${sign}: ${gapFormatted}/mês${targetSegment})`;
          })()}
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          <span
            style={{
              color: getColor(isOnTarget ? Colors.brand : Colors.danger200),
            }}
          >
            RF: {currentBondPct.toFixed(0)}% (meta {targetBondPct}%)
          </span>
          {Math.abs(rebalanceAmount) > 0 && !hideValues && (
            <span>
              {" · "}
              {rebalanceAmount > 0
                ? `Mover ${formatCurrency(rebalanceAmount)} para RF`
                : `Mover ${formatCurrency(Math.abs(rebalanceAmount))} para RV`}
            </span>
          )}
        </Text>
      </Stack>

      {!compact && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Text
            size={FontSizes.EXTRA_SMALL}
            color={isAggressiveRate ? Colors.danger200 : Colors.neutral400}
            weight={isAggressiveRate ? FontWeights.MEDIUM : undefined}
          >
            {isAggressiveRate
              ? `⚠ Taxa de ${withdrawalRate}% tem apenas ${(rateBootstrap.successRate * 100).toFixed(0)}% de sucesso histórico em ${targetYears} anos. Limite seguro: ${safeRate.toFixed(2)}% (90% sucesso).`
              : `Limite seguro p/ ${targetYears} anos: ${safeRate.toFixed(2)}% a.a. (90% sucesso histórico).`}
          </Text>
        </Stack>
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
      {!compact && annualExpenses > 0 && fireProgress < 100 && (
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
        fireProgress < 100 &&
        accumulation.gapBands.length > 1 &&
        (() => {
          const toggleScenario = (
            scenario: "otimista" | "mediana" | "pessimista",
            checked: boolean,
          ) => {
            setVisibleScenarios((prev) =>
              checked
                ? [...prev, scenario]
                : prev.filter((v) => v !== scenario),
            );
          };
          const onlyOne = visibleScenarios.length === 1;
          return (
            <Stack direction="row" justifyContent="flex-end">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showOtimista}
                    onChange={(_, checked) =>
                      toggleScenario("otimista", checked)
                    }
                    disabled={onlyOne && showOtimista}
                  />
                }
                label="Otimista"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showMediana}
                    onChange={(_, checked) =>
                      toggleScenario("mediana", checked)
                    }
                    disabled={onlyOne && showMediana}
                  />
                }
                label="Mediana"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showPessimista}
                    onChange={(_, checked) =>
                      toggleScenario("pessimista", checked)
                    }
                    disabled={onlyOne && showPessimista}
                  />
                }
                label="Pessimista"
              />
            </Stack>
          );
        })()}
      {!compact &&
        fireProgress < 100 &&
        accumulation.gapBands.length > 1 &&
        (() => {
          const accTrimEnd =
            accumulation.p90YearsToTarget !== null
              ? Math.min(
                  accumulation.gapBands.length,
                  accumulation.p90YearsToTarget + 3,
                )
              : accumulation.gapBands.length;
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
              <Text
                size={FontSizes.EXTRA_SMALL}
                weight={FontWeights.MEDIUM}
                color={Colors.neutral200}
              >
                Acumulação · quantos reais ainda preciso acumular para atingir
                minha meta de FIRE em cada idade
              </Text>

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
                        value: `otimista · meta ${ageLabel(accumulation.p10YearsToTarget)}`,
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
                        value: `mediana · meta ${ageLabel(accumulation.medianYearsToTarget)}`,
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
                        value: `pessimista · meta ${ageLabel(accumulation.p90YearsToTarget)}`,
                        position: "top",
                        dy: -2,
                        fill: getColor(Colors.danger200),
                        fontSize: 12,
                      }}
                    />
                  )}
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

              {drawdownAtTarget !== null && (
                <>
                  <Text
                    size={FontSizes.EXTRA_SMALL}
                    weight={FontWeights.MEDIUM}
                    color={Colors.neutral200}
                  >
                    Aposentadoria · trajetória do patrimônio durante as
                    retiradas
                  </Text>
                  <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                    Sucesso em {targetYears}a:{" "}
                    <strong>
                      {(drawdownAtTarget.successRate * 100).toFixed(0)}%
                    </strong>
                    {" · "}
                    Depleção mediana:{" "}
                    <strong>
                      {drawdownAtTarget.medianDepletionYear !== null
                        ? `${drawdownAtTarget.medianDepletionYear} anos`
                        : "nunca"}
                    </strong>
                    {" · "}
                    Depleção pessimista (p10):{" "}
                    <strong>
                      {drawdownAtTarget.p10DepletionYear !== null
                        ? `${drawdownAtTarget.p10DepletionYear} anos`
                        : "nunca"}
                    </strong>
                  </Text>
                  {(() => {
                    // The solver returns the same anchor age it used to compute
                    // drawdownAtTarget — read it directly so the preview's age
                    // axis is guaranteed to match the glide path the bootstrap
                    // actually traced.
                    const retirementAge =
                      simulation.extendedAccumulation
                        ?.medianYearsToRetirement != null
                        ? currentAge +
                          simulation.extendedAccumulation
                            .medianYearsToRetirement
                        : solverState.anchorAge;
                    const drawdownData = drawdownAtTarget.bands.map((b, i) => {
                      const wb =
                        i === 0
                          ? null
                          : drawdownAtTarget.withdrawalBands[i - 1];
                      return {
                        age: retirementAge + b.year,
                        year: b.year,
                        balanceP10: b.p10,
                        balanceP50: b.p50,
                        balanceP90: b.p90,
                        withdrawalP10: wb?.p10 ?? null,
                        withdrawalP50: wb?.p50 ?? null,
                        withdrawalP90: wb?.p90 ?? null,
                      };
                    });
                    return (
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart
                          data={drawdownData}
                          margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="5" vertical={false} />
                          <XAxis
                            dataKey="age"
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
                              <DrawdownTooltipContent
                                hideValues={hideValues}
                                showOtimista={showOtimista}
                                showMediana={showMediana}
                                showPessimista={showPessimista}
                                xLabel="Idade"
                              />
                            }
                          />
                          {showPessimista && (
                            <Line
                              type="monotone"
                              dataKey="balanceP10"
                              stroke={getColor(Colors.danger200)}
                              strokeWidth={1.5}
                              strokeDasharray="4 3"
                              dot={false}
                              name="p10 (pessimista)"
                            />
                          )}
                          {showMediana && (
                            <Line
                              type="monotone"
                              dataKey="balanceP50"
                              stroke={getColor(Colors.brand200)}
                              strokeWidth={2}
                              dot={false}
                              name="Mediana"
                            />
                          )}
                          {showOtimista && (
                            <Line
                              type="monotone"
                              dataKey="balanceP90"
                              stroke={getColor(Colors.brand)}
                              strokeWidth={1.5}
                              strokeDasharray="4 3"
                              dot={false}
                              name="p90 (otimista)"
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </>
              )}
            </>
          );
        })()}
      {!compact && fireProgress >= 100 && bootstrap.bands.length > 1 && (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart
            data={bootstrap.bands}
            margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="5" vertical={false} />
            <XAxis
              dataKey="year"
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
              content={<ChartTooltipContent hideValues={hideValues} />}
            />
            <Line
              type="monotone"
              dataKey="p10"
              stroke={getColor(Colors.danger200)}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              name="p10"
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke={getColor(Colors.brand200)}
              strokeWidth={2}
              dot={false}
              name="Mediana"
            />
            <Line
              type="monotone"
              dataKey="p90"
              stroke={getColor(Colors.brand)}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              name="p90"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Stack>
  );
};

export default ConstantDollarAgeInBondsIndicator;
