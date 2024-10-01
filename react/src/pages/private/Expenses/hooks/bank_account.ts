import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { get } from "../api/bank_account";

const BANK_ACCOUNT_QUERY_KEY = "bank-account";

export const useBankAccount = () =>
  useQuery({
    queryKey: [BANK_ACCOUNT_QUERY_KEY],
    queryFn: get,
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
