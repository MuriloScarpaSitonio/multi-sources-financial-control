import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { REVENUES_QUERY_KEY } from "../consts";
import { useInvalidateRevenuesIndicatorsQueries } from "./useRevenuesIndicators";
import { useInvalidateBankAccountQueries } from "../../Expenses/hooks";

const useInvalidateRevenuesQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);
  const { invalidate: invalidateIndicatorsQueries } =
    useInvalidateRevenuesIndicatorsQueries(queryClient);
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
      await invalidateBankAccountQueries();
    }
    if (invalidateTableQuery)
      await queryClient.invalidateQueries({
        queryKey: [REVENUES_QUERY_KEY],
      });
  };

  return { invalidate };
};

export default useInvalidateRevenuesQueries;
