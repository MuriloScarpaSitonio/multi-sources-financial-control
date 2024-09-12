import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getIndicatorsV2 } from "../../api/revenues";

const QUERY_KEY = "revenues-indicators";

export const useRevenuesIndicators = (params: {
  startDate: Date;
  endDate: Date;
}) =>
  useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => getIndicatorsV2(params),
  });

export const useInvalidateRevenuesIndicatorsQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY],
    });
  };

  return { invalidate };
};
