import { BankAccount } from "../models";
import { apiProvider } from "../../../../../api/methods";
import { RawDateString } from "../../../../../types";

const RESOURCE = "bank_account";

export const get = async (): Promise<BankAccount> =>
  (await apiProvider.get(RESOURCE)).data;

export const update = async (data: {
  description: string;
  amount: number;
}): Promise<BankAccount> => (await apiProvider.put(RESOURCE, data)).data;

export const history = async (params: {
  startDate: Date;
  endDate: Date;
}): Promise<{ total: number; operation_date: RawDateString }[]> =>
  (
    await apiProvider.get(`${RESOURCE}/history`, {
      params: {
        start_date: params.startDate.toLocaleDateString("pt-br"),
        end_date: params.endDate.toLocaleDateString("pt-br"),
      },
    })
  ).data;
