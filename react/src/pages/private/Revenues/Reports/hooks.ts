import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import type { HistoricReportResponse } from "../../Expenses/types";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getHistoricReport } from "../api";

const HISTORIC_REPORT_QUERY_KEY = "revenue-historic-report";

type HistoricParams = {
  startDate: Date;
  endDate: Date;
};

export const useRevenuesHistoricReport = (
  params: HistoricParams,
): UseQueryResult<HistoricReportResponse> =>
  useQuery({
    queryKey: [HISTORIC_REPORT_QUERY_KEY, params],
    queryFn: () => getHistoricReport(params),
  });

export const useInvalidateRevenuesHistoricReportQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = async (params?: HistoricParams) => {
    await queryClient.invalidateQueries({
      queryKey: [HISTORIC_REPORT_QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};
