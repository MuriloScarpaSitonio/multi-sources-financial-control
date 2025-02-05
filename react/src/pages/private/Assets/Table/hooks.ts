import { useCallback } from "react";

import { QueryClient, useQueryClient } from "@tanstack/react-query";

import { useInvalidateAssetsReportsQueries } from "../Reports/hooks";
import { useInvalidateAssetsIndicatorsQueries } from "../Indicators/hooks";

import { ASSETS_QUERY_KEY } from "../Table/consts";

export const useInvalidateAssetsQueriesQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);
  const { invalidate: invalidateAssetsReportsQueries } =
    useInvalidateAssetsReportsQueries(queryClient);
  const { invalidate: invalidateAssetsIndicatorsQueries } =
    useInvalidateAssetsIndicatorsQueries(queryClient);

  const invalidate = useCallback(async () => {
    // consider invalidating only the queries that match the transaction
    // operation_date field
    await invalidateAssetsReportsQueries();
    await invalidateAssetsIndicatorsQueries();
    //
    await queryClient.invalidateQueries({
      queryKey: [ASSETS_QUERY_KEY],
    });
  }, [
    invalidateAssetsIndicatorsQueries,
    invalidateAssetsReportsQueries,
    queryClient,
  ]);
  return { invalidate };
};
