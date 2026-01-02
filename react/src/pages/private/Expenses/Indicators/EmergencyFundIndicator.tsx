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

const EmergencyFundLinearProgress = styled(LinearProgress)<{ isHealthy?: boolean }>(
  ({ isHealthy }) => ({
    height: 6,
    borderRadius: 3,
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: getColor(Colors.neutral600),
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: 3,
      backgroundColor: isHealthy
        ? getColor(Colors.brand)
        : getColor(Colors.danger200),
    },
  }),
);

const TARGET_MONTHS = 6;

export const EmergencyFundIndicator = ({
  monthsCovered,
  avgExpenses,
  bankAmount,
  liquidAssetsTotal,
  isLoading,
}: {
  monthsCovered: number;
  avgExpenses: number;
  bankAmount: number;
  liquidAssetsTotal: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const progress = Math.min((monthsCovered / TARGET_MONTHS) * 100, 100);
  const isHealthy = monthsCovered >= TARGET_MONTHS;

  if (isLoading) {
    return (
      <Skeleton width="100%" height={120} sx={{ borderRadius: "10px" }} />
    );
  }

  const avgExpensesFormatted = hideValues ? "***" : formatCurrency(avgExpenses);
  const tooltipTitle = `Saldo líquido (Saldo em conta + Ativos líquidos: ${formatCurrency(bankAmount + liquidAssetsTotal)}) / média mensal de despesas (dos últimos 12 meses: ${avgExpensesFormatted}).`;

  return (
    <Tooltip title={tooltipTitle} arrow placement="top">
      <div style={{ width: "100%" }}>
        <IndicatorBox variant={isHealthy ? "success" : "danger"} width="100%">
          <Stack gap={1} sx={{ width: "100%" }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ width: "100%" }}
            >
              <Text size={FontSizes.SMALL} color={Colors.neutral300}>
                Reserva de emergência
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
                    {monthsCovered.toFixed(1)} meses
                  </Text>
                )}
                <Text size={FontSizes.SMALL} color={Colors.neutral400}>
                  de {TARGET_MONTHS} meses (meta)
                </Text>
              </Stack>
            </Stack>
            <Text size={FontSizes.SEMI_SMALL} color={Colors.neutral400}>
              Saldo em Conta{" "}
              {hideValues ? (
                <Skeleton
                  sx={{
                    bgcolor: getColor(Colors.neutral300),
                    width: "50px",
                    display: "inline-block",
                    verticalAlign: "middle",
                  }}
                  animation={false}
                />
              ) : (
                <Text
                  size={FontSizes.SEMI_SMALL}
                  weight={FontWeights.BOLD}
                  color={Colors.neutral300}
                  as="span"
                >
                  {formatCurrency(bankAmount)}
                </Text>
              )}
              {" | Ativos líquidos "}
              {hideValues ? (
                <Skeleton
                  sx={{
                    bgcolor: getColor(Colors.neutral300),
                    width: "50px",
                    display: "inline-block",
                    verticalAlign: "middle",
                  }}
                  animation={false}
                />
              ) : (
                <Text
                  size={FontSizes.SEMI_SMALL}
                  weight={FontWeights.BOLD}
                  color={Colors.neutral300}
                  as="span"
                >
                  {formatCurrency(liquidAssetsTotal)}
                </Text>
              )}
            </Text>
            <EmergencyFundLinearProgress
              variant="determinate"
              value={Math.min(progress, 100)}
              isHealthy={isHealthy}
            />
          </Stack>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

