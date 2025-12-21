import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getHistoric, getTotalBoughtPerAssetTypeReport } from "../api";
import { useCallback } from "react";

const HISTORIC_QUERY_KEY = "transactions-historic";

export const useTransactionsHistoric = (params: {
  startDate: Date;
  endDate: Date;
  aggregatePeriod: "month" | "year";
}) =>
  useQuery({
    queryKey: [HISTORIC_QUERY_KEY, { params }],
    queryFn: () => getHistoric(params),
  });

export const useInvalidateTransactionsHistoricQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [HISTORIC_QUERY_KEY],
    });
  }, [queryClient]);

  return { invalidate };
};

const TOTAL_BOUGHT_PER_TYPE_QUERY_KEY =
  "transactions-total-bought-per-asset-type-report";

export const useTransactionsTotalBoughtPerAssetTypeReport = (params: {
  startDate: Date;
  endDate: Date;
}) =>
  useQuery({
    queryKey: [TOTAL_BOUGHT_PER_TYPE_QUERY_KEY, { params }],
    queryFn: () => getTotalBoughtPerAssetTypeReport(params),
  });

export const useInvalidateTotalBoughtPerAssetTypeReportQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [TOTAL_BOUGHT_PER_TYPE_QUERY_KEY],
    });
  }, [queryClient]);

  return { invalidate };
};
