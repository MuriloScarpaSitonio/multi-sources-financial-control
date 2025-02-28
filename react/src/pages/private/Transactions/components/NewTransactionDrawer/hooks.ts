import { useQueryClient } from "@tanstack/react-query";
import { useInvalidateTransactionsQueries } from "../../Table/hooks";
import { useInvalidateAssetsQueries } from "../../../Assets/Table/hooks";

export const useOnFormSuccess = (variant: string) => {
  const queryClient = useQueryClient();
  const { invalidate: invalidateTransactionsQueries } =
    useInvalidateTransactionsQueries(queryClient);
  const { invalidate: invalidateAssetsQueries } =
    useInvalidateAssetsQueries(queryClient);
  return {
    onSuccess:
      variant === "asset"
        ? invalidateAssetsQueries
        : () => invalidateTransactionsQueries({ invalidateTableQuery: true }),
  };
};
