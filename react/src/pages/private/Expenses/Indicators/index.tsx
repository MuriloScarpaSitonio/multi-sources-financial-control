import { useContext, useMemo } from "react";

import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";

import { Indicator } from "../../components";
import { useExpensesIndicators, useMostExpensiveExpense } from "./hooks";
import PercentageChangeSecondaryIndicator from "./PercentageChangeSecondaryIndicator";

import { Colors, FontSizes, getColor, Text } from "../../../../design-system";
import { ExpensesContext } from "../context";
import { Expense } from "../api/models";
import { StatusDot } from "../../../../design-system/icons";
import { useBankAccount } from "../hooks";
import { IndicatorBox } from "./components";
import BankAccountIndicator from "./BankAccountIndicator";
import { useRevenuesIndicators } from "../../Revenues/hooks/useRevenuesIndicators";
import ExpenseRevenuesRatioLinearProgress from "./ExpenseRevenuesRatioLinearProgress";
import { useHideValues } from "../../../../hooks/useHideValues";

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
    <IndicatorBox variant={variant} width="50%">
      <Stack direction="row" gap={1}>
        {variant === "danger" ? (
          <ReportProblemOutlinedIcon
            sx={{ color: getColor(Colors.danger200) }}
          />
        ) : (
          <CheckCircleOutlinedIcon sx={{ color: getColor(Colors.brand) }} />
        )}
        <Text size={FontSizes.SMALL}>
          {`Gasto mensal ${variant === "danger" ? "acima" : "dentro"} da média`}
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
}) => {
  const { hideValues } = useHideValues();
  if (isLoading)
    return (
      <Skeleton
        width="50%"
        height={80}
        sx={{
          borderRadius: "10px",
        }}
      />
    );

  return (
    <IndicatorBox variant={value > 0 ? "success" : "danger"} width="50%">
      <Text size={FontSizes.SMALL}>
        <Stack direction="row" gap={1}>
          Diferença:{" "}
          {hideValues ? (
            <Skeleton
              sx={{ bgcolor: getColor(Colors.neutral300), width: "50%" }}
              animation={false}
            />
          ) : (
            `R$
          ${value.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
          )}
        </Stack>
      </Text>
    </IndicatorBox>
  );
};

const MostExpensiveIndicator = ({
  expense,
  isLoading,
}: {
  expense: Expense | undefined;
  isLoading: boolean;
}) => {
  const { categories, isRelatedEntitiesLoading } = useContext(ExpensesContext);
  const { hideValues } = useHideValues();

  if (isLoading || isRelatedEntitiesLoading)
    return (
      <Skeleton
        width="50%"
        height={80}
        sx={{
          borderRadius: "10px",
        }}
      />
    );
  if (!expense?.value)
    return (
      <IndicatorBox variant="danger" width="50%" height="50%">
        <Text size={FontSizes.SMALL}>Nenhuma despesa encontrada</Text>
      </IndicatorBox>
    );
  return (
    <IndicatorBox variant="danger" width="50%">
      <Stack gap={1}>
        <Text size={FontSizes.SMALL}>Despesa mais cara:</Text>
        <Stack direction="row" spacing={1} alignItems="center">
          <Text size={FontSizes.SEMI_SMALL} color={Colors.neutral300}>
            {expense?.full_description}
          </Text>
          <StatusDot
            variant="custom"
            color={categories.hexColorMapping.get(expense?.category as string)}
          />
        </Stack>
        {hideValues ? (
          <Skeleton
            sx={{ bgcolor: getColor(Colors.neutral300), width: "50%" }}
            animation={false}
          />
        ) : (
          <Text size={FontSizes.SMALL}>
            R${" "}
            {expense?.value?.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        )}
      </Stack>
    </IndicatorBox>
  );
};

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
  const { data: mostExpensiveExpense, isPending: isMostExpensiveLoading } =
    useMostExpensiveExpense({ startDate, endDate });

  const { data: bankAccount, isPending: isBankAccountLoading } =
    useBankAccount();

  const isLoading = isExpensesIndicatorsLoading || isRevenuesIndicatorsLoading;
  const isFilteringEntireMonth =
    !isExpensesIndicatorsLoading && expensesIndicators?.diff !== undefined;

  const percentage = useMemo(() => {
    if (expensesIndicators && revenuesIndicators)
      return (
        ((expensesIndicators?.total ?? 0) / (revenuesIndicators?.total || 1)) *
        100
      );
    return 0;
  }, [expensesIndicators, revenuesIndicators]);

  const balance = useMemo(() => {
    if (expensesIndicators && revenuesIndicators)
      return revenuesIndicators?.total - expensesIndicators?.total;
    return 0;
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
          sx={{ width: "50%" }}
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
          sx={{ width: "50%" }}
        />
      </Stack>
      <ExpenseRevenuesRatioLinearProgress
        percentage={percentage}
        isLoading={isLoading}
      />
      <Stack direction="row" gap={4}>
        <BalanceIndicator value={balance} isLoading={isLoading} />
        {isFilteringEntireMonth && (
          <ExpenseAvgDiffIndicator
            value={expensesIndicators?.diff ?? 0}
            isLoading={isLoading}
          />
        )}
      </Stack>
      <Stack direction="row" gap={4}>
        {isBankAccountLoading ? (
          <Skeleton
            width="50%"
            height={80}
            sx={{
              borderRadius: "10px",
            }}
          />
        ) : (
          <BankAccountIndicator
            amount={bankAccount?.amount ?? 0}
            description={bankAccount?.description ?? ""}
          />
        )}
        <MostExpensiveIndicator
          expense={mostExpensiveExpense}
          isLoading={isMostExpensiveLoading}
        />
      </Stack>
    </Stack>
  );
};

export default Indicators;
