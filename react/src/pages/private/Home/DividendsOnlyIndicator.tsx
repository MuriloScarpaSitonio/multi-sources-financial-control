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

const DividendsLinearProgress = styled(LinearProgress)(({ value }) => ({
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

const DividendsOnlyIndicator = ({
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

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const avgPassiveIncomeFormatted = hideValues ? "***" : formatCurrency(avgPassiveIncome);
  const avgExpensesFormatted = hideValues ? "***" : formatCurrency(avgExpenses);
  const tooltipTitle = `Viver apenas de proventos: média mensal de proventos (${avgPassiveIncomeFormatted}) / média mensal de despesas FIRE (${avgExpensesFormatted}). Meta: 100% para cobrir todas as despesas apenas com dividendos e proventos.`;

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <DividendsLinearProgress
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
            <Text
              color={Colors.neutral0}
              weight={FontWeights.MEDIUM}
              size={FontSizes.SEMI_SMALL}
            >
              Viver de proventos
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
                {coveragePercentage.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Cobertura das despesas apenas com dividendos e proventos
      </Text>
    </Stack>
  );
};

export default DividendsOnlyIndicator;
