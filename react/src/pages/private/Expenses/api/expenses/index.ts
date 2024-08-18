import { apiProvider } from "../../../../../api/methods";
import { GroupBy, PercentagePeriods } from "../../types";

const RESOURCE = "expenses";

export const getIndicators = async (): Promise<{
  avg: number;
  diff: number;
  future: number;
  total: number;
}> => (await apiProvider.get(`${RESOURCE}/indicators`)).data;

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
