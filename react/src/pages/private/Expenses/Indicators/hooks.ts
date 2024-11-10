import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getAvg, getMostExpensive, getSum } from "../api/expenses";
import { isFilteringWholeMonth } from "../utils";

const SUM_QUERY_KEY = "expenses-sum";

export const useExpensesSum = (params: { startDate: Date; endDate: Date }) =>
  useQuery({
    queryKey: [SUM_QUERY_KEY, params],
    queryFn: () => getSum(params),
  });

const AVG_QUERY_KEY = "expenses-avg";

const useExpensesAvg = ({ enabled = true }: { enabled?: boolean }) =>
  useQuery({
    queryKey: [AVG_QUERY_KEY],
    queryFn: getAvg,
    enabled,
  });

export const useExpensesIndicators = (params: {
  startDate: Date;
  endDate: Date;
}) => {
  const isFilteringEntireMonth = isFilteringWholeMonth(
    params.startDate,
    params.endDate,
  );

  const {
    data: expensesSumData,
    isPending: isExpensesSumLoading,
    isError: isExpensesSumError,
  } = useExpensesSum(params);
  const {
    data: expensesAvgData,
    isPending: isExpensesAvgLoading,
    isError: isExpensesAvgError,
  } = useExpensesAvg({ enabled: isFilteringEntireMonth });

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
    isPending: isExpensesSumLoading || isExpensesAvgLoading,
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
  };

  return { invalidate };
};
