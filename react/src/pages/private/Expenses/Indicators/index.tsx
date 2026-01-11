import { useContext, useMemo } from "react";

import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";

import { Indicator } from "../../components";
import { isFilteringCurrentMonth, useExpensesIndicators, useHomeExpensesIndicators, useMostExpensiveExpense } from "./hooks";
import PercentageChangeSecondaryIndicator from "./PercentageChangeSecondaryIndicator";

import { Colors, FontSizes, FontWeights, getColor, Text } from "../../../../design-system";
import { ExpensesContext } from "../context";
import { Expense } from "../api/models";
import { StatusDot } from "../../../../design-system/icons";
import { useBankAccounts, useBankAccountsSummary } from "../hooks";
import { IndicatorBox } from "./components";
import BankAccountIndicator from "./BankAccountIndicator";
import { useRevenuesIndicators, useHomeRevenuesIndicators } from "../../Revenues/hooks/useRevenuesIndicators";
import ExpenseRevenuesRatioLinearProgress from "./ExpenseRevenuesRatioLinearProgress";
import { useHideValues } from "../../../../hooks/useHideValues";
import { EmergencyFundIndicator } from "./EmergencyFundIndicator";
import { FutureExpensesIndicator } from "./FutureExpensesIndicator";
import { formatCurrency } from "../../utils";
import { useEmergencyFundAssets } from "../../Assets/Indicators/hooks";

export const BalanceIndicator = ({
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
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ width: "100%" }}
      >
        <Text size={FontSizes.SMALL} color={Colors.neutral300}>
          Balanço
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

  // Check if we're filtering the current month - if so, use home indicators instead of separate API calls
  const isCurrentMonth = isFilteringCurrentMonth(startDate, endDate);

  // Only call these if NOT filtering current month (to avoid duplicate API calls)
  const {
    data: dateFilteredExpenses,
    isPending: isDateFilteredExpensesLoading,
    isError: isExpensesIndicatorsError,
  } = useExpensesIndicators({ startDate, endDate }, { enabled: !isCurrentMonth });
  const {
    data: dateFilteredRevenues,
    isPending: isDateFilteredRevenuesLoading,
    isError: isRevenuesIndicatorsError,
  } = useRevenuesIndicators({ startDate, endDate }, { enabled: !isCurrentMonth });

  const { data: mostExpensiveExpense, isPending: isMostExpensiveLoading } =
    useMostExpensiveExpense({ startDate, endDate });

  const { data: bankAccountsSummary, isPending: isBankAccountSummaryLoading } =
    useBankAccountsSummary();
  const { data: bankAccounts, isPending: isBankAccountsLoading } =
    useBankAccounts();
  const isBankAccountLoading = isBankAccountSummaryLoading || isBankAccountsLoading;

  const { total: emergencyFundAssetsTotal, isPending: isEmergencyFundAssetsLoading } =
    useEmergencyFundAssets();

  // Home indicators - always called (used for financial health indicators and current month data)
  const {
    data: homeExpensesIndicators,
    isPending: isHomeExpensesLoading,
  } = useHomeExpensesIndicators();
  const {
    data: homeRevenuesIndicators,
    isPending: isHomeRevenuesLoading,
  } = useHomeRevenuesIndicators();

  // Use home indicators when filtering current month, otherwise use date-filtered data
  const expensesIndicators = isCurrentMonth ? homeExpensesIndicators : dateFilteredExpenses;
  const revenuesIndicators = isCurrentMonth ? homeRevenuesIndicators : dateFilteredRevenues;
  const isExpensesIndicatorsLoading = isCurrentMonth ? isHomeExpensesLoading : isDateFilteredExpensesLoading;
  const isRevenuesIndicatorsLoading = isCurrentMonth ? isHomeRevenuesLoading : isDateFilteredRevenuesLoading;

  const isLoading = isExpensesIndicatorsLoading || isRevenuesIndicatorsLoading;
  const isFilteringEntireMonth =
    !isExpensesIndicatorsLoading && expensesIndicators?.diff !== undefined;

  const avgExpenses = homeExpensesIndicators?.avg ?? 0;
  const bankAmount = bankAccountsSummary?.total ?? 0;
  const totalEmergencyFund = bankAmount + emergencyFundAssetsTotal;
  const monthsCovered = avgExpenses > 0 ? totalEmergencyFund / avgExpenses : 0;

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
        <FutureExpensesIndicator
          width="50%"
          value={homeExpensesIndicators?.future ?? 0}
          bankAmount={bankAmount}
          futureRevenues={homeRevenuesIndicators?.future ?? 0}
          isLoading={isHomeExpensesLoading || isHomeRevenuesLoading}
        />
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
            total={bankAmount}
            accountCount={bankAccounts?.length ?? 0}
          />
        )}
        <MostExpensiveIndicator
          expense={mostExpensiveExpense}
          isLoading={isMostExpensiveLoading}
        />
      </Stack>
      <EmergencyFundIndicator
        monthsCovered={monthsCovered}
        avgExpenses={avgExpenses}
        bankAmount={bankAmount}
        liquidAssetsTotal={emergencyFundAssetsTotal}
        isLoading={isHomeExpensesLoading || isBankAccountLoading || isEmergencyFundAssetsLoading}
      />
    </Stack>
  );
};

export default Indicators;
