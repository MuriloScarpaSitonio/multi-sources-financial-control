import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getHistoric, getTopAssets } from "../api";
import { useCallback } from "react";

const HISTORIC_QUERY_KEY = "incomes-historic";

export const useIncomesHistoric = (params: {
  startDate: Date;
  endDate: Date;
  aggregatePeriod: "month" | "year";
}) =>
  useQuery({
    queryKey: [HISTORIC_QUERY_KEY, { params }],
    queryFn: () => getHistoric(params),
  });

export const useInvalidateIncomesHistoricQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [HISTORIC_QUERY_KEY],
    });
  }, [queryClient]);

  return { invalidate };
};

const TOP_ASSETS_REPORTS_QUERY_KEY = "incomes-top-assets-report";

export const useIncomesTopAssetsReport = (params: {
  startDate: Date;
  endDate: Date;
}) =>
  useQuery({
    queryKey: [TOP_ASSETS_REPORTS_QUERY_KEY, { params }],
    queryFn: () => getTopAssets(params),
  });

export const useInvalidateIncomesTopAssetsReportQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [TOP_ASSETS_REPORTS_QUERY_KEY],
    });
  }, [queryClient]);

  return { invalidate };
};
