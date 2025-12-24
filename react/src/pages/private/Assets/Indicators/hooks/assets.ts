import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getIndicators } from "../../api";
import { useCallback } from "react";

const QUERY_KEY = "assets-indicators";

export const useAssetsIndicators = (params?: { includeYield?: boolean }) =>
  useQuery({
    queryKey: [QUERY_KEY, params?.includeYield],
    queryFn: () => getIndicators(params),
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
