import { useQuery } from "@tanstack/react-query";

import { apiProvider } from "../../../api/methods";
import type {
  FireReturnSeriesKey,
  ReturnCategory,
} from "../Home/fireReturnTypes";

export type FireAllocationBucket = {
  category: ReturnCategory | "CASH";
  series: FireReturnSeriesKey | null;
  total: number;
};

export type FireAllocationResponse = {
  as_of: string;
  buckets: FireAllocationBucket[];
};

export const useFireAllocation = () =>
  useQuery({
    queryKey: ["fire-allocation"],
    queryFn: async () =>
      (await apiProvider.get("assets/fire_allocation"))
        .data as FireAllocationResponse,
  });
