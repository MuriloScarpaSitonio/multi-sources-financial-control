import { apiProvider } from "../../../api/methods";

export type WithdrawalMethodKey = "fire" | "dividends_only" | "constant_withdrawal" | "one_over_n" | "vpw";
export type ActiveMethodKey = "fire" | "dividends_only" | "one_over_n" | "vpw";

export type PlanningPreferences = {
  selected_method?: WithdrawalMethodKey;
  show_galeno?: boolean;
  show_age_in_bonds?: boolean;
  fire?: FirePlanningPreferences;
};

export type FirePlanningPreferences = {
  withdrawal_rate?: number;
  target_years?: number;
  monthly_expenses_override?: number | null;
  exclude_ifix_from_sim?: boolean;
};

export const DEFAULT_FIRE_PREFERENCES = {
  withdrawal_rate: 4,
  target_years: 30,
  monthly_expenses_override: null,
  exclude_ifix_from_sim: false,
} satisfies Required<FirePlanningPreferences>;

export const getFirePlanningPreferences = (
  preferences?: PlanningPreferences,
): Required<FirePlanningPreferences> => ({
  ...DEFAULT_FIRE_PREFERENCES,
  ...(preferences?.fire ?? {}),
});

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
