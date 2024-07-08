import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getIndicators } from "../../api";

const QUERY_KEY = "assets-indicators";

export const useAssetsIndicators = () =>
  useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getIndicators,
  });

export const useInvalidateAssetsIndicatorsQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY],
    });
  };

  return { invalidate };
};
