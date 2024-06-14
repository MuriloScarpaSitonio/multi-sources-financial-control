import { apiProvider } from "./methods";

const RESOURCE = "assets";

export const getIndicators = async (): Promise<{
  ROI: number;
  ROI_closed: number;
  ROI_opened: number;
  total: number;
}> => (await apiProvider.get(`${RESOURCE}/indicators`)).data;

export const getTotalInvestedReport = async (params: {
  percentage: boolean;
  current: boolean;
  group_by: string;
}): Promise<{ total: number; type: string }[]> =>
  (
    await apiProvider.get(`${RESOURCE}/total_invested_report`, {
      params,
    })
  ).data;

export const getRoiReport = async (
  params: { opened?: boolean; closed?: boolean } = {},
) =>
  (
    await apiProvider.get(`${RESOURCE}/roi_report`, {
      params,
    })
  ).data;
