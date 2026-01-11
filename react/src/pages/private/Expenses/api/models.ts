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
  tags: string[];
  bank_account_description: string;
};

export type BankAccount = {
  amount: number;
  description: string;
  updated_at: RawDateString;
  is_active: boolean;
  is_default: boolean;
  credit_card_bill_day: number | null;
};

export type BankAccountSummary = {
  total: number;
};

export type CreateBankAccountData = {
  amount: number;
  description: string;
  is_default?: boolean;
  credit_card_bill_day?: number | null;
};

export type UpdateBankAccountData = {
  amount: number;
  description: string;
  is_default?: boolean;
  credit_card_bill_day?: number | null;
};
