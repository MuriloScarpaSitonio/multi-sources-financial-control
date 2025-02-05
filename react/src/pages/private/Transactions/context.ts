import { Month } from "date-fns";
import type { Dispatch, SetStateAction } from "react";

import { createContext } from "react";

interface TransactionsContextType {
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  endDate: Date;
  setEndDate: Dispatch<SetStateAction<Date>>;
  month: Month | undefined;
  setMonth: Dispatch<SetStateAction<Month | undefined>>;
  year: number;
  setYear: Dispatch<SetStateAction<number>>;
}

export const TransactionsContext = createContext<TransactionsContextType>(
  {} as TransactionsContextType,
);
