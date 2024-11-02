import { Month } from "date-fns";
import type { Dispatch, SetStateAction } from "react";

import { createContext } from "react";

export type ExpenseRelatedEntity = {
  id: number;
  name: string;
  hex_color: string;
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
  isRelatedEntitiesLoading: boolean;
}

export const ExpensesContext = createContext<ExpensesContextType>(
  {} as ExpensesContextType,
);
