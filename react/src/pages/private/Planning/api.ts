import { apiProvider } from "../../../api/methods";

export type WithdrawalMethodKey = "fire" | "dividends_only" | "constant_withdrawal" | "one_over_n" | "vpw";
export type ActiveMethodKey = "fire" | "dividends_only" | "one_over_n" | "vpw";

export type PlanningPreferences = {
  selected_method?: WithdrawalMethodKey;
  show_galeno?: boolean;
  show_age_in_bonds?: boolean;
  fire?: FirePlanningPreferences;
  dividends_only?: DividendsOnlyPlanningPreferences;
  one_over_n?: OneOverNPlanningPreferences;
  vpw?: VPWPlanningPreferences;
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

export type DividendsOnlyPlanningPreferences = {
  yield_override?: number | null;
  monthly_savings_override?: number | null;
  monthly_expenses_override?: number | null;
};

export const DEFAULT_DIVIDENDS_ONLY_PREFERENCES = {
  yield_override: null,
  monthly_savings_override: null,
  monthly_expenses_override: null,
} satisfies Required<DividendsOnlyPlanningPreferences>;

export const getDividendsOnlyPlanningPreferences = (
  preferences?: PlanningPreferences,
): Required<DividendsOnlyPlanningPreferences> => ({
  ...DEFAULT_DIVIDENDS_ONLY_PREFERENCES,
  ...(preferences?.dividends_only ?? {}),
});

export type OneOverNPlanningPreferences = {
  target_depletion_age?: number;
  real_return?: number;
  monthly_savings_override?: number | null;
  monthly_expenses_override?: number | null;
};

export const DEFAULT_ONE_OVER_N_PREFERENCES = {
  target_depletion_age: 90,
  real_return: 5,
  monthly_savings_override: null,
  monthly_expenses_override: null,
} satisfies Required<OneOverNPlanningPreferences>;

export const getOneOverNPlanningPreferences = (
  preferences?: PlanningPreferences,
): Required<OneOverNPlanningPreferences> => ({
  ...DEFAULT_ONE_OVER_N_PREFERENCES,
  ...(preferences?.one_over_n ?? {}),
});

export type VPWPlanningPreferences = {
  target_age?: number;
  stock_return?: number;
  bond_return?: number;
  stock_allocation_override?: number | null;
  monthly_savings_override?: number | null;
  monthly_expenses_override?: number | null;
};

export const DEFAULT_VPW_PREFERENCES = {
  target_age: 99,
  stock_return: 5,
  bond_return: 4,
  stock_allocation_override: null,
  monthly_savings_override: null,
  monthly_expenses_override: null,
} satisfies Required<VPWPlanningPreferences>;

export const getVPWPlanningPreferences = (
  preferences?: PlanningPreferences,
): Required<VPWPlanningPreferences> => ({
  ...DEFAULT_VPW_PREFERENCES,
  ...(preferences?.vpw ?? {}),
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
