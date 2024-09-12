import type { Dispatch, SetStateAction } from "react";

import { createContext } from "react";

interface ExpensesContextType {
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  endDate: Date;
  setEndDate: Dispatch<SetStateAction<Date>>;
}

export const ExpensesContext = createContext<ExpensesContextType>(
  {} as ExpensesContextType,
);
