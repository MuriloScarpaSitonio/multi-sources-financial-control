import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getIndicators } from "../../api/incomes";

const QUERY_KEY = "incomes-indicators";

export const useIncomesIndicators = () =>
  useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getIndicators,
  });

export const useInvalidateIncomesIndicatorsQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY],
    });
  };

  return { invalidate };
};
