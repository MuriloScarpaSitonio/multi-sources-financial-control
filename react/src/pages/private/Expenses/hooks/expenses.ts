import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { EXPENSES_QUERY_KEY } from "../consts";
import { useInvalidateExpensesIndicatorsQueries } from "../Indicators/hooks";
import {
  useInvalidateExpensesAvgComparasionReportQueries,
  useInvalidateExpensesPercentagenReportQueries,
  useInvalidateExpensesHistoricReportQueries,
} from "../Reports/hooks";
import { useInvalidateBankAccountQueries } from "./bank_account";
import { getCategories, getSources } from "../api/expenses";

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
  const { invalidate: invalidateBankAccountQueries } =
    useInvalidateBankAccountQueries(queryClient);

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
      await invalidateBankAccountQueries();
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

const EXPENSES_CATEGORIES_QUERY_KEY = "expenses-categories";

export const useGetCategories = ({
  ordering = "-created_at",
  page = 1,
  page_size = 100,
}: {
  ordering?: string;
  page?: number;
  page_size?: number;
}) =>
  useQuery({
    queryKey: [EXPENSES_CATEGORIES_QUERY_KEY, { ordering, page, page_size }],
    queryFn: () => getCategories({ ordering, page, page_size }),
  });

export const useInvalidateCategoriesQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [EXPENSES_CATEGORIES_QUERY_KEY],
    });
  };

  return { invalidate };
};

const EXPENSES_SOURCES_QUERY_KEY = "expenses-sources";

export const useGetSources = ({
  ordering = "-created_at",
  page = 1,
  page_size = 100,
}: {
  ordering?: string;
  page?: number;
  page_size?: number;
}) =>
  useQuery({
    queryKey: [EXPENSES_SOURCES_QUERY_KEY, { ordering, page, page_size }],
    queryFn: () => getSources({ ordering, page, page_size }),
  });

export const useInvalidateSourcesQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [EXPENSES_SOURCES_QUERY_KEY],
    });
  };

  return { invalidate };
};
