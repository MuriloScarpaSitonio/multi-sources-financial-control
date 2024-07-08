import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getTotalInvestedReport } from "../../api";

const QUERY_KEY = "assets-reports-total-invested";

export const useTotalInvestedReports = (params: {
  percentage: boolean;
  current: boolean;
  group_by: "type" | "sector" | "objective";
}) =>
  useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => getTotalInvestedReport(params),
  });

export const useInvalidateTotalInvestedReportsQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async ({
    group_by,
  }: {
    group_by?: "type" | "sector" | "objective";
  }) => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY, ...(group_by ? [{ group_by }] : [])],
    });
  };

  return { invalidate };
};
