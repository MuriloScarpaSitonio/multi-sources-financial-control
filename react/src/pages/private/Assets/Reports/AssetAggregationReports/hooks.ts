import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import type { ReportUnknownAggregationData, GroupBy, Kinds } from "../types";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getReports } from "../../api";
import { useCallback } from "react";

const QUERY_KEY = "assets-reports";

type Params = {
  opened?: boolean;
  closed?: boolean;
  percentage?: boolean;
  current?: boolean;
};

export const useAssetsReports = (
  params: Params & {
    kind: Kinds;
    group_by: GroupBy;
  },
): UseQueryResult<ReportUnknownAggregationData> =>
  useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => getReports(params),
  });

export const useInvalidateAssetsReportsQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = useCallback(
    async (params?: Params & { group_by?: GroupBy; kind?: Kinds }) => {
      await queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, ...(params ? [params] : [])],
      });
    },
    [queryClient],
  );

  return { invalidate };
};
