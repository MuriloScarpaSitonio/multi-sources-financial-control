import type { FilterFieldConfigs } from "../../../components/FilterIndicators";
import type { FilterSchema } from "../../../urlParams";

export const expensesFilterConfig: FilterFieldConfigs = {
  category: {
    label: "Categoria",
  },
  source: {
    label: "Fonte",
  },
  tag: {
    label: "Tag",
  },
  bank_account_description: {
    label: "Conta bancária",
  },
};

export const expensesFilterSchema: FilterSchema = {
  category: { type: "array" },
  source: { type: "array" },
  tag: { type: "array" },
  bank_account_description: { type: "string" },
};
