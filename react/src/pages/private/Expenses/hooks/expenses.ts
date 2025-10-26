import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getCategories, getMostCommonCategory, getMostCommonSource, getSources, getTags } from "../api/expenses";
import { EXPENSES_QUERY_KEY } from "../consts";
import { useInvalidateExpensesIndicatorsQueries } from "../Indicators/hooks";
import {
  useInvalidateExpensesAvgComparasionReportQueries,
  useInvalidateExpensesHistoricReportQueries,
  useInvalidateExpensesPercentagenReportQueries,
} from "../Reports/hooks";
import { useInvalidateBankAccountQueries } from "./bank_account";

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
  const { invalidate: invalidateTagsQuery } =
    useInvalidateTagsQueries(queryClient);

  const invalidate = async ({
    isUpdatingValue = true,
    invalidateTableQuery = true,
    tags = [],
  }: {
    isUpdatingValue?: boolean;
    invalidateTableQuery?: boolean;
    tags?: string[];
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
    if (tags.length) {
      const cachedData = (queryClient.getQueryData([EXPENSES_TAGS_QUERY_KEY]) ??
        []) as string[];
      if (tags.filter((t) => !cachedData.includes(t)).length)
        await invalidateTagsQuery();
    }
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
  enabled = true,
}: {
  ordering?: string;
  page?: number;
  page_size?: number;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: [EXPENSES_CATEGORIES_QUERY_KEY, { ordering, page, page_size }],
    queryFn: () => getCategories({ ordering, page, page_size }),
    enabled,
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
  enabled = true,
}: {
  ordering?: string;
  page?: number;
  page_size?: number;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: [EXPENSES_SOURCES_QUERY_KEY, { ordering, page, page_size }],
    queryFn: () => getSources({ ordering, page, page_size }),
    enabled,
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

const EXPENSES_TAGS_QUERY_KEY = "expenses-tags";

export const useGetTags = () =>
  useQuery({ queryKey: [EXPENSES_TAGS_QUERY_KEY], queryFn: getTags });

export const useInvalidateTagsQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [EXPENSES_TAGS_QUERY_KEY],
    });
  };

  return { invalidate };
};

const EXPENSES_MOST_COMMON_CATEGORY_QUERY_KEY = "expenses-most-common-category";

export const useGetMostCommonCategory = ({ enabled = true }: { enabled?: boolean }) =>
  useQuery({
    queryKey: [EXPENSES_MOST_COMMON_CATEGORY_QUERY_KEY],
    queryFn: getMostCommonCategory,
    enabled,
  });

const EXPENSES_MOST_COMMON_SOURCE_QUERY_KEY = "expenses-most-common-source";

export const useGetMostCommonSource = ({ enabled = true }: { enabled?: boolean }) =>
  useQuery({
    queryKey: [EXPENSES_MOST_COMMON_SOURCE_QUERY_KEY],
    queryFn: getMostCommonSource,
    enabled,
  });
