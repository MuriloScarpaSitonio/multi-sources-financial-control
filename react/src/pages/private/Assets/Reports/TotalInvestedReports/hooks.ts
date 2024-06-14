import { useQuery } from "@tanstack/react-query";

import { getTotalInvestedReport } from "../../../../../api/assets";

export const useTotalInvestedReports = (params: {
  percentage: boolean;
  current: boolean;
  group_by: "type" | "sector" | "objective";
}) =>
  useQuery({
    queryKey: ["assets-reports-total-invested", params],
    queryFn: () =>
      getTotalInvestedReport({
        ...params,
        group_by: params.group_by.toUpperCase(),
      }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
