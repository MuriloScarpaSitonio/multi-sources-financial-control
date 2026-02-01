import qs from "qs";

import { apiProvider } from "../../../../../api/methods";
import { ApiListResponse } from "../../../../../types";
import {
  AvgComparasionPeriods,
  GroupBy,
  HistoricReportResponse,
} from "../../types";
import { Expense } from "../models";

const RESOURCE = "expenses";

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
  groupBy: GroupBy;
  period: AvgComparasionPeriods;
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
      params: { group_by: params.groupBy, period: params.period },
    })
  ).data;

export const getPercentageReport = async (params: {
  groupBy: GroupBy;
  startDate: Date;
  endDate: Date;
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
      params: {
        group_by: params.groupBy,
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;

export const getHistoricReport = async (params: {
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
  tag?: string[];
};
export const getExpenses = async (
  params: Params = {}
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

type ExpenseWrite = Omit<Expense, "id" | "full_description" | "created_at"> & {
  installments: number;
  created_at: Date;
  performActionsOnFutureFixedEntities?: boolean;
};

export const createExpense = async (data: ExpenseWrite): Promise<Expense> => {
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
      }
    )
  ).data;
};

export const deleteExpense = async (
  id: number,
  performActionsOnFutureFixedEntities?: boolean
) =>
  (
    await apiProvider.Delete(`${RESOURCE}/${id}`, {
      params: {
        perform_actions_on_future_fixed_entities:
          performActionsOnFutureFixedEntities,
      },
    })
  ).data;

export const editExpense = async ({
  id,
  data,
}: {
  id: number;
  data: ExpenseWrite;
}): Promise<Expense> => {
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
      }
    )
  ).data;
};

export const getMostExpensive = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<Expense> =>
  (
    await apiProvider.get(`${RESOURCE}/higher_value`, {
      params: {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;

type ExpenseRelatedEntity = {
  id: number;
  name: string;
  hex_color: string;
  // hex_color: Colors;
};

export const getCategories = async (params: {
  ordering?: string;
  page?: number;
  page_size?: number;
}): Promise<ApiListResponse<ExpenseRelatedEntity>> =>
  (await apiProvider.get(`${RESOURCE}/categories`, { params })).data;

export const updateCategory = async ({
  id,
  data,
}: {
  id: number;
  data: { name: string; hex_color: string; exclude_from_fire?: boolean };
}): Promise<ExpenseRelatedEntity> =>
  (await apiProvider.put(`${RESOURCE}/categories/${id}`, data)).data;

export const deleteCategory = async (id: number) =>
  (await apiProvider.Delete(`${RESOURCE}/categories/${id}`)).data;

export const addCategory = async (data: {
  name: string;
  hex_color: string;
  exclude_from_fire?: boolean;
}): Promise<ExpenseRelatedEntity> =>
  (await apiProvider.post(`${RESOURCE}/categories`, data)).data;

export const getSources = async (params: {
  ordering?: string;
  page?: number;
  page_size?: number;
}): Promise<ApiListResponse<ExpenseRelatedEntity>> =>
  (await apiProvider.get(`${RESOURCE}/sources`, { params })).data;

export const updateSource = async ({
  id,
  data,
}: {
  id: number;
  data: { name: string; hex_color: string };
}): Promise<ExpenseRelatedEntity> =>
  (await apiProvider.put(`${RESOURCE}/sources/${id}`, data)).data;

export const deleteSource = async (id: number) =>
  (await apiProvider.Delete(`${RESOURCE}/sources/${id}`)).data;

export const addSource = async (data: {
  name: string;
  hex_color: string;
}): Promise<ExpenseRelatedEntity> =>
  (await apiProvider.post(`${RESOURCE}/sources`, data)).data;

export const getTags = async (): Promise<string[]> =>
  (await apiProvider.get(`${RESOURCE}/tags`)).data;

export const getMostCommonCategory = async (): Promise<ExpenseRelatedEntity> =>
  (await apiProvider.get(`${RESOURCE}/categories/most_common`)).data;

export const getMostCommonSource = async (): Promise<ExpenseRelatedEntity> =>
  (await apiProvider.get(`${RESOURCE}/sources/most_common`)).data;

export type ExpensesIndicatorsResponse = {
  total: number;
  avg: number;
  diff: number;
  future: number;
  fire_avg?: number;
};

export const getExpensesIndicators = async (params?: {
  includeFireAvg?: boolean;
}): Promise<ExpensesIndicatorsResponse> =>
  (
    await apiProvider.get(`${RESOURCE}/indicators`, {
      params: params?.includeFireAvg ? { include_fire_avg: true } : undefined,
    })
  ).data;
