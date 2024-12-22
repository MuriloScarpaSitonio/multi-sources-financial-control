import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import type {
  ReportUnknownAggregationData,
  GroupBy,
  HistoricReportResponse,
} from "../../types";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AvgComparasionPeriods } from "../../types";
import {
  getAvgComparasionReport,
  getPercentageReport,
  getHistoricReport,
} from "../../api/expenses";

const AVG_COMPASATION_REPORT_QUERY_KEY = "expense-avg-comparasion-report";

type Params = {
  groupBy: GroupBy;
};

type HistoricParams = {
  startDate: Date;
  endDate: Date;
};
type AvgComparasionParams = Params & {
  period: AvgComparasionPeriods;
};

export const useExpensesAvgComparasionReport = (
  params: AvgComparasionParams,
): UseQueryResult<ReportUnknownAggregationData> =>
  useQuery({
    queryKey: [AVG_COMPASATION_REPORT_QUERY_KEY, params],
    queryFn: () => getAvgComparasionReport(params),
  });

export const useInvalidateExpensesAvgComparasionReportQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = async (params?: AvgComparasionParams) => {
    await queryClient.invalidateQueries({
      queryKey: [AVG_COMPASATION_REPORT_QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};

export const PERCENTAGE_REPORT_QUERY_KEY = "expense-percentage-report";

type PercentageParams = Params & HistoricParams;

export const useExpensesPercentagenReport = (
  params: PercentageParams,
): UseQueryResult<ReportUnknownAggregationData> =>
  useQuery({
    queryKey: [PERCENTAGE_REPORT_QUERY_KEY, params],
    queryFn: () => getPercentageReport(params),
  });

export const useInvalidateExpensesPercentagenReportQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = async (params?: PercentageParams) => {
    await queryClient.invalidateQueries({
      queryKey: [PERCENTAGE_REPORT_QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};

const HISTORIC_REPORT_QUERY_KEY = "expense-historic-report";

export const useExpensesHistoricReport = (
  params: HistoricParams,
): UseQueryResult<HistoricReportResponse> =>
  useQuery({
    queryKey: [
      HISTORIC_REPORT_QUERY_KEY,
      {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    ],
    queryFn: () => getHistoricReport(params),
  });

export const useInvalidateExpensesHistoricReportQueries = (
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
