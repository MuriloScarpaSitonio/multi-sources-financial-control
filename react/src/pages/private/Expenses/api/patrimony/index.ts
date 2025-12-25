import { apiProvider } from "../../../../../api/methods";

const RESOURCE = "patrimony";

type PatrimonyGrowthResponse = {
  current_total: number;
  historical_total: number | null;
  historical_date: string | null;
  growth_percentage: number | null;
};

export const getGrowth = async (params: {
  months?: number;
  years?: number;
}): Promise<PatrimonyGrowthResponse> =>
  (await apiProvider.get(`${RESOURCE}/growth`, { params })).data;

