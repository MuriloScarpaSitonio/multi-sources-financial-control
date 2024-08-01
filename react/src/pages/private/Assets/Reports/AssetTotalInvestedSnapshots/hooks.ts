import type { UseQueryResult } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getTotalInvestedHistory } from "../../api";

const QUERY_KEY = "assets-total-ivested-history-report";

type Params = {
  start_date?: Date;
  end_date?: Date;
};

export const useAssetsTotalInvestedHistory = (
  params?: Params,
): UseQueryResult<{ total: number; operation_date: string }[]> =>
  useQuery({
    queryKey: [QUERY_KEY, ...(params ? [params] : [])],
    queryFn: () => getTotalInvestedHistory(params),
  });

export const useInvalidateAssetsTotalInvestedHistory = () => {
  const queryClient = useQueryClient();

  const invalidate = async (params?: Params) => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};
