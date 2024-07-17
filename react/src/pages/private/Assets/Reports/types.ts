import type {
  AssetsObjectivesMapping,
  AssetsSectorsMapping,
  AssetsTypesMapping,
} from "../consts";

export type ReportDataItem = {
  total: number;
  type?: string;
  objective?: string;
  sector?: string;
};
export type ReportAggregatedByTypeDataItem = ReportDataItem & {
  type: keyof typeof AssetsTypesMapping;
};
export type ReportAggregatedByObjectiveDataItem = ReportDataItem & {
  objective: keyof typeof AssetsObjectivesMapping;
};
export type ReportAggregatedBySectorDataItem = ReportDataItem & {
  sector: keyof typeof AssetsSectorsMapping;
};

export enum GroupBy {
  TYPE = "type",
  SECTOR = "sector",
  OBJECTIVE = "objective",
}

export type ReportUnknownAggregationData =
  | ReportAggregatedByTypeDataItem[]
  | ReportAggregatedByObjectiveDataItem[]
  | ReportAggregatedBySectorDataItem[];

export enum Kinds {
  TOTAL_INVESTED_PERCENTAGE = "total_invested_percentage",
  TOTAL_INVESTED = "total_invested",
  ROI = "roi",
}
