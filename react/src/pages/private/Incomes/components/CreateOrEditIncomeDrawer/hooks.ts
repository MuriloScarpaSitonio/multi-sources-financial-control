import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { useInvalidateAssetsIncomesQueries } from "../../../Assets/Table/hooks";
import { useCallback } from "react";
import { useInvalidateIncomesIndicatorsQueries } from "../../Indicators/hooks";
import {
  useInvalidateIncomesHistoricQueries,
  useInvalidateIncomesTopAssetsReportQueries,
} from "../../Reports/hooks";
import { INCOMES_QUERY_KEY } from "../../consts";

export const useOnFormSuccess = ({
  client,
  variant,
}: {
  client?: QueryClient;
  variant: string;
}) => {
  const queryClient = useQueryClient(client);
  const { invalidate: invalidateIndicatorsQueries } =
    useInvalidateIncomesIndicatorsQueries(queryClient);
  const { invalidate: invalidateHistoricQueries } =
    useInvalidateIncomesHistoricQueries(queryClient);
  const { invalidate: invalidateTopAssetsReportQueries } =
    useInvalidateIncomesTopAssetsReportQueries(queryClient);
  const { invalidate: invalidateAssetsIncomesQueries } =
    useInvalidateAssetsIncomesQueries(queryClient);

  const onSuccess = useCallback(
    async ({
      isCredited,
      invalidateIncomesTableQuery = true,
    }: {
      isCredited: boolean;
      invalidateIncomesTableQuery?: boolean;
    }) => {
      if (isCredited) {
        await invalidateIndicatorsQueries();
      }

      await invalidateAssetsIncomesQueries({
        isCredited,
        invalidateTablesQuery: variant === "asset",
        invalidateReportsQuery: false,
      });
      if (variant === "income") {
        await invalidateHistoricQueries();
        await invalidateTopAssetsReportQueries();
        if (invalidateIncomesTableQuery)
          await queryClient.invalidateQueries({
            queryKey: [INCOMES_QUERY_KEY],
          });
      }
    },
    [
      invalidateAssetsIncomesQueries,
      invalidateIndicatorsQueries,
      invalidateHistoricQueries,
      invalidateTopAssetsReportQueries,
      queryClient,
      variant,
    ],
  );
  return { onSuccess };
};
