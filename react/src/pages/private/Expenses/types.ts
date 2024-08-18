export enum GroupBy {
  CATEGORY = "category",
  SOURCE = "source",
  TYPE = "type",
}

export enum Kinds {
  TOTAL_SPENT,
  PERCENTAGE,
}

export type PercentagePeriods =
  | "since_a_year_ago"
  | "current_month_and_past"
  | "current";

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
