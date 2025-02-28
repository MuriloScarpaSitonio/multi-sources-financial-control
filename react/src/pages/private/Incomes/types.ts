import { RawDateString } from "../../../types";
import { AssetWrite } from "../Assets/api/models";
import { EventTypesMapping, TypesMapping } from "./consts";

export type HistoricReportResponse = {
  avg: number;
  historic: {
    month: RawDateString;
    credited: number;
    provisioned: number;
  }[];
};
export type TopAssetsResponse = {
  code: string;
  credited: number;
  provisioned: number;
}[];

export type Income = {
  id: number;
  type: keyof typeof TypesMapping;
  event_type: keyof typeof EventTypesMapping;
  amount: number;
  operation_date: RawDateString;
  current_currency_conversion_rate: number;
  asset: AssetWrite;
};

export type IncomeWrite = {
  asset_pk: number;
  type: string;
  event_type: string;
  amount: number;
  operation_date: Date;
  current_currency_conversion_rate?: number;
};

export type Filters = {
  asset_type: string[];
  event_type: string;
  type: string[];
};
