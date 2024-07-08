import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getRoiReport } from "../../api";

const QUERY_KEY = "assets-reports-roi";

export const useRoiReport = (params: { opened: boolean; closed: boolean }) =>
  useQuery({
    queryKey: [QUERY_KEY, { params }],
    queryFn: () => getRoiReport(params),
  });

export const useInvalidateRoiReportsQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async (params: { opened?: boolean; closed?: boolean }) => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY, { params }],
    });
  };

  return { invalidate };
};
