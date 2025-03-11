import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { get, history } from "../api/bank_account";

const BANK_ACCOUNT_QUERY_KEY = "bank-account";

export const useBankAccount = (enabled = true) =>
  useQuery({
    queryKey: [BANK_ACCOUNT_QUERY_KEY],
    queryFn: get,
    enabled,
  });

export const useInvalidateBankAccountQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [BANK_ACCOUNT_QUERY_KEY],
    });
  };

  return { invalidate };
};

const BANK_ACCOUNT_HISTORY_QUERY_KEY = "bank-account-history";

export const useBankAccountHistory = (params: {
  startDate: Date;
  endDate: Date;
}) =>
  useQuery({
    queryKey: [BANK_ACCOUNT_HISTORY_QUERY_KEY, params],
    queryFn: () => history(params),
  });

export const useInvalidateBankAccountHistoryQueries = (
  client?: QueryClient,
) => {
  const queryClient = useQueryClient(client);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [BANK_ACCOUNT_HISTORY_QUERY_KEY],
    });
  };

  return { invalidate };
};
