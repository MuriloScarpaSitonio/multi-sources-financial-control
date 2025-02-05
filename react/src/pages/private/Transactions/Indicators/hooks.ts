import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isFilteringWholeMonth } from "../../../../design-system";
import { getAvg, getSum } from "../api";
import { useCallback } from "react";

const SUM_QUERY_KEY = "transactions-sum";

export const useTransactionsSum = (params: {
  startDate: Date;
  endDate: Date;
}) =>
  useQuery({
    queryKey: [SUM_QUERY_KEY, params],
    queryFn: () => getSum(params),
  });

const AVG_QUERY_KEY = "transactions-avg";

const useTransactionsAvg = ({ enabled = true }: { enabled?: boolean }) =>
  useQuery({
    queryKey: [AVG_QUERY_KEY],
    queryFn: getAvg,
    enabled,
  });

export const useTransactionsIndicators = (params: {
  startDate: Date;
  endDate: Date;
}) => {
  const isFilteringEntireMonth = isFilteringWholeMonth(
    params.startDate,
    params.endDate,
  );

  const {
    data: transactionsSumData,
    isPending: isTransactionsSumLoading,
    isError: isTransactionsSumError,
  } = useTransactionsSum(params);
  const {
    data: transactionsAvgData,
    isPending: isTransactionsAvgLoading,
    isError: isTransactionsAvgError,
  } = useTransactionsAvg({ enabled: isFilteringEntireMonth });

  return {
    data:
      transactionsSumData && transactionsAvgData
        ? {
            bought: transactionsSumData.bought,
            sold: transactionsSumData.sold,
            avg: transactionsAvgData.avg,
            diff: isFilteringEntireMonth
              ? transactionsAvgData.avg
                ? ((transactionsSumData.bought - transactionsSumData.sold) /
                    transactionsAvgData.avg -
                    1) *
                  100
                : 0
              : undefined,
          }
        : undefined,
    isPending: isTransactionsSumLoading || isTransactionsAvgLoading,
    isError: isTransactionsSumError || isTransactionsAvgError,
  };
};

export const useInvalidateTransactionsIndicatorsQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [SUM_QUERY_KEY],
    });
    await queryClient.invalidateQueries({
      queryKey: [AVG_QUERY_KEY],
    });
  }, [queryClient]);

  return { invalidate };
};
