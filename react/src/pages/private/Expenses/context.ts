import { Month } from "date-fns";
import type { Dispatch, SetStateAction } from "react";

import { createContext } from "react";

export type ExpenseRelatedEntity = {
  id: number;
  name: string;
  hex_color: string;
  exclude_from_fire?: boolean;
};

export type RelatedEntityResultsAndHexColorMapping = {
  results: ExpenseRelatedEntity[];
  hexColorMapping: Map<string, string>;
};

interface ExpensesContextType {
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  endDate: Date;
  setEndDate: Dispatch<SetStateAction<Date>>;
  month: Month | undefined;
  setMonth: Dispatch<SetStateAction<Month | undefined>>;
  year: number;
  setYear: Dispatch<SetStateAction<number>>;
  categories: RelatedEntityResultsAndHexColorMapping;
  sources: RelatedEntityResultsAndHexColorMapping;
  revenuesCategories: RelatedEntityResultsAndHexColorMapping;
  isRelatedEntitiesLoading: boolean;
  mostCommonCategory: ExpenseRelatedEntity | undefined;
  mostCommonSource: ExpenseRelatedEntity | undefined;
  mostCommonRevenueCategory: ExpenseRelatedEntity | undefined;
}

export const ExpensesContext = createContext<ExpensesContextType>(
  {} as ExpensesContextType,
);
