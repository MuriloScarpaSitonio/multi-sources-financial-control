import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getAssetsMinimalData } from "../api";

type Params = { status?: "OPENED" | "CLOSED" };

const QUERY_KEY = "assets-minimal-data";

export const useAssetsMinimalData = (params?: Params) =>
  useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => getAssetsMinimalData(params),
  });

export const useInvalidateAssetsMinimalDataQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async (params?: Params) => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};
