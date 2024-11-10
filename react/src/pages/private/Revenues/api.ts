import { Revenue } from "./models";

import { HistoricReportResponse } from "../Expenses/types";
import { apiProvider } from "../../../api/methods";
import { ApiListResponse } from "../../../types";

const RESOURCE = "revenues";

type Params = {
  page?: number;
  page_size?: number;
  ordering?: string;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  is_fixed?: boolean;
};
export const getRevenues = async (
  params: Params = {},
): Promise<ApiListResponse<Revenue>> =>
  (
    await apiProvider.get(RESOURCE, {
      params: {
        ...params,
        start_date: params.startDate?.toLocaleDateString("pt-br"),
        end_date: params.endDate?.toLocaleDateString("pt-br"),
      },
    })
  ).data;

type RevenueWrite = Omit<Revenue, "id" | "full_description" | "created_at"> & {
  created_at: Date;
  performActionsOnFutureFixedEntities?: boolean;
};

export const createRevenue = async (data: RevenueWrite): Promise<Revenue> => {
  const { created_at, performActionsOnFutureFixedEntities, ...rest } = data;
  return (
    await apiProvider.post(
      RESOURCE,
      {
        ...rest,
        created_at: created_at.toLocaleDateString("pt-br"),
      },
      {
        params: {
          perform_actions_on_future_fixed_entities:
            performActionsOnFutureFixedEntities,
        },
      },
    )
  ).data;
};

export const editRevenue = async ({
  id,
  data,
}: {
  id: number;
  data: RevenueWrite;
}): Promise<Revenue> => {
  const { created_at, performActionsOnFutureFixedEntities, ...rest } = data;
  return (
    await apiProvider.put(
      `${RESOURCE}/${id}`,
      {
        ...rest,
        created_at: created_at.toLocaleDateString("pt-br"),
      },
      {
        params: {
          perform_actions_on_future_fixed_entities:
            performActionsOnFutureFixedEntities,
        },
      },
    )
  ).data;
};

export const deleteRevenue = async (
  id: number,
  performActionsOnFutureFixedEntities?: boolean,
) =>
  (
    await apiProvider.Delete(`${RESOURCE}/${id}`, {
      params: {
        perform_actions_on_future_fixed_entities:
          performActionsOnFutureFixedEntities,
      },
    })
  ).data;

export const getIndicators = async (): Promise<{
  avg: number;
  diff: number;
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

export const getHistoricReport = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<HistoricReportResponse> =>
  (
    await apiProvider.get(`${RESOURCE}/historic_report`, {
      params: {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;
