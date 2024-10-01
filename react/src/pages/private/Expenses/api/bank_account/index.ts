import { BankAccount } from "../models";
import { apiProvider } from "../../../../../api/methods";

const RESOURCE = "bank_account";

export const get = async (): Promise<BankAccount> =>
  (await apiProvider.get(RESOURCE)).data;

export const update = async (data: {
  description: string;
  amount: number;
}): Promise<BankAccount> => (await apiProvider.put(RESOURCE, data)).data;
