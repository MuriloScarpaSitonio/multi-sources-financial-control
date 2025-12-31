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
} from "../../../../design-system";
import { IndicatorBox } from "./components";
import { useHideValues } from "../../../../hooks/useHideValues";
import { formatCurrency } from "../../utils";

const PassiveIncomeCoverageLinearProgress = styled(LinearProgress)<{ percentage: number }>(
  ({ percentage }) => ({
    height: 6,
    borderRadius: 3,
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: getColor(Colors.neutral600),
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: 3,
      backgroundColor: percentage >= 100
        ? getColor(Colors.brand)
        : getColor(Colors.danger200),
    },
  }),
);

export const PassiveIncomeCoverageIndicator = ({
  avgPassiveIncome,
  avgExpenses,
  isLoading,
}: {
  avgPassiveIncome: number;
  avgExpenses: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const coveragePercentage = avgExpenses > 0 ? (avgPassiveIncome / avgExpenses) * 100 : 0;
  const isFullyCovered = coveragePercentage >= 100;

  if (isLoading) {
    return (
      <Skeleton width="100%" height={80} sx={{ borderRadius: "10px" }} />
    );
  }

  const avgPassiveIncomeFormatted = hideValues ? "***" : formatCurrency(avgPassiveIncome);
  const avgExpensesFormatted = hideValues ? "***" : formatCurrency(avgExpenses);
  const tooltipTitle = `Média mensal de proventos (${avgPassiveIncomeFormatted}) / média mensal de despesas (${avgExpensesFormatted}) dos últimos 12 meses. Meta: 100% para independência financeira.`;

  return (
    <Tooltip title={tooltipTitle} arrow placement="top">
      <div style={{ width: "100%" }}>
        <IndicatorBox variant={isFullyCovered ? "success" : "danger"} width="100%">
          <Stack gap={0.5} sx={{ width: "100%" }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ width: "100%" }}
            >
              <Text size={FontSizes.SMALL} color={Colors.neutral300}>
                Cobertura de proventos
              </Text>
              <Stack direction="row" alignItems="baseline" gap={0.5}>
                {hideValues ? (
                  <Skeleton
                    sx={{
                      bgcolor: getColor(Colors.neutral300),
                      width: "60px",
                      display: "inline-block",
                    }}
                    animation={false}
                  />
                ) : (
                  <Text
                    size={FontSizes.SMALL}
                    weight={FontWeights.BOLD}
                    color={Colors.neutral0}
                  >
                    {coveragePercentage.toFixed(1)}%
                  </Text>
                )}
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  das despesas
                </Text>
              </Stack>
            </Stack>
            <PassiveIncomeCoverageLinearProgress
              variant="determinate"
              value={Math.min(coveragePercentage, 100)}
              percentage={coveragePercentage}
            />
          </Stack>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

