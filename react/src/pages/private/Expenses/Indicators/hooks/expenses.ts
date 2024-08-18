import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getIndicators } from "../../api/expenses";

const QUERY_KEY = "expenses-indicators";

export const useExpensesIndicators = () =>
  useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getIndicators,
  });

export const useInvalidateExpensesIndicatorsQueries = () => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY],
    });
  };

  return { invalidate };
};
