import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import type { HistoricReportResponse } from "../../Expenses/types";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ReportAggregatedByCategoryDataItem } from "../../Expenses/types";
import { getHistoricReport, getPercentageReport } from "../api";

const HISTORIC_REPORT_QUERY_KEY = "revenue-historic-report";

type Params = {
  startDate: Date;
  endDate: Date;
};

export const useRevenuesHistoricReport = (
  params: Params & { aggregatePeriod: "month" | "year" }
): UseQueryResult<HistoricReportResponse> =>
  useQuery({
    queryKey: [
      HISTORIC_REPORT_QUERY_KEY,
      {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
        aggregate_period: params.aggregatePeriod,
      },
    ],
    queryFn: () => getHistoricReport(params),
  });

export const useInvalidateRevenuesHistoricReportQueries = (
  client?: QueryClient
) => {
  const queryClient = useQueryClient(client);

  const invalidate = async (params?: Params) => {
    await queryClient.invalidateQueries({
      queryKey: [HISTORIC_REPORT_QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};

export const PERCENTAGE_REPORT_QUERY_KEY = "revenues-percentage-report";

export const useRevenuesPercentagenReport = (
  params: Params
): UseQueryResult<ReportAggregatedByCategoryDataItem[]> =>
  useQuery({
    queryKey: [PERCENTAGE_REPORT_QUERY_KEY, params],
    queryFn: () => getPercentageReport(params),
  });

export const useInvalidateRevenuesPercentagenReportQueries = (
  client?: QueryClient
) => {
  const queryClient = useQueryClient(client);

  const invalidate = async (params?: Params) => {
    await queryClient.invalidateQueries({
      queryKey: [PERCENTAGE_REPORT_QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};
