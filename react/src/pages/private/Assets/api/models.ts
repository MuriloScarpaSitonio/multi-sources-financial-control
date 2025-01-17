import { RawDateString } from "../../../../types";

import {
  AssetsObjectivesMapping,
  AssetsTypesMapping,
  AssetCurrencies,
} from "../consts";

export type Asset = {
  write_model_pk: number;
  code: string;
  description: string;
  type: keyof typeof AssetsTypesMapping;
  objective: keyof typeof AssetsObjectivesMapping;
  quantity_balance: number;
  current_price: number;
  current_price_updated_at: string; // date
  adjusted_avg_price: number;
  normalized_roi: number;
  roi_percentage: number;
  normalized_total_invested: number;
  currency: AssetCurrencies;
  percentage_invested: number;
  current_percentage: number;
  is_held_in_self_custody: boolean;
};

export type AssetWrite = Omit<
  Asset,
  | "write_model_pk"
  | "quantity_balance"
  | "current_price"
  | "current_price_updated_at"
  | "adjusted_avg_price"
  | "normalized_roi"
  | "roi_percentage"
  | "normalized_total_invested"
  | "percentage_invested"
  | "current_percentage"
> & { id: number };

export type Transaction = {
  id: number;
  action: "Compra" | "Venda";
  price: number;
  quantity: number | null;
  operation_date: RawDateString;
  current_currency_conversion_rate: number;
  asset: AssetWrite;
};

export type Income = {
  id: number;
  type: "Dividendo" | "Juros sobre capital próprio" | "Rendimento";
  event_type: "Creditado" | "Provisionado";
  amount: number;
  operation_date: RawDateString;
  current_currency_conversion_rate: number;
  asset: AssetWrite;
};

export type SimulatedAsset = Omit<
  Asset,
  | "write_model_pk"
  | "type"
  | "objective"
  | "quantity_balance"
  | "current_price"
  | "current_price_updated_at"
  | "currency"
  | "percentage_invested"
  | "current_percentage"
  | "normalized_roi"
> & { roi: number };
