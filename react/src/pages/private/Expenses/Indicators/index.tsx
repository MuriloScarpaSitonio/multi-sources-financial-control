import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { styled } from "@mui/material/styles";

import { Indicator } from "../../components";
import { useExpensesIndicators, useRevenuesIndicators } from "./hooks";
import PercentageChangeSecondaryIndicator from "./PercentageChangeSecondaryIndicator";
import LinearProgress, {
  linearProgressClasses,
} from "@mui/material/LinearProgress";
import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../../design-system";
import { ReactNode, useContext, useMemo } from "react";
import { ExpensesContext } from "../context";

const BorderLinearProgress = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral200),
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 10,
    backgroundColor:
      value && value === 100
        ? getColor(Colors.danger200)
        : getColor(Colors.brand),
  },
}));

const IndicatorBox = ({
  children,
  variant,
  width,
}: {
  children: ReactNode;
  variant: "success" | "danger";
  width: string;
}) => (
  <Box
    sx={{
      textAlign: "center",
      p: 2,
      borderRadius: "10px",
      border: `2px solid ${variant === "success" ? getColor(Colors.brand) : getColor(Colors.danger200)}`,
      width,
    }}
  >
    {children}
  </Box>
);

const ExpenseAvgDiffIndicator = ({
  value,
  isLoading,
}: {
  value: number;
  isLoading: boolean;
}) => {
  const variant = value > 0 ? "danger" : "success";
  return isLoading ? (
    <Skeleton
      width="50%"
      height={80}
      sx={{
        borderRadius: "10px",
      }}
    />
  ) : (
    <IndicatorBox variant={variant} width="60%">
      <Stack direction="row" gap={1}>
        {variant === "danger" ? (
          <ReportProblemOutlinedIcon
            sx={{ color: getColor(Colors.danger200) }}
          />
        ) : (
          <CheckCircleOutlinedIcon sx={{ color: getColor(Colors.brand) }} />
        )}
        <Text size={FontSizes.SEMI_REGULAR}>
          {variant === "danger"
            ? "Gasto mensal acima da média"
            : "Gasto mensal dentro da média"}
        </Text>
      </Stack>
    </IndicatorBox>
  );
};

const BalanceIndicator = ({
  value,
  isLoading,
}: {
  value: number;
  isLoading: boolean;
}) =>
  isLoading ? (
    <Skeleton
      width="50%"
      height={80}
      sx={{
        borderRadius: "10px",
      }}
    />
  ) : (
    <IndicatorBox variant={value > 0 ? "success" : "danger"} width="40%">
      <Text size={FontSizes.SEMI_REGULAR}>
        Saldo: R${" "}
        {value.toLocaleString("pt-br", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </Text>
    </IndicatorBox>
  );

const Indicators = () => {
  const { startDate, endDate } = useContext(ExpensesContext);
  const {
    data: expensesIndicators,
    isPending: isExpensesIndicatorsLoading,
    isError: isExpensesIndicatorsError,
  } = useExpensesIndicators({ startDate, endDate });
  const {
    data: revenuesIndicators,
    isPending: isRevenuesIndicatorsLoading,
    isError: isRevenuesIndicatorsError,
  } = useRevenuesIndicators({ startDate, endDate });

  const isLoading = isExpensesIndicatorsLoading || isRevenuesIndicatorsLoading;
  const isFilteringEntireMonth =
    !isExpensesIndicatorsLoading && expensesIndicators?.diff !== undefined;

  const percentage = useMemo(() => {
    if (expensesIndicators && revenuesIndicators)
      return (
        ((expensesIndicators?.total ?? 0) / (revenuesIndicators?.total ?? 1)) *
        100
      );
  }, [expensesIndicators, revenuesIndicators]);

  const balance = useMemo(() => {
    if (expensesIndicators && revenuesIndicators)
      return revenuesIndicators?.total - expensesIndicators?.total;
  }, [expensesIndicators, revenuesIndicators]);

  return (
    <Stack gap={4}>
      <Stack direction="row" gap={4}>
        <Indicator
          title="Receitas"
          value={revenuesIndicators?.total}
          secondaryIndicator={
            isFilteringEntireMonth && (
              <PercentageChangeSecondaryIndicator
                value={revenuesIndicators?.diff}
                variant={
                  revenuesIndicators && (revenuesIndicators.diff ?? 0) > 0
                    ? "success"
                    : "danger"
                }
                isLoading={isRevenuesIndicatorsLoading}
              />
            )
          }
          Icon={MonetizationOnOutlinedIcon}
          variant="success"
          isLoading={isRevenuesIndicatorsLoading}
          isError={isRevenuesIndicatorsError}
        />
        <Indicator
          title="Despesas"
          value={expensesIndicators?.total}
          secondaryIndicator={
            isFilteringEntireMonth && (
              <PercentageChangeSecondaryIndicator
                value={expensesIndicators?.diff}
                variant={
                  expensesIndicators && (expensesIndicators.diff ?? 0) < 0
                    ? "success"
                    : "danger"
                }
                isIconInverse
                isLoading={isExpensesIndicatorsLoading}
              />
            )
          }
          Icon={MonetizationOnOutlinedIcon}
          variant="danger"
          isLoading={isExpensesIndicatorsLoading}
          isError={isExpensesIndicatorsError}
        />
      </Stack>
      {isLoading ? (
        <Skeleton
          height={48}
          sx={{
            borderRadius: "10px",
          }}
        />
      ) : (
        <div style={{ position: "relative" }}>
          <BorderLinearProgress
            variant="determinate"
            value={Math.min(percentage ?? 0, 100)}
          />
          <Text
            extraStyle={{
              position: "absolute",
              top: "10%",
              left: "94%",
              transform: "translateX(-50%)",
            }}
            color={Colors.neutral900}
            weight={FontWeights.SEMI_BOLD}
            size={FontSizes.SEMI_SMALL}
          >
            {percentage?.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            %
          </Text>
        </div>
      )}
      <Stack direction="row" gap={2}>
        <BalanceIndicator value={balance ?? 0} isLoading={isLoading} />
        {isFilteringEntireMonth && (
          <ExpenseAvgDiffIndicator
            value={expensesIndicators?.diff ?? 0}
            isLoading={isLoading}
          />
        )}
      </Stack>
    </Stack>
  );
};

export default Indicators;
