import { RawDateString } from "../../../types";

export enum GroupBy {
  CATEGORY = "category",
  SOURCE = "source",
  TYPE = "type",
}

export enum Kinds {
  TOTAL_SPENT,
  PERCENTAGE,
  HISTORIC,
}

export type AvgComparasionPeriods =
  | "since_a_year_ago"
  | "current_month_and_past";

export type ReportDataItem = {
  total: number;
  avg: number;
  type?: string;
  category?: string;
  source?: string;
};
export type ReportAggregatedByTypeDataItem = ReportDataItem & {
  type: string;
};
export type ReportAggregatedByCategoryDataItem = ReportDataItem & {
  category: string;
};
export type ReportAggregatedBySourceDataItem = ReportDataItem & {
  source: string;
};

export type ReportUnknownAggregationData =
  | ReportAggregatedByTypeDataItem[]
  | ReportAggregatedByCategoryDataItem[]
  | ReportAggregatedBySourceDataItem[];

export type HistoricReportDataItem = {
  total: number;
  month: RawDateString;
};

export type HistoricReportResponse = {
  historic: HistoricReportDataItem[];
  avg: number;
};

export type Filters = {
  category?: string[];
  source?: string[];
};
