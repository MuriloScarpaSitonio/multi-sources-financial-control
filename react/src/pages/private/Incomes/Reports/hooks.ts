import type { QueryClient } from "@tanstack/react-query";

import { useCallback } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getCreditedByAssetType, getHistoric, getTopAssets } from "../api";

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

const CREDITED_BY_ASSET_TYPE_QUERY_KEY = "incomes-credited-by-asset-type-report";

export const useIncomesCreditedByAssetTypeReport = (params: {
  startDate: Date;
  endDate: Date;
}) =>
  useQuery({
    queryKey: [CREDITED_BY_ASSET_TYPE_QUERY_KEY, { params }],
    queryFn: () => getCreditedByAssetType(params),
  });

export const useInvalidateIncomesCreditedByAssetTypeReportQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [CREDITED_BY_ASSET_TYPE_QUERY_KEY],
    });
  }, [queryClient]);

  return { invalidate };
};
