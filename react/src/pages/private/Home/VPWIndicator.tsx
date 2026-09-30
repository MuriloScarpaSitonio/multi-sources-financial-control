import { useMemo } from "react";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { FontSizes, FontWeights, Text } from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";
import type { VPWPlanningPreferences } from "../Planning/api";
import type { FireAllocationBucket } from "../Planning/fireAllocation";
import {
  ageFromBirthDate,
  buildVPWSnapshot,
} from "../Planning/vpw/vpwScenario";

type Props = {
  allocation: readonly FireAllocationBucket[];
  preferences: Required<VPWPlanningPreferences>;
  avgExpenses: number;
  isLoading: boolean;
  isError?: boolean;
  dateOfBirth: string | null;
  hideLabel?: boolean;
};
export default function VPWIndicator({
  allocation,
  preferences,
  avgExpenses,
  isLoading,
  isError = false,
  dateOfBirth,
  hideLabel = false,
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
