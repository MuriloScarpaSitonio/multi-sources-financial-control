import { apiProvider } from "../../../../api/methods";

const RESOURCE = "incomes";

export const getIndicators = async (): Promise<{
  avg: number;
  current_credited: number;
  provisioned_future: number;
  diff_percentage: number;
}> => (await apiProvider.get(`${RESOURCE}/indicators`)).data;
