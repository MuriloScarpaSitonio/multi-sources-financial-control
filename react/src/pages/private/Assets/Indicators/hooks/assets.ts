import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getIndicators } from "../../api";
import { useCallback } from "react";

const QUERY_KEY = "assets-indicators";

export const useAssetsIndicators = () =>
  useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getIndicators,
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
