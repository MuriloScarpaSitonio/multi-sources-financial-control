import qs from "qs";

import { Expense } from "../models";
import {
  GroupBy,
  PercentagePeriods,
  HistoricReportResponse,
} from "../../types";
import { apiProvider } from "../../../../../api/methods";
import { ApiListResponse } from "../../../../../types";

const RESOURCE = "expenses";

export const getIndicators = async (): Promise<{
  avg: number;
  diff: number;
  future: number;
  total: number;
}> => (await apiProvider.get(`${RESOURCE}/indicators`)).data;

export const getSum = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<{
  total: number;
}> =>
  (
    await apiProvider.get(`${RESOURCE}/sum`, {
      params: {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;

export const getAvg = async (): Promise<{
  avg: number;
}> => (await apiProvider.get(`${RESOURCE}/avg`)).data;

export const getAvgComparasionReport = async (params: {
  group_by: GroupBy;
  period: "since_a_year_ago" | "current_month_and_past";
}): Promise<
  {
    total: number;
    avg: number;
    category?: string;
    source?: string;
    type?: string;
  }[]
> =>
  (
    await apiProvider.get(`${RESOURCE}/avg_comparasion_report`, {
      params,
    })
  ).data;

export const getPercentageReport = async (params: {
  group_by: GroupBy;
  period: PercentagePeriods;
}): Promise<
  {
    total: number;
    category?: string;
    source?: string;
    type?: string;
  }[]
> =>
  (
    await apiProvider.get(`${RESOURCE}/percentage_report`, {
      params,
    })
  ).data;

export const getHistoricReport = async (params: {
  start_date: Date;
  end_date: Date;
}): Promise<HistoricReportResponse> =>
  (
    await apiProvider.get(`${RESOURCE}/historic_report`, {
      params: {
        start_date: params.start_date.toLocaleDateString("pt-br"),
        end_date: params.end_date.toLocaleDateString("pt-br"),
      },
    })
  ).data;

type Params = {
  page?: number;
  page_size?: number;
  ordering?: string;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  is_fixed?: boolean;
  with_installments?: boolean;
  category?: string[];
  source?: string[];
};
export const getExpenses = async (
  params: Params = {},
): Promise<ApiListResponse<Expense>> =>
  (
    await apiProvider.get(RESOURCE, {
      params: {
        ...params,
        start_date: params.startDate?.toLocaleDateString("pt-br"),
        end_date: params.endDate?.toLocaleDateString("pt-br"),
      },
      paramsSerializer: (params: Params) =>
        qs.stringify(params, { arrayFormat: "repeat" }),
    })
  ).data;

export const createExpense = async (
  data: Omit<Expense, "id" | "full_description" | "created_at"> & {
    installments: number;
    created_at: Date;
  },
): Promise<Expense> =>
  (
    await apiProvider.post(RESOURCE, {
      ...data,
      created_at: data.created_at.toLocaleDateString("pt-br"),
    })
  ).data;
