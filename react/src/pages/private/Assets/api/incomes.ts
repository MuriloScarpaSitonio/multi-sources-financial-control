import { apiProvider } from "../../../../api/methods";

const RESOURCE = "incomes";

export const createIncome = async (data: {
  asset_pk: number;
  type: string;
  event_type: string;
  amount: number;
  operation_date: Date;
  current_currency_conversion_rate?: number;
}) =>
  (
    await apiProvider.post(RESOURCE, {
      ...data,
      operation_date: data.operation_date.toLocaleDateString("pt-br"),
    })
  ).data;
