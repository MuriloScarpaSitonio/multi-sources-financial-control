import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getPlanningPreferences,
  updatePlanningPreferences,
  type ActiveMethodKey,
  type WithdrawalMethodKey,
} from "./api";

const QUERY_KEY = "planning-preferences";

export const usePlanningPreferences = () =>
  useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getPlanningPreferences,
  });

const VALID_METHODS: ActiveMethodKey[] = ["fire", "dividends_only", "one_over_n", "vpw"];

export const useSelectedMethod = (): {
  selectedMethod: ActiveMethodKey;
  isLoading: boolean;
} => {
  const { data, isPending } = usePlanningPreferences();
  const saved = data?.preferences.selected_method;
  const selectedMethod = saved && VALID_METHODS.includes(saved as ActiveMethodKey)
    ? (saved as ActiveMethodKey)
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
