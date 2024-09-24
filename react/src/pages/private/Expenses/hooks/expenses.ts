import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { EXPENSES_QUERY_KEY } from "../consts";
import { useInvalidateExpensesIndicatorsQueries } from "../Indicators/hooks";
import {
  useInvalidateExpensesAvgComparasionReportQueries,
  useInvalidateExpensesPercentagenReportQueries,
  useInvalidateExpensesHistoricReportQueries,
} from "../Reports/hooks";

export const useInvalidateExpenseQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const { invalidate: invalidateIndicatorsQueries } =
    useInvalidateExpensesIndicatorsQueries(queryClient);
  const { invalidate: invalidateAvgComparasionReportQueries } =
    useInvalidateExpensesAvgComparasionReportQueries(queryClient);
  const { invalidate: invalidatePercentageReportQueries } =
    useInvalidateExpensesPercentagenReportQueries(queryClient);
  const { invalidate: invalidateHistoricReportQueries } =
    useInvalidateExpensesHistoricReportQueries(queryClient);

  const invalidate = async ({
    isUpdatingValue = true,
    invalidateTableQuery = true,
  }: {
    isUpdatingValue?: boolean;
    invalidateTableQuery?: boolean;
  }) => {
    if (isUpdatingValue) {
      await invalidateIndicatorsQueries();
      await invalidateHistoricReportQueries();
    }
    if (invalidateTableQuery)
      await queryClient.invalidateQueries({
        queryKey: [EXPENSES_QUERY_KEY],
      });
    await invalidateAvgComparasionReportQueries();
    await invalidatePercentageReportQueries();
  };

  return { invalidate };
};
