import { useState } from "react";

import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
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

const FIRELinearProgress = styled(LinearProgress)(({ value }) => ({
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

const FIREProgressBar = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  multiplier,
  onMultiplierChange,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  multiplier: number;
  onMultiplierChange: (value: number) => void;
}) => {
  const { hideValues } = useHideValues();
  const annualExpenses = avgExpenses * 12;
  const fireNumber = annualExpenses * multiplier;
  const fireProgress = fireNumber > 0 ? (patrimonyTotal / fireNumber) * 100 : 0;
  const withdrawalRate = (100 / multiplier).toFixed(1);
  const monthlyWithdrawal = patrimonyTotal * (100 / multiplier / 100) / 12;

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const annualExpensesFormatted = hideValues ? "***" : formatCurrency(annualExpenses);
  const monthlyWithdrawalFormatted = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const tooltipTitle = `Patrimônio / (despesas anuais × ${multiplier}). Despesas anuais: ${annualExpensesFormatted}. Meta: acumular ${multiplier}x suas despesas anuais para viver dos rendimentos (regra dos ${withdrawalRate}%). Retirada mensal: ${monthlyWithdrawalFormatted}`;

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <FIRELinearProgress
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
            <Text
              color={Colors.neutral0}
              weight={FontWeights.MEDIUM}
              size={FontSizes.SEMI_SMALL}
            >
              Independência financeira (FIRE)
            </Text>
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
                {fireProgress.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {multiplier}x ({withdrawalRate}%) ·{" "}
          {hideValues ? "***" : formatCurrency(monthlyWithdrawal)}/mês
        </Text>
        <Slider
          value={multiplier}
          onChange={(_, value) => onMultiplierChange(value as number)}
          min={25}
          max={35}
          step={1}
          size="medium"
          sx={{
            width: 100,
            "& .MuiSlider-thumb": {
              width: 14,
              height: 14,
              backgroundColor: getColor(Colors.brand500),
              "&:hover, &.Mui-focusVisible": {
                boxShadow: `0 0 0 8px ${getColor(Colors.brand500)}33`,
              },
            },
            "& .MuiSlider-track": {
              backgroundColor: getColor(Colors.brand500),
              border: "none",
            },
            "& .MuiSlider-rail": {
              backgroundColor: getColor(Colors.brand500),
            },
          }}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {multiplier === 25
            ? "Regra clássica do Trinity Study (30 anos de aposentadoria)."
            : multiplier <= 28
              ? "Margem de segurança um pouco maior."
              : multiplier <= 32
                ? "Conservador, ideal para aposentadorias de 40+ anos."
                : "Ultra-conservador, para horizontes de 50+ anos."}
        </Text>
      </Stack>
    </Stack>
  );
};

export default FIREProgressBar;
