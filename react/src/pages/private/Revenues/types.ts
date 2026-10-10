export type Filters = {
  bank_account_description?: string;
};

export type SearchFilters = Filters & SearchFields;
import type { SearchFields } from "../Expenses/fullHistorySearch";
