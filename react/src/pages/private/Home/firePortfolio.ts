import type { FirePlanningPreferences } from "../Planning/api";
import type { FireAllocationBucket } from "../Planning/fireAllocation";
import type { FireReturnSeriesKey, ReturnCategory } from "./fireReturnTypes";
import { FIRE_RETURN_SERIES } from "./fireReturns";

export type PortfolioSlice = {
  category: ReturnCategory | "CASH";
  series: FireReturnSeriesKey;
  weight: number;
  constrainsSample: boolean;
};

export type PortfolioAtFn = (yearIndex: number) => readonly PortfolioSlice[];

const selectableSeries = {
  US_EQUITY: (preferences: Required<FirePlanningPreferences>) =>
    preferences.us_equity_proxy,
  GLOBAL_EQUITY: (preferences: Required<FirePlanningPreferences>) =>
    preferences.global_equity_proxy,
  CRYPTO: (preferences: Required<FirePlanningPreferences>) =>
    preferences.crypto_proxy,
} as const;

const fixedSeries = (bucket: FireAllocationBucket): FireReturnSeriesKey => {
  if (bucket.series === null) {
    throw new Error(`${bucket.category} has no derived return series`);
  }
  return bucket.series;
};

const resolveSeries = (
  bucket: FireAllocationBucket,
  preferences: Required<FirePlanningPreferences>,
): FireReturnSeriesKey => {
  if (bucket.category in selectableSeries) {
    return selectableSeries[bucket.category as keyof typeof selectableSeries](
      preferences,
    );
  }
  return fixedSeries(bucket);
};

export const buildPortfolio = (
  allocation: readonly FireAllocationBucket[],
  preferences: Required<FirePlanningPreferences>,
): PortfolioSlice[] => {
  const nonZero = allocation.filter((bucket) => bucket.total > 0);
  const total = nonZero.reduce((sum, bucket) => sum + bucket.total, 0);
  if (total <= 0) return [];

  return nonZero.map((bucket) => {
    const excluded =
      bucket.category !== "CASH" &&
      preferences.excluded_return_categories.includes(bucket.category);
    return {
      category: bucket.category,
      series: excluded ? "CASH" : resolveSeries(bucket, preferences),
      weight: bucket.total / total,
      constrainsSample: bucket.category !== "CASH" && !excluded,
    };
  });
};

export const eligibleMonths = (
  portfolio: readonly PortfolioSlice[],
): readonly string[] => {
  const constraining = portfolio.filter((slice) => slice.constrainsSample);
  if (constraining.length === 0) return FIRE_RETURN_SERIES.CASH.months;

  const [first, ...rest] = constraining;
  const remaining = rest.map(
    (slice) => new Set(FIRE_RETURN_SERIES[slice.series].months),
  );
  return FIRE_RETURN_SERIES[first.series].months.filter((month) =>
    remaining.every((months) => months.has(month)),
  );
};

export const eligiblePeriod = (portfolio: readonly PortfolioSlice[]) => {
  const months = eligibleMonths(portfolio);
  return {
    first: months[0] ?? null,
    last: months[months.length - 1] ?? null,
    count: months.length,
  };
};

const returnIndexBySeries = new Map<
  FireReturnSeriesKey,
  ReadonlyMap<string, number>
>();

export const returnForMonth = (
  slice: PortfolioSlice,
  month: string,
): number => {
  let index = returnIndexBySeries.get(slice.series);
  if (!index) {
    const data = FIRE_RETURN_SERIES[slice.series];
    index = new Map(data.months.map((key, position) => [key, position]));
    returnIndexBySeries.set(slice.series, index);
  }
  const position = index.get(month);
  if (position === undefined) {
    throw new Error(`${slice.series} has no return for ${month}`);
  }
  return FIRE_RETURN_SERIES[slice.series].realReturns[position];
};

const scaleSlices = (
  slices: readonly PortfolioSlice[],
  target: number,
): PortfolioSlice[] => {
  const current = slices.reduce((sum, slice) => sum + slice.weight, 0);
  if (current <= 0 || target <= 0) return [];
  return slices.map((slice) => ({
    ...slice,
    weight: (target * slice.weight) / current,
  }));
};

export const buildAgeInBondsPortfolio = (
  base: readonly PortfolioSlice[],
  stockFraction: number,
): PortfolioSlice[] => {
  const cash = base.filter((slice) => slice.category === "CASH");
  const variable = base.filter(
    (slice) =>
      slice.category !== "CASH" && !slice.category.startsWith("FIXED_"),
  );
  const fixed = base.filter((slice) => slice.category.startsWith("FIXED_"));
  const cashWeight = cash.reduce((sum, slice) => sum + slice.weight, 0);
  const investedWeight = Math.max(0, 1 - cashWeight);
  const boundedStockFraction = Math.min(1, Math.max(0, stockFraction));
  const variableBase: readonly PortfolioSlice[] = variable.length
    ? variable
    : [
        {
          category: "BR_EQUITY",
          series: "IBOV",
          weight: 1,
          constrainsSample: true,
        },
      ];
  const fixedBase: readonly PortfolioSlice[] = fixed.length
    ? fixed
    : [
        {
          category: "FIXED_SELIC",
          series: "IMA_GERAL_EX_C",
          weight: 1,
          constrainsSample: true,
        },
      ];

  return [
    ...cash,
    ...scaleSlices(variableBase, investedWeight * boundedStockFraction),
    ...scaleSlices(fixedBase, investedWeight * (1 - boundedStockFraction)),
  ];
};
