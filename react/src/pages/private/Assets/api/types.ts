import { SimulatedAsset } from "./models";

export type ApiListResponse<T> = {
  results: T[];
  count: number;
  next: string;
  previous: string;
};

export type SimulatedAssetResponse = {
  old: SimulatedAsset;
  new: SimulatedAsset;
};
