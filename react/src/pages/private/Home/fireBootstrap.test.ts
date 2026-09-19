import type { FirePlanningPreferences } from "../Planning/api";
import type { FireAllocationBucket } from "../Planning/fireAllocation";
import { buildPortfolio } from "./firePortfolio";
import { runBootstrap, sampleMonthKeys } from "./fireBootstrap";

const assertDeepEqual = (
  actual: unknown,
  expected: unknown,
  message: string,
) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
    );
  }
};

const DEFAULT_FIRE_PREFERENCES = {
  withdrawal_rate: 4,
  target_years: 30,
  simulated_patrimony: null,
  monthly_expenses_override: null,
  sampling_method: "independent_months",
  us_equity_proxy: "SPY",
  global_equity_proxy: "VT",
  crypto_proxy: "BTC",
  excluded_return_categories: [],
  historical_series_overrides: {},
  historical_series_fallbacks: {},
} satisfies Required<FirePlanningPreferences>;

const sequenceRng = (values: readonly number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

const monthsFrom = (first: string, last: string): string[] => {
  const result: string[] = [];
  let [year, month] = first.split("-").map(Number);
  const [lastYear, lastMonth] = last.split("-").map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      year += 1;
      month = 1;
    }
  }
  return result;
};

assertDeepEqual(
  sampleMonthKeys({
    eligible: ["2008-01", "2008-02", "2008-03"],
    method: "independent_months",
    count: 3,
    rng: sequenceRng([0, 0.99, 0.34]),
  }),
  ["2008-01", "2008-03", "2008-02"],
  "independent sampling draws aligned months",
);

assertDeepEqual(
  sampleMonthKeys({
    eligible: monthsFrom("2008-01", "2009-12"),
    method: "contiguous_12_month_blocks",
    count: 12,
    rng: () => 0,
  }),
  monthsFrom("2008-01", "2008-12"),
  "block sampling preserves a complete historical year",
);

const allocation: FireAllocationBucket[] = [
  { category: "BR_EQUITY", series: "IBOV", total: 60 },
  { category: "FIXED_CDI", series: "CDI", total: 40 },
];
const result = runBootstrap(
  1_000_000,
  40_000,
  2,
  buildPortfolio(allocation, DEFAULT_FIRE_PREFERENCES),
  "independent_months",
  10,
);
assertDeepEqual(
  [result.bands.length, result.withdrawalBands.length],
  [3, 2],
  "generalized portfolio keeps the bootstrap result shape",
);
