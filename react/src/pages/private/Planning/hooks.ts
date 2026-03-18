import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getPlanningPreferences,
  updatePlanningPreferences,
  type WithdrawalMethodKey,
} from "./api";

const QUERY_KEY = "planning-preferences";

export const usePlanningPreferences = () =>
  useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getPlanningPreferences,
  });

const VALID_METHODS: WithdrawalMethodKey[] = ["fire", "dividends_only", "constant_withdrawal", "one_over_n"];

export const useSelectedMethod = (): {
  selectedMethod: WithdrawalMethodKey;
  isLoading: boolean;
} => {
  const { data, isPending } = usePlanningPreferences();
  const saved = data?.preferences.selected_method;
  const selectedMethod = saved && VALID_METHODS.includes(saved as WithdrawalMethodKey)
    ? (saved as WithdrawalMethodKey)
    : "fire";
  return { selectedMethod, isLoading: isPending };
};

export const useUpdatePlanningPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePlanningPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};
