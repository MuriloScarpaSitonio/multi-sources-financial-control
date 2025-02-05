import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAssetsMinimalData } from "../api";
import { useCallback } from "react";

type Params = { status?: "OPENED" | "CLOSED"; type?: string[] };

const QUERY_KEY = "assets-minimal-data";

export const useAssetsMinimalData = (params?: Params) =>
  useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => getAssetsMinimalData(params),
  });

export const useInvalidateAssetsMinimalDataQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(
    async (params?: Params) => {
      await queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, ...(params ? [params] : [])],
      });
    },
    [queryClient],
  );

  return { invalidate };
};
