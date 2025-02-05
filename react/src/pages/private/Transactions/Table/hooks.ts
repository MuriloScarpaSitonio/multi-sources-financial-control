import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { TRANSACTIONS_QUERY_KEY } from "../consts";
import { useInvalidateTransactionsIndicatorsQueries } from "../Indicators/hooks";
import {
  useInvalidateTransactionsHistoricQueries,
  useInvalidateTotalBoughtPerAssetTypeReportQueries,
} from "../Reports/hooks";
import { useInvalidateAssetsIndicatorsQueries } from "../../Assets/Indicators/hooks";
import { useCallback } from "react";

export const useInvalidateTransactionsQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);
  const { invalidate: invalidateTotalBoughtPerAssetTypeReportQueries } =
    useInvalidateTotalBoughtPerAssetTypeReportQueries(queryClient);
  const { invalidate: invalidateHistoricQueries } =
    useInvalidateTransactionsHistoricQueries(queryClient);
  const { invalidate: invalidateIndicatorsQueries } =
    useInvalidateTransactionsIndicatorsQueries(queryClient);
  const { invalidate: invalidateAssetsIndicatorsQueries } =
    useInvalidateAssetsIndicatorsQueries(queryClient);

  const invalidate = useCallback(
    async ({
      invalidateTableQuery = true,
      invalidateReportsQuery = true,
      invalidateHistoricQuery = true,
      invalidateIndicatorsQuery = true,
      invalidateAssetIndicatorsQuery = true,
    }: {
      invalidateTableQuery?: boolean;
      invalidateReportsQuery?: boolean;
      invalidateHistoricQuery?: boolean;
      invalidateIndicatorsQuery?: boolean;
      invalidateAssetIndicatorsQuery?: boolean;
    }) => {
      // consider invalidating only the queries that match the transaction
      // operation_date field
      if (invalidateReportsQuery)
        await invalidateTotalBoughtPerAssetTypeReportQueries();
      if (invalidateHistoricQuery) await invalidateHistoricQueries();
      if (invalidateIndicatorsQuery) await invalidateIndicatorsQueries();
      //
      if (invalidateAssetIndicatorsQuery)
        await invalidateAssetsIndicatorsQueries();
      if (invalidateTableQuery)
        await queryClient.invalidateQueries({
          queryKey: [TRANSACTIONS_QUERY_KEY],
        });
    },
    [
      invalidateHistoricQueries,
      invalidateIndicatorsQueries,
      invalidateTotalBoughtPerAssetTypeReportQueries,
      invalidateAssetsIndicatorsQueries,
      queryClient,
    ],
  );

  return { invalidate };
};
