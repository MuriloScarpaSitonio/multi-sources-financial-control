import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isFilteringWholeMonth } from "../../../../design-system";
import { getAvg, getSumCredited, getSumProvisionedFuture } from "../api";
import { useCallback, useMemo } from "react";

const SUM_CREDITED_QUERY_KEY = "incomes-sum-credited";

export const useIncomesSumCredited = (params: {
  startDate: Date;
  endDate: Date;
}) =>
  useQuery({
    queryKey: [SUM_CREDITED_QUERY_KEY, params],
    queryFn: () => getSumCredited(params),
  });

const AVG_QUERY_KEY = "incomes-avg";

export const useIncomesAvg = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: [AVG_QUERY_KEY],
    queryFn: getAvg,
    enabled,
  });

export const useIncomesIndicators = (params: {
  startDate: Date;
  endDate: Date;
}) => {
  const isFilteringEntireMonth = isFilteringWholeMonth(
    params.startDate,
    params.endDate,
  );

  const {
    data: { total } = { total: 0 },
    isPending: isIncomesSumCreditedLoading,
    isError: isIncomesSumCreditedError,
  } = useIncomesSumCredited(params);
  const {
    data: { avg } = { avg: 0 },
    isPending: isIncomesAvgLoading,
    isError: isIncomesAvgError,
  } = useIncomesAvg({ enabled: isFilteringEntireMonth });
  const isPending = isIncomesSumCreditedLoading || isIncomesAvgLoading;
  const isError = isIncomesSumCreditedError || isIncomesAvgError;

  const diff = useMemo(() => {
    if (isFilteringEntireMonth) {
      if (avg && total) return (total / avg - 1) * 100;
      return 0;
    }
    return undefined;
  }, [isFilteringEntireMonth, total, avg]);

  return {
    data:
      !isPending && !isError
        ? {
            credited: total,
            avg: avg,
            diff,
          }
        : undefined,
    isPending,
    isError,
  };
};

export const useInvalidateIncomesIndicatorsQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [SUM_CREDITED_QUERY_KEY],
    });
    await queryClient.invalidateQueries({
      queryKey: [AVG_QUERY_KEY],
    });
  }, [queryClient]);

  return { invalidate };
};

const SUM_PROVISONED_FUTURE_QUERY_KEY = "incomes-sum-provisioned-future";

export const useIncomesSumProvisionedFuture = () =>
  useQuery({
    queryKey: [SUM_PROVISONED_FUTURE_QUERY_KEY],
    queryFn: getSumProvisionedFuture,
  });

export const useInvalidateIncomesSumProvisionedFutureQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [SUM_PROVISONED_FUTURE_QUERY_KEY],
    });
  }, [queryClient]);

  return { invalidate };
};
