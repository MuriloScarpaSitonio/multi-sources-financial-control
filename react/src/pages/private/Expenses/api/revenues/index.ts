import { apiProvider } from "../../../../../api/methods";

const RESOURCE = "revenues";

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
