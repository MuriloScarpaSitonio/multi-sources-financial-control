import type { UseQueryResult } from "@tanstack/react-query";
import type { ReportUnknownAggregationData, GroupBy, Kinds } from "../types";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getReports } from "../../api";

const QUERY_KEY = "assets-reports";

type Params = {
  kind: Kinds;
  opened?: boolean;
  closed?: boolean;
  percentage?: boolean;
  current?: boolean;
};

export const useAssetsReports = (
  params: Params & { group_by: GroupBy },
): UseQueryResult<ReportUnknownAggregationData> =>
  useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => getReports(params),
  });

export const useInvalidateAssetsReportsQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async (params?: Params & { group_by?: GroupBy }) => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};
