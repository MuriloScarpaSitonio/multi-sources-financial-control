import { apiProvider } from "../../../api/methods";

export type WithdrawalMethodKey = "fire" | "dividends_only" | "constant_withdrawal" | "one_over_n" | "vpw";

export type PlanningPreferences = {
  selected_method?: WithdrawalMethodKey;
  show_galeno?: boolean;
  show_age_in_bonds?: boolean;
};

export type PlanningData = {
  preferences: PlanningPreferences;
  dateOfBirth: string | null;
};

const RESOURCE = "users";

const getUserId = () => localStorage.getItem("user_id");

export const getPlanningPreferences = async (): Promise<PlanningData> => {
  const { data } = await apiProvider.get(`${RESOURCE}/${getUserId()}`);
  return {
    preferences: data.planning_preferences ?? {},
    dateOfBirth: data.date_of_birth ?? null,
  };
};

export const updatePlanningPreferences = async (
  preferences: PlanningPreferences,
): Promise<PlanningPreferences> => {
  const { data } = await apiProvider.patch(`${RESOURCE}/${getUserId()}`, {
    planning_preferences: preferences,
  });
  return data.planning_preferences;
};
