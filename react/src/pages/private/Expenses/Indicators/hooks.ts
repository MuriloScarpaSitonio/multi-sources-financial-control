import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { startOfMonth, endOfMonth, isEqual } from "date-fns";

import { isFilteringWholeMonth } from "../../../../design-system";
import {
  getAvg,
  getExpensesIndicators,
  getMostExpensive,
  getSum,
} from "../api/expenses";

export const isFilteringCurrentMonth = (startDate: Date, endDate: Date) => {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  currentMonthEnd.setHours(0, 0, 0, 0);

  return (
    isFilteringWholeMonth(startDate, endDate) &&
    isEqual(startDate, currentMonthStart) &&
    isEqual(endDate, currentMonthEnd)
  );
};

const SUM_QUERY_KEY = "expenses-sum";

export const useExpensesSum = (
  params: { startDate: Date; endDate: Date },
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: [SUM_QUERY_KEY, params],
    queryFn: () => getSum(params),
    enabled: options?.enabled ?? true,
  });

const AVG_QUERY_KEY = "expenses-avg";

const useExpensesAvg = ({ enabled = true }: { enabled?: boolean }) =>
  useQuery({
    queryKey: [AVG_QUERY_KEY],
    queryFn: getAvg,
    enabled,
  });

export const useExpensesIndicators = (
  params: { startDate: Date; endDate: Date },
  options?: { enabled?: boolean },
) => {
  const enabled = options?.enabled ?? true;
  const isFilteringEntireMonth = isFilteringWholeMonth(
    params.startDate,
    params.endDate,
  );

  const {
    data: expensesSumData,
    isPending: isExpensesSumLoading,
    isError: isExpensesSumError,
  } = useExpensesSum(params, { enabled });
  const {
    data: expensesAvgData,
    isPending: isExpensesAvgLoading,
    isError: isExpensesAvgError,
  } = useExpensesAvg({ enabled: enabled && isFilteringEntireMonth });

  return {
    data:
      expensesSumData && expensesAvgData
        ? {
            total: expensesSumData.total,
            avg: expensesAvgData.avg,
            diff: isFilteringEntireMonth
              ? expensesAvgData.avg
                ? (expensesSumData.total / expensesAvgData.avg - 1) * 100
                : 0
              : undefined,
          }
        : undefined,
    isPending: enabled && (isExpensesSumLoading || isExpensesAvgLoading),
    isError: isExpensesSumError || isExpensesAvgError,
  };
};

const MOST_EXPENSIVE_QUERY_KEY = "most-expensive-query";

export const useMostExpensiveExpense = (params: {
  startDate: Date;
  endDate: Date;
}) =>
  useQuery({
    queryKey: [MOST_EXPENSIVE_QUERY_KEY, params],
    queryFn: () => getMostExpensive(params),
  });

const INDICATORS_QUERY_KEY = "expenses-indicators";

export const useHomeExpensesIndicators = (params?: { includeFireAvg?: boolean }) =>
  useQuery({
    queryKey: [INDICATORS_QUERY_KEY, params],
    queryFn: () => getExpensesIndicators(params),
  });

export const useInvalidateExpensesIndicatorsQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [SUM_QUERY_KEY],
    });
    await queryClient.invalidateQueries({
      queryKey: [AVG_QUERY_KEY],
    });
    await queryClient.invalidateQueries({
      queryKey: [MOST_EXPENSIVE_QUERY_KEY],
    });
    await queryClient.invalidateQueries({
      queryKey: [INDICATORS_QUERY_KEY],
    });
  };

  return { invalidate };
};
