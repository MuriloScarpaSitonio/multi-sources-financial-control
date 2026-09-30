import type { VPWPlanningPreferences } from "../Planning/api";
import type { FireAllocationBucket } from "../Planning/fireAllocation";
import { buildPortfolio, type PortfolioSlice } from "./firePortfolio";

export type VPWPortfolio = {
  allocation: readonly FireAllocationBucket[];
  modeledAllocation: readonly FireAllocationBucket[];
  investmentTotal: number;
  stockPct: number;
  portfolio: PortfolioSlice[];
};

export const buildVPWPortfolio = (
  allocation: readonly FireAllocationBucket[],
  preferences: Required<VPWPlanningPreferences>,
): VPWPortfolio => {
  const invested = allocation.filter(
    (bucket) => bucket.category !== "CASH" && bucket.total > 0,
  );
  const investmentTotal = invested.reduce(
    (sum, bucket) => sum + bucket.total,
    0,
  );
  const variable = invested.filter(
    (bucket) => !bucket.category.startsWith("FIXED_"),
  );
  const variableTotal = variable.reduce((sum, bucket) => sum + bucket.total, 0);
  const stockPct =
    investmentTotal > 0 ? (variableTotal / investmentTotal) * 100 : 60;
  // Retain the established reference only when there are no investments.
  const modeled: FireAllocationBucket[] =
    investmentTotal > 0
      ? invested
      : [
          { category: "BR_EQUITY", series: "IBOV", total: 0.6 },
          { category: "FIXED_CDI", series: "CDI", total: 0.4 },
        ];

  return {
    allocation: invested,
    modeledAllocation: modeled,
    investmentTotal,
    stockPct,
    portfolio: buildPortfolio(modeled, preferences),
  };
};
