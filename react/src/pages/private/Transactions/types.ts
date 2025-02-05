import { RawDateString } from "../../../types";
import { AssetWrite } from "../Assets/api/models";

export type Transaction = {
  id: number;
  action: "Compra" | "Venda";
  price: number;
  quantity: number | null;
  operation_date: RawDateString;
  current_currency_conversion_rate: number;
  asset: AssetWrite;
};

export type HistoricReportResponse = {
  avg: number;
  historic: {
    month: RawDateString;
    total_bought: number;
    total_sold: number;
    diff: number;
  }[];
};

export type Filters = {
  asset_type: string[];
  action: string;
};
