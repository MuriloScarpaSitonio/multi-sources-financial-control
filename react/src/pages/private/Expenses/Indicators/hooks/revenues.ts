import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getIndicators } from "../../api/revenues";

const QUERY_KEY = "revenues-indicators";

export const useRevenuesIndicators = () =>
  useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getIndicators,
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
