import { apiProvider } from "../../../api/methods";
import type {
  CryptoProxy,
  FireReturnSeriesKey,
  GlobalEquityProxy,
  ReturnCategory,
  SamplingMethod,
  UsEquityProxy,
} from "../Home/fireReturnTypes";

export type WithdrawalMethodKey =
  | "fire"
  | "dividends_only"
  | "constant_withdrawal"
  | "one_over_n"
  | "vpw";
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

export type HistoricalPlanningPreferences = {
  sampling_method?: SamplingMethod;
  us_equity_proxy?: UsEquityProxy;
  global_equity_proxy?: GlobalEquityProxy;
  crypto_proxy?: CryptoProxy;
  excluded_return_categories?: ReturnCategory[];
  historical_series_overrides?: Record<string, FireReturnSeriesKey>;
  historical_series_fallbacks?: Record<string, FireReturnSeriesKey>;
};

export type FirePlanningPreferences = HistoricalPlanningPreferences & {
  simulated_patrimony?: number | null;
  withdrawal_rate?: number;
  target_years?: number;
  extra_accumulation_years?: number;
  monthly_expenses_override?: number | null;
};

export const DEFAULT_HISTORICAL_PREFERENCES = {
  sampling_method: "independent_months",
  us_equity_proxy: "SPY",
  global_equity_proxy: "VT",
  crypto_proxy: "BTC",
  excluded_return_categories: [],
  historical_series_overrides: {},
  historical_series_fallbacks: {},
} satisfies Required<HistoricalPlanningPreferences>;

export const DEFAULT_FIRE_PREFERENCES = {
  ...DEFAULT_HISTORICAL_PREFERENCES,
  simulated_patrimony: null,
  withdrawal_rate: 4,
  target_years: 30,
  extra_accumulation_years: 0,
  monthly_expenses_override: null,
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

export type OneOverNPlanningPreferences = HistoricalPlanningPreferences & {
  target_depletion_age?: number;
  extra_accumulation_years?: number;
  monthly_savings_override?: number | null;
  monthly_expenses_override?: number | null;
};

export const DEFAULT_ONE_OVER_N_PREFERENCES = {
  ...DEFAULT_HISTORICAL_PREFERENCES,
  target_depletion_age: 90,
  extra_accumulation_years: 0,
  monthly_savings_override: null,
  monthly_expenses_override: null,
} satisfies Required<OneOverNPlanningPreferences>;

export const getOneOverNPlanningPreferences = (
  preferences?: PlanningPreferences,
): Required<OneOverNPlanningPreferences> => {
  const result = {
    ...DEFAULT_ONE_OVER_N_PREFERENCES,
  } as Required<OneOverNPlanningPreferences>;
  for (const key of Object.keys(
    result,
  ) as (keyof OneOverNPlanningPreferences)[]) {
    const value = preferences?.one_over_n?.[key];
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  return result;
};

export type VPWPlanningPreferences = HistoricalPlanningPreferences & {
  target_age?: number;
  extra_accumulation_years?: number;
  monthly_savings_override?: number | null;
  monthly_expenses_override?: number | null;
};

export const DEFAULT_VPW_PREFERENCES = {
  ...DEFAULT_HISTORICAL_PREFERENCES,
  target_age: 99,
  extra_accumulation_years: 0,
  monthly_savings_override: null,
  monthly_expenses_override: null,
} satisfies Required<VPWPlanningPreferences>;

export const getVPWPlanningPreferences = (
  preferences?: PlanningPreferences,
): Required<VPWPlanningPreferences> => {
  // Pick supported settings only: old RV and return overrides must not survive.
  const result = {
    ...DEFAULT_VPW_PREFERENCES,
  } as Required<VPWPlanningPreferences>;
  for (const key of Object.keys(result) as (keyof VPWPlanningPreferences)[]) {
    const value = preferences?.vpw?.[key];
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  return result;
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
