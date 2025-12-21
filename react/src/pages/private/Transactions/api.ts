import qs from "qs";

import { apiProvider } from "../../../api/methods";
import { ApiListResponse } from "../../../types";
import { Transaction, HistoricReportResponse, Filters } from "./types";

const RESOURCE = "transactions";

export const getSum = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<{
  bought: number;
  sold: number;
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

type TransactionWrite = {
  asset_pk: number;
  action: string;
  price: number;
  quantity?: number;
  operation_date: Date;
  current_currency_conversion_rate?: number;
};

export const createTransaction = async (data: TransactionWrite) =>
  (
    await apiProvider.post(RESOURCE, {
      ...data,
      operation_date: data.operation_date.toLocaleDateString("pt-br"),
    })
  ).data;

export const getIndicators = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<{
  avg: number;
  current_bought: number;
  current_sold: number;
  diff_percentage: number;
}> =>
  (
    await apiProvider.get(`${RESOURCE}/indicators`, {
      params: {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;

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

export const getTotalBoughtPerAssetTypeReport = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<{ asset_type: string; total_bought: number }[]> =>
  (
    await apiProvider.get(`${RESOURCE}/total_bought_per_asset_type_report`, {
      params: {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;

type Params = Filters & {
  page?: number;
  page_size?: number;
  ordering?: string;
  startDate?: Date;
  endDate?: Date;
  asset_code?: string;
};

export const getTransactions = async (
  params: Params,
): Promise<ApiListResponse<Transaction>> =>
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

export const deleteTransaction = async (id: number) =>
  (await apiProvider.Delete(`${RESOURCE}/${id}`)).data;

export const editTransaction = async ({
  id,
  data,
}: {
  id: number;
  data: Omit<TransactionWrite, "asset_pk">;
}): Promise<Transaction> => {
  const { operation_date, ...rest } = data;
  return (
    await apiProvider.put(`${RESOURCE}/${id}`, {
      ...rest,
      operation_date: operation_date.toLocaleDateString("pt-br"),
    })
  ).data;
};
