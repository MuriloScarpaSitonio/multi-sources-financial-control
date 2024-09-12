import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getIndicatorsV2 } from "../../api/expenses";

const QUERY_KEY = "expenses-indicators";

export const useExpensesIndicators = (params: {
  startDate: Date;
  endDate: Date;
}) =>
  useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => getIndicatorsV2(params),
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
