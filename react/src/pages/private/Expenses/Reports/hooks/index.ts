import type { UseQueryResult } from "@tanstack/react-query";
import type {
  ReportUnknownAggregationData,
  GroupBy,
  HistoricReportResponse,
} from "../../types";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PercentagePeriods, AvgComparasionPeriods } from "../../types";
import {
  getAvgComparasionReport,
  getPercentageReport,
  getHistoricReport,
} from "../../api/expenses";

const AVG_COMPASATION_REPORT_QUERY_KEY = "expense-avg-comparasion-report";

type Params = {
  group_by: GroupBy;
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

export const useInvalidateExpensesAvgComparasionReportQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async (params?: AvgComparasionParams) => {
    await queryClient.invalidateQueries({
      queryKey: [AVG_COMPASATION_REPORT_QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};
const PERCENTAGE_REPORT_QUERY_KEY = "expense-percentage-report";

type PercentageParams = Params & {
  period: PercentagePeriods;
};

export const useExpensesPercentagenReport = (
  params: PercentageParams,
): UseQueryResult<ReportUnknownAggregationData> =>
  useQuery({
    queryKey: [PERCENTAGE_REPORT_QUERY_KEY, params],
    queryFn: () => getPercentageReport(params),
  });

export const useInvalidateExpensesPercentagenReportQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async (params?: PercentageParams) => {
    await queryClient.invalidateQueries({
      queryKey: [PERCENTAGE_REPORT_QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};

const HISTORIC_REPORT_QUERY_KEY = "expense-historic-report";

type HistoricParams = { start_date: Date; end_date: Date };

export const useExpensesHistoricReport = (
  params: HistoricParams,
): UseQueryResult<HistoricReportResponse> =>
  useQuery({
    queryKey: [HISTORIC_REPORT_QUERY_KEY, params],
    queryFn: () => getHistoricReport(params),
  });

export const useInvalidateExpensesHistoricReportQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async (params?: HistoricParams) => {
    await queryClient.invalidateQueries({
      queryKey: [HISTORIC_REPORT_QUERY_KEY, ...(params ? [params] : [])],
    });
  };

  return { invalidate };
};
