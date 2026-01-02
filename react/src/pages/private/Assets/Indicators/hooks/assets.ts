import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getIndicators, getGrowth, getEmergencyFundTotal } from "../../api";
import { useCallback } from "react";

const QUERY_KEY = "assets-indicators";
const GROWTH_QUERY_KEY = "assets-growth";
const EMERGENCY_FUND_ASSETS_QUERY_KEY = "emergency-fund-assets";

export const useAssetsIndicators = (params?: { includeYield?: boolean }) =>
  useQuery({
    queryKey: [QUERY_KEY, params?.includeYield],
    queryFn: () => getIndicators(params),
  });

export const useAssetsGrowth = (params: { months?: number; years?: number }) =>
  useQuery({
    queryKey: [GROWTH_QUERY_KEY, params.months, params.years],
    queryFn: () => getGrowth(params),
    enabled: !!(params.months || params.years),
  });

export const useInvalidateAssetsIndicatorsQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY],
    });
  }, [queryClient]);

  return { invalidate };
};

export const useEmergencyFundAssets = () => {
  const { data, isPending, ...rest } = useQuery({
    queryKey: [EMERGENCY_FUND_ASSETS_QUERY_KEY],
    queryFn: getEmergencyFundTotal,
  });

  return { data, isPending, total: data?.total ?? 0, ...rest };
};
