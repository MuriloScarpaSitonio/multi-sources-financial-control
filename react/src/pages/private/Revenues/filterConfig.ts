import type { FilterFieldConfigs } from "../../../components/FilterIndicators";
import type { FilterSchema } from "../../../urlParams";

export const revenuesFilterConfig: FilterFieldConfigs = {
  bank_account_description: {
    label: "Conta bancária",
  },
};

export const revenuesFilterSchema: FilterSchema = {
  bank_account_description: { type: "string" },
};
