import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { startOfMonth } from "date-fns";

import { getAvg, getSum } from "../api";
import { isFilteringWholeMonth } from "../../Expenses/utils";

const SUM_QUERY_KEY = "revenues-sum";

export const useRevenuesSum = (params: { startDate: Date; endDate: Date }) =>
  useQuery({
    queryKey: [SUM_QUERY_KEY, params],
    queryFn: () => getSum(params),
  });

const AVG_QUERY_KEY = "revenues-avg";

const useRevenuesAvg = ({ enabled = true }: { enabled?: boolean }) =>
  useQuery({
    queryKey: [AVG_QUERY_KEY],
    queryFn: getAvg,
    enabled,
  });

export const useRevenuesIndicators = (params: {
  startDate: Date;
  endDate: Date;
}) => {
  const { startDate, endDate } = params;
  const isFilteringEntireMonth = isFilteringWholeMonth(startDate, endDate);
  const {
    data: revenuesSumData,
    isPending: isRevenuesSumLoading,
    isError: isRevenuesSumError,
  } = useRevenuesSum({ startDate: startOfMonth(startDate), endDate });
  const {
    data: revenuesAvgData,
    isPending: isRevenuesAvgLoading,
    isError: isRevenuesAvgError,
  } = useRevenuesAvg({ enabled: isFilteringEntireMonth });

  return {
    data:
      revenuesSumData && revenuesAvgData
        ? {
            total: revenuesSumData.total,
            avg: revenuesAvgData.avg,
            diff: isFilteringEntireMonth
              ? revenuesAvgData.avg
                ? (revenuesSumData.total / revenuesAvgData.avg - 1) * 100
                : 0
              : undefined,
          }
        : undefined,
    isPending: isRevenuesSumLoading || isRevenuesAvgLoading,
    isError: isRevenuesSumError || isRevenuesAvgError,
  };
};

export const useInvalidateRevenuesIndicatorsQueries = (
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
  };

  return { invalidate };
};
