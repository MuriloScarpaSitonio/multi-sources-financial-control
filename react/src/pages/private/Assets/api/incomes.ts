import { apiProvider } from "../../../../api/methods";

const RESOURCE = "incomes";

export const getIndicators = async (): Promise<{
  avg: number;
  current_credited: number;
  provisioned_future: number;
  diff_percentage: number;
}> => (await apiProvider.get(`${RESOURCE}/indicators`)).data;

export const createIncome = async (data: {
  asset_pk: number;
  type: string;
  event_type: string;
  amount: number;
  operation_date: Date;
  current_currency_conversion_rate?: number;
}) =>
  (
    await apiProvider.post("incomes", {
      ...data,
      operation_date: data.operation_date.toLocaleDateString("pt-br"),
    })
  ).data;
