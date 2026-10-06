import { ageFromBirthDate } from "../Planning/vpw/vpwScenario";
import { useMemo } from "react";
import Box from "@mui/material/Box";
import LinearProgress, {
  linearProgressClasses,
} from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";
import { useFireSimulationWorker } from "./useFireSimulationWorker";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";
import type { OneOverNPlanningPreferences } from "../Planning/api";
import type { FireAllocationBucket } from "../Planning/fireAllocation";
import { buildOneOverNSnapshot } from "../Planning/oneOverN/oneOverNScenario";

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

type Props = {
  allocation: readonly FireAllocationBucket[];
  preferences: Required<OneOverNPlanningPreferences>;
  avgExpenses: number;
  avgMonthlySavings: number;
  isLoading: boolean;
  isError?: boolean;
  dateOfBirth: string | null;
  hideLabel?: boolean;
  compact?: boolean;
};
export default function OneOverNIndicator({
  allocation,
  preferences,
  avgExpenses,
  avgMonthlySavings,
  isLoading,
  isError = false,
  dateOfBirth,
  hideLabel = false,
  compact = false,
}: Props) {
  const { hideValues } = useHideValues();
  const state = useMemo(() => {
    try {
      return {
        snapshot: buildOneOverNSnapshot({
          isReady: !isLoading && !isError,
          allocation,
          // This summary describes withdrawals from current wealth, before accumulation.
          preferences,
          avgExpenses,
          monthlySavings: avgMonthlySavings,
          simulatedPatrimony: null,
          currentAge: ageFromBirthDate(dateOfBirth),
        }),
        error: null,
      };
    } catch (error) {
      return {
        snapshot: null,
        error: error instanceof Error ? error.message : "Revise o cenário 1/N.",
      };
    }
  }, [
    allocation,
    preferences,
    avgExpenses,
    avgMonthlySavings,
    isLoading,
    isError,
    dateOfBirth,
  ]);
  const simulation = useFireSimulationWorker(
    compact ? (state.snapshot?.request ?? null) : null,
  );
  if (isError)
    return (
      <Text size={FontSizes.EXTRA_SMALL}>
        Não foi possível carregar os dados do 1/N. Tente novamente.
      </Text>
    );
  if (isLoading) return <Skeleton variant="rounded" height={70} />;
  if (state.error)
    return <Text size={FontSizes.EXTRA_SMALL}>{state.error}</Text>;
  if (!state.snapshot)
    return (
      <Text size={FontSizes.EXTRA_SMALL}>
        Cadastre sua data de nascimento para calcular o 1/N.
      </Text>
    );
  const s = state.snapshot;
  if (compact) {
    if (simulation.error)
      return (
        <Text size={FontSizes.EXTRA_SMALL}>
          Não foi possível calcular a meta 1/N. Tente novamente.
        </Text>
      );
    if (simulation.isCalculating || !simulation.result)
      return <Skeleton variant="rounded" height={44} />;
    const target = simulation.result.output.targetPatrimony;
    const progress = target > 0 ? (s.actualPatrimony / target) * 100 : 100;
    const displayedProgress =
      progress < 100 ? Math.min(progress, 99.9) : progress;
    const medianYearsToTarget =
      simulation.result.output.accumulation?.medianYearsToTarget;
    const tooltipTitle =
      `Retirada 1/N: divida o patrimônio pelos anos restantes. ` +
      `Idade: ${s.currentAge}, meta: ${s.targetAge}, ${s.years} anos restantes. ` +
      `Retirada: ${((1 / s.years) * 100).toFixed(1)}% a.a. (${hideValues ? "***" : formatCurrency(s.initialMonthlyIncome)}/mês). ` +
      `A retirada anual é gasta integralmente e recalculada a cada ano. O patrimônio será totalmente consumido até a idade alvo. ` +
      `A barra mostra o patrimônio atual em relação à meta para cobrir as despesas durante toda a aposentadoria em 95% das simulações históricas.`;
    return (
      <Stack gap={0.5}>
        <Tooltip title={tooltipTitle} arrow placement="top">
          <Box sx={{ position: "relative" }}>
            <ProgressBar
              variant="determinate"
              value={Math.min(progress, 100)}
              aria-label="Progresso até a meta 1/N"
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
                  Retirada 1/N
                </Text>
              )}
              {hideValues ? (
                <Skeleton
                  sx={{ bgcolor: getColor(Colors.neutral300), width: "60px" }}
                  animation={false}
                />
              ) : (
                <Text
                  color={Colors.neutral0}
                  weight={FontWeights.SEMI_BOLD}
                  size={FontSizes.SEMI_SMALL}
                >
                  {displayedProgress.toFixed(1)}%
                </Text>
              )}
            </Stack>
          </Box>
        </Tooltip>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Meta: {hideValues ? "***" : formatCurrency(target)}
          {s.actualPatrimony < target && medianYearsToTarget != null
            ? ` (${medianYearsToTarget <= 0 ? "agora" : `~${medianYearsToTarget}a`} no ritmo atual)`
            : ""}
        </Text>
      </Stack>
    );
  }
  return (
    <Stack gap={0.5}>
      {!hideLabel && <Text weight={FontWeights.SEMI_BOLD}>1/N</Text>}
      <Text weight={FontWeights.SEMI_BOLD}>
        {hideValues
          ? "***"
          : `${(s.monthlyExpenses > 0 ? (s.initialMonthlyIncome / s.monthlyExpenses) * 100 : 100).toFixed(0)}%`}{" "}
        de cobertura inicial
      </Text>
      <Text size={FontSizes.EXTRA_SMALL}>
        Retirada inicial:{" "}
        {hideValues ? "***" : formatCurrency(s.initialMonthlyIncome)}/mês
      </Text>
      <Text size={FontSizes.EXTRA_SMALL}>
        Até os {s.targetAge} anos · veja a variação da renda na simulação.
      </Text>
    </Stack>
  );
}
