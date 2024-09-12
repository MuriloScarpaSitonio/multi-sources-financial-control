import { apiProvider } from "../../../../../api/methods";

const RESOURCE = "revenues";

export const getIndicators = async (): Promise<{
  avg: number;
  diff: number;
  total: number;
}> => (await apiProvider.get(`${RESOURCE}/indicators`)).data;

export const getIndicatorsV2 = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<{
  avg: number;
  diff: number;
  total: number;
}> =>
  (
    await apiProvider.get(`${RESOURCE}/v2/indicators`, {
      params: {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;
