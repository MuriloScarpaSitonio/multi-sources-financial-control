import { apiProvider } from "../../../../../api/methods";

const RESOURCE = "revenues";

export const getIndicators = async (): Promise<{
  avg: number;
  diff: number;
  total: number;
}> => (await apiProvider.get(`${RESOURCE}/indicators`)).data;
