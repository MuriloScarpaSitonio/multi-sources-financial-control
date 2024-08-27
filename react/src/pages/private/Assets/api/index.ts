import qs from "qs";

import { apiProvider } from "../../../../api/methods";
import {
  Asset,
  AssetWrite,
  Income,
  SimulatedAsset,
  Transaction,
} from "./models";
import { ApiListResponse } from "../../../../types";
import { AssetCurrencies } from "../consts";
import { GroupBy, Kinds } from "../Reports/types";
import { RawDateString } from "../../../../types";

const RESOURCE = "assets";

export const getIndicators = async (): Promise<{
  ROI: number;
  ROI_closed: number;
  ROI_opened: number;
  total: number;
  total_diff_percentage: number;
}> => (await apiProvider.get(`${RESOURCE}/indicators`)).data;

export const getReports = async (params: {
  opened?: boolean;
  closed?: boolean;
  percentage?: boolean;
  current?: boolean;
  group_by: GroupBy;
  kind: Kinds;
}): Promise<
  { total: number; type?: string; sector?: string; objective?: string }[]
> =>
  (
    await apiProvider.get(`${RESOURCE}/reports`, {
      params,
    })
  ).data;

type Params = {
  page?: number;
  page_size?: number;
  ordering?: string;
  code?: string;
  status?: "OPENED" | "CLOSED";
  type?: string[];
};
export const getAssets = async (
  params: Params = {},
): Promise<ApiListResponse<Asset>> =>
  (
    await apiProvider.get(RESOURCE, {
      params,
      paramsSerializer: (params: Params) =>
        qs.stringify(params, { arrayFormat: "repeat" }),
    })
  ).data;

export const editAsset = async ({
  id,
  data,
}: {
  id: number;
  data: Omit<AssetWrite, "id">;
}): Promise<AssetWrite> =>
  (await apiProvider.put(`${RESOURCE}/${id}`, data)).data;

export const createAsset = async (data: {
  type: string;
  code: string;
  objective: string;
  currency: string;
}): Promise<AssetWrite> => (await apiProvider.post(RESOURCE, data)).data;

export const getAssetTransactions = async ({
  assetId,
  params = {},
}: {
  assetId: number;
  params: {
    page?: number;
    page_size?: number;
    ordering?: string;
  };
}): Promise<ApiListResponse<Transaction>> =>
  (await apiProvider.get(`${RESOURCE}/${assetId}/transactions`, { params }))
    .data;

export const getAssetIncomes = async ({
  assetId,
  params = {},
}: {
  assetId: number;
  params: {
    page?: number;
    page_size?: number;
    ordering?: string;
  };
}): Promise<ApiListResponse<Income>> =>
  (await apiProvider.get(`${RESOURCE}/${assetId}/incomes`, { params })).data;

export const getAssetsMinimalData = async (params?: {
  status?: "OPENED" | "CLOSED";
}): Promise<{ code: string; currency: AssetCurrencies; pk: number }[]> =>
  (await apiProvider.get(`${RESOURCE}/minimal_data`, { params })).data;

export const simulateTransaction = async ({
  assetId,
  data,
}: {
  assetId: number;
  data: { quantity: number; price?: number; total?: number };
}): Promise<{ new: SimulatedAsset; old: SimulatedAsset }> =>
  (await apiProvider.post(`${RESOURCE}/${assetId}/transactions/simulate`, data))
    .data;

export const createTransaction = async (data: {
  asset_pk: number;
  action: string;
  price: number;
  quantity: number;
  operation_date: Date;
  current_currency_conversion_rate?: number;
}) =>
  (
    await apiProvider.post("transactions", {
      ...data,
      operation_date: data.operation_date.toLocaleDateString("pt-br"),
    })
  ).data;

export const createIncome = async (data: {
  asset_pk: number;
  type: string;
  event_type: string;
  amount: number;
  operation_date: Date;
  current_currency_conversion_rate?: number;
}) =>
  (
    await apiProvider.post("incomes", {
      ...data,
      operation_date: data.operation_date.toLocaleDateString("pt-br"),
    })
  ).data;

export const deleteAsset = async (id: number) =>
  (await apiProvider.Delete(`${RESOURCE}/${id}`)).data;

export const getTotalInvestedHistory = async (params?: {
  start_date?: Date;
  end_date?: Date;
}): Promise<{ total: number; operation_date: RawDateString }[]> =>
  (
    await apiProvider.get(`${RESOURCE}/total_invested_history`, {
      params: {
        start_date: params?.start_date?.toLocaleDateString("pt-br"),
        end_date: params?.end_date?.toLocaleDateString("pt-br"),
      },
    })
  ).data;
