import type { HistoricReportResponse, TopAssetsResponse } from "./types";

import qs from "qs";

import { apiProvider } from "../../../api/methods";
import { ApiListResponse } from "../../../types";
import { Filters, Income, IncomeWrite } from "./types";

const RESOURCE = "incomes";

export const getSumCredited = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<{ total: number }> =>
  (
    await apiProvider.get(`${RESOURCE}/sum_credited`, {
      params: {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;

export const getSumProvisionedFuture = async (): Promise<{ total: number }> =>
  (await apiProvider.get(`${RESOURCE}/sum_provisioned_future`)).data;

export const getAvg = async (): Promise<{
  avg: number;
}> => (await apiProvider.get(`${RESOURCE}/avg`)).data;

export const getHistoric = async (params: {
  startDate: Date;
  endDate: Date;
  aggregatePeriod: "month" | "year";
}): Promise<HistoricReportResponse> =>
  (
    await apiProvider.get(`${RESOURCE}/historic_report`, {
      params: {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
        aggregate_period: params.aggregatePeriod,
      },
    })
  ).data;

export const getTopAssets = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<TopAssetsResponse> => {
  const { startDate, endDate } = params;
  return (
    await apiProvider.get(`${RESOURCE}/assets_aggregation_report`, {
      params: {
        start_date: startDate.toLocaleDateString("pt-br"),
        end_date: endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;
};

type Params = Filters & {
  page?: number;
  page_size?: number;
  ordering?: string;
  startDate?: Date;
  endDate?: Date;
  asset_code?: string;
};

export const getIncomes = async (
  params: Params,
): Promise<ApiListResponse<Income>> => {
  const { startDate, endDate, ...rest } = params;
  return (
    await apiProvider.get(RESOURCE, {
      params: {
        start_date: startDate?.toLocaleDateString("pt-br"),
        end_date: endDate?.toLocaleDateString("pt-br"),
        ...rest,
      },
      paramsSerializer: (params: Params) =>
        qs.stringify(params, { arrayFormat: "repeat" }),
    })
  ).data;
};

export const createIncome = async (data: IncomeWrite): Promise<Income> =>
  (
    await apiProvider.post(RESOURCE, {
      ...data,
      operation_date: data.operation_date.toLocaleDateString("pt-br"),
    })
  ).data;

export const deleteIncome = async (id: number) =>
  (await apiProvider.Delete(`${RESOURCE}/${id}`)).data;

export const editIncome = async ({
  id,
  data,
}: {
  id: number;
  data: Omit<IncomeWrite, "asset_pk">;
}): Promise<Income> => {
  const { operation_date, ...rest } = data;
  return (
    await apiProvider.put(`${RESOURCE}/${id}`, {
      ...rest,
      operation_date: operation_date.toLocaleDateString("pt-br"),
    })
  ).data;
};
