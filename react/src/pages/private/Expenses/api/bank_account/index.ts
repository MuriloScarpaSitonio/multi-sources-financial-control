import {
  BankAccount,
  BankAccountSummary,
  CreateBankAccountData,
  UpdateBankAccountData,
} from "../models";
import { apiProvider } from "../../../../../api/methods";
import { ApiListResponse, RawDateString } from "../../../../../types";

const RESOURCE = "bank_accounts";

export const list = async (): Promise<ApiListResponse<BankAccount>> =>
  (await apiProvider.get(RESOURCE)).data;

export const create = async (
  data: CreateBankAccountData,
): Promise<BankAccount> => (await apiProvider.post(RESOURCE, data)).data;

export const update = async (
  description: string,
  data: UpdateBankAccountData,
): Promise<BankAccount> =>
  (await apiProvider.put(`${RESOURCE}/${encodeURIComponent(description)}`, data)).data;

export const remove = async (description: string): Promise<void> =>
  (await apiProvider.Delete(`${RESOURCE}/${encodeURIComponent(description)}`)).data;

export const summary = async (): Promise<BankAccountSummary> =>
  (await apiProvider.get(`${RESOURCE}/summary`)).data;

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
