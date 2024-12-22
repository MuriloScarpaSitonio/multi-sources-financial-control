import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getCategories } from "../api";

const REVENUES_CATEGORIES_QUERY_KEY = "revenues-categories";

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
    queryKey: [REVENUES_CATEGORIES_QUERY_KEY, { ordering, page, page_size }],
    queryFn: () => getCategories({ ordering, page, page_size }),
    enabled,
  });

export const useInvalidateCategoriesQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [REVENUES_CATEGORIES_QUERY_KEY],
    });
  };

  return { invalidate };
};
