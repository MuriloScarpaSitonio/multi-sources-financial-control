import { RawDateString } from "../../../../types";

export type Expense = {
  id: number;
  value: number;
  description: string;
  category: string;
  created_at: RawDateString;
  source: string;
  is_fixed: boolean;
  full_description: string;
};
