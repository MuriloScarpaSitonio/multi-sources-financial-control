import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";

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

export const FutureExpensesIndicator = ({
  value,
  bankAmount,
  futureRevenues,
  isLoading,
  width = "100%",
}: {
  value: number;
  bankAmount: number;
  futureRevenues: number;
  isLoading: boolean;
  width?: string;
}) => {
  const { hideValues } = useHideValues();
  const availableFunds = bankAmount + futureRevenues;
  const canCoverFutureExpenses = availableFunds >= value;

  if (isLoading) {
    return (
      <Skeleton width="100%" height={80} sx={{ borderRadius: "10px" }} />
    );
  }

  const bankAmountFormatted = hideValues ? "***" : formatCurrency(bankAmount);
  const futureRevenuesFormatted = hideValues ? "***" : formatCurrency(futureRevenues);
  const availableFundsFormatted = hideValues ? "***" : formatCurrency(availableFunds);
  const tooltipTitle = canCoverFutureExpenses
    ? `Suas despesas futuras estão cobertas. Saldo em conta (${bankAmountFormatted}) + receitas futuras (${futureRevenuesFormatted}) = ${availableFundsFormatted}`
    : `Suas despesas futuras excedem seus recursos disponíveis. Saldo em conta (${bankAmountFormatted}) + receitas futuras (${futureRevenuesFormatted}) = ${availableFundsFormatted}`;

  return (
    <Tooltip title={tooltipTitle} arrow placement="top">
      <div style={{ width }}>
        <IndicatorBox variant={canCoverFutureExpenses ? "success" : "danger"} width="100%">
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ width: "100%" }}
          >
            <Text size={FontSizes.SMALL} color={Colors.neutral300}>
              Despesas futuras
            </Text>
            <Stack direction="row" alignItems="baseline" gap={0.5}>
              {hideValues ? (
                <Skeleton
                  sx={{
                    bgcolor: getColor(Colors.neutral300),
                    width: "80px",
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
                  {formatCurrency(value)}
                </Text>
              )}
            </Stack>
          </Stack>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

