import { useMemo } from "react";
import Box from "@mui/material/Box";
import LinearProgress, {
  linearProgressClasses,
} from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";
import { useFireSimulationWorker } from "./useFireSimulationWorker";
import Skeleton from "@mui/material/Skeleton";
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
import type { VPWPlanningPreferences } from "../Planning/api";
import type { FireAllocationBucket } from "../Planning/fireAllocation";
import {
  ageFromBirthDate,
  buildVPWSnapshot,
} from "../Planning/vpw/vpwScenario";

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
  preferences: Required<VPWPlanningPreferences>;
  avgExpenses: number;
  isLoading: boolean;
  isError?: boolean;
  dateOfBirth: string | null;
  hideLabel?: boolean;
  compact?: boolean;
};
export default function VPWIndicator({
  allocation,
  preferences,
  avgExpenses,
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
        snapshot: buildVPWSnapshot({
          isReady: !isLoading && !isError,
          allocation,
          // This summary describes withdrawals from current wealth, before accumulation.
          preferences: { ...preferences, extra_accumulation_years: 0 },
          avgExpenses,
          monthlySavings: 0,
          simulatedPatrimony: null,
          currentAge: ageFromBirthDate(dateOfBirth),
        }),
        error: null,
      };
    } catch (error) {
      return {
        snapshot: null,
        error: error instanceof Error ? error.message : "Revise o cenário VPW.",
      };
    }
  }, [allocation, preferences, avgExpenses, isLoading, isError, dateOfBirth]);
  const simulation = useFireSimulationWorker(
    compact ? (state.snapshot?.request ?? null) : null,
  );
  if (isError)
    return (
      <Text size={FontSizes.EXTRA_SMALL}>
        Não foi possível carregar os dados do VPW. Tente novamente.
      </Text>
    );
  if (isLoading) return <Skeleton variant="rounded" height={70} />;
  if (state.error)
    return <Text size={FontSizes.EXTRA_SMALL}>{state.error}</Text>;
  if (!state.snapshot)
    return (
      <Text size={FontSizes.EXTRA_SMALL}>
        Cadastre sua data de nascimento para calcular o VPW.
      </Text>
    );
  const s = state.snapshot;
  if (compact) {
    if (simulation.error)
      return (
        <Text size={FontSizes.EXTRA_SMALL}>
          Não foi possível calcular a meta VPW. Tente novamente.
        </Text>
      );
    if (simulation.isCalculating || !simulation.result)
      return <Skeleton variant="rounded" height={44} />;
    const target = simulation.result.output.targetPatrimony;
    const progress = target > 0 ? (s.actualPatrimony / target) * 100 : 100;
    return (
      <Stack gap={0.5}>
        <Box sx={{ position: "relative" }}>
          <ProgressBar
            variant="determinate"
            value={Math.min(progress, 100)}
            aria-label="Progresso até a meta VPW"
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
                VPW
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
                {progress.toFixed(0)}%
              </Text>
            )}
          </Stack>
        </Box>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Meta: {hideValues ? "***" : formatCurrency(target)}
        </Text>
      </Stack>
    );
  }
  return (
    <Stack gap={0.5}>
      {!hideLabel && <Text weight={FontWeights.SEMI_BOLD}>VPW</Text>}
      <Text weight={FontWeights.SEMI_BOLD}>
        {hideValues ? "***" : `${s.coverage.toFixed(0)}%`} de cobertura inicial
      </Text>
      <Text size={FontSizes.EXTRA_SMALL}>
        Retirada inicial:{" "}
        {hideValues ? "***" : formatCurrency(s.monthlyWithdrawal)}/mês
      </Text>
      <Text size={FontSizes.EXTRA_SMALL}>
        Até os {s.targetAge} anos · veja a variação da renda na simulação.
      </Text>
    </Stack>
  );
}
