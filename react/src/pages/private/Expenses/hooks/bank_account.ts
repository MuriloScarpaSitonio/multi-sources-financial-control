import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

import {
  list,
  create,
  update,
  remove,
  summary,
  history,
} from "../api/bank_account";
import type {
  CreateBankAccountData,
  UpdateBankAccountData,
} from "../api/models";

const BANK_ACCOUNTS_QUERY_KEY = "bank-accounts";
const BANK_ACCOUNTS_SUMMARY_QUERY_KEY = "bank-accounts-summary";
const BANK_ACCOUNT_HISTORY_QUERY_KEY = "bank-account-history";

export const useBankAccounts = (enabled = true) =>
  useQuery({
    queryKey: [BANK_ACCOUNTS_QUERY_KEY],
    queryFn: list,
    enabled,
  });

export const useDefaultBankAccount = (enabled = true) => {
  const { data: { results: accounts } = { results: [] }, ...rest } = useBankAccounts(enabled);
  const defaultAccount = accounts?.find((a) => a.is_default);
  return { data: defaultAccount, accounts, ...rest };
};

export const useBankAccountsSummary = (enabled = true) =>
  useQuery({
    queryKey: [BANK_ACCOUNTS_SUMMARY_QUERY_KEY],
    queryFn: summary,
    enabled,
  });

export const useCreateBankAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBankAccountData) => create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_QUERY_KEY] });
      queryClient.invalidateQueries({
        queryKey: [BANK_ACCOUNTS_SUMMARY_QUERY_KEY],
      });
    },
  });
};

export const useUpdateBankAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      description,
      data,
    }: {
      description: string;
      data: UpdateBankAccountData;
    }) => update(description, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_QUERY_KEY] });
      queryClient.invalidateQueries({
        queryKey: [BANK_ACCOUNTS_SUMMARY_QUERY_KEY],
      });
    },
  });
};

export const useDeleteBankAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (description: string) => remove(description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_QUERY_KEY] });
      queryClient.invalidateQueries({
        queryKey: [BANK_ACCOUNTS_SUMMARY_QUERY_KEY],
      });
    },
  });
};

export const useInvalidateBankAccountQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: [BANK_ACCOUNTS_QUERY_KEY],
    });
    await queryClient.invalidateQueries({
      queryKey: [BANK_ACCOUNTS_SUMMARY_QUERY_KEY],
    });
  };

  return { invalidate };
};

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

export const useInvalidateAllBankAccountQueries = (client?: QueryClient) => {
  const queryClient = useQueryClient(client);

  const { invalidate: invalidateBankAccountQueries } =
    useInvalidateBankAccountQueries(queryClient);
  const { invalidate: invalidateBankAccountHistoryQueries } =
    useInvalidateBankAccountHistoryQueries(queryClient);

  const invalidate = async () => {
    await invalidateBankAccountQueries();
    await invalidateBankAccountHistoryQueries();
  };

  return { invalidate };
};
