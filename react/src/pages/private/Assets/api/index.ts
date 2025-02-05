import qs from "qs";

import { apiProvider } from "../../../../api/methods";
import {
  Asset,
  AssetWrite,
  Income,
  SimulatedAsset,
  Transaction,
} from "./models";
import { AssetCurrencies } from "../consts";
import { GroupBy, Kinds } from "../Reports/types";
import { ApiListResponse, RawDateString } from "../../../../types";

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
  code?: string;
  objective: string;
  currency: string;
  is_held_in_self_custody: boolean;
  description?: string;
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
  type?: string[];
}): Promise<
  {
    code: string;
    currency: AssetCurrencies;
    pk: number;
    is_held_in_self_custody: boolean;
  }[]
> =>
  (
    await apiProvider.get(`${RESOURCE}/minimal_data`, {
      params,
      paramsSerializer: (params: Params) =>
        qs.stringify(params, { arrayFormat: "repeat" }),
    })
  ).data;

export const simulateTransaction = async ({
  assetId,
  data,
}: {
  assetId: number;
  data: { quantity: number; price?: number; total?: number };
}): Promise<{ new: SimulatedAsset; old: SimulatedAsset }> =>
  (await apiProvider.post(`${RESOURCE}/${assetId}/transactions/simulate`, data))
    .data;

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

export const updateAssetPrice = async ({
  id,
  data,
}: {
  id: number;
  data: { current_price: number };
}): Promise<AssetWrite> =>
  (await apiProvider.patch(`${RESOURCE}/${id}/update_price`, data)).data;
