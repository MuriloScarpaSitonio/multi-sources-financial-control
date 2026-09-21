import { useEffect, useMemo, useState } from "react";

import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, {
  linearProgressClasses,
} from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import FireAccumulationChart from "./FireAccumulationChart";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";
import FireAccumulationExtensionNotice from "./FireAccumulationExtensionNotice";
import FireSimulationResults from "./FireSimulationResults";
import type { PortfolioSlice } from "./firePortfolio";
import type {
  FireSimulationRequest,
  FireSimulationResult,
} from "./fireSimulation";
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
  onSimulationResult,
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
      {simulation.extendedAccumulation && (
        <FireAccumulationExtensionNotice
          result={simulation.extendedAccumulation}
          hideValues={hideValues}
          horizon={targetYears}
        />
      )}
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
          patrimony={
            simulation.extendedAccumulation?.medianStartingBalance ??
            effectivePatrimony
          }
          yearsToRetirement={
            simulation.extendedAccumulation?.medianYearsToRetirement
          }
          trialCount={simulation.extendedAccumulation?.retirementTrialCount}
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
        accumulation.gapBands.length > 1 && (
          <FireAccumulationChart
            accumulation={accumulation}
            currentAge={currentAge}
            hideValues={hideValues}
            showOtimista={showOtimista}
            showMediana={showMediana}
            showPessimista={showPessimista}
          />
        )}
    </Stack>
  );
};

export default ConstantDollarIndicator;
