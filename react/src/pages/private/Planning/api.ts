import { apiProvider } from "../../../api/methods";

export type WithdrawalMethodKey = "fire" | "dividends_only" | "constant_withdrawal";

export type PlanningPreferences = {
  selected_method?: WithdrawalMethodKey;
  show_galeno?: boolean;
};

const RESOURCE = "users";

const getUserId = () => localStorage.getItem("user_id");

export const getPlanningPreferences = async (): Promise<PlanningPreferences> => {
  const { data } = await apiProvider.get(`${RESOURCE}/${getUserId()}`);
  return data.planning_preferences ?? {};
};

export const updatePlanningPreferences = async (
  preferences: PlanningPreferences,
): Promise<PlanningPreferences> => {
  const { data } = await apiProvider.patch(`${RESOURCE}/${getUserId()}`, {
    planning_preferences: preferences,
  });
  return data.planning_preferences;
};
