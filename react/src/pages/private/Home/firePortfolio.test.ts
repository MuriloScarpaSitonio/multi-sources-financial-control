import type { FirePlanningPreferences } from "../Planning/api";
import type { FireAllocationBucket } from "../Planning/fireAllocation";
import { FIRE_RETURN_SERIES } from "./fireReturns";
import {
  buildAgeInBondsPortfolio,
  buildPortfolio,
  eligibleMonths,
  eligiblePeriod,
} from "./firePortfolio";

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
  monthly_expenses_override: null,
  sampling_method: "independent_months",
  us_equity_proxy: "SPY",
  global_equity_proxy: "VT",
  crypto_proxy: "BTC",
  excluded_return_categories: [],
} satisfies Required<FirePlanningPreferences>;

const allocation: FireAllocationBucket[] = [
  { category: "BR_EQUITY", series: "IBOV", total: 999_000 },
  { category: "GLOBAL_EQUITY", series: null, total: 1_000 },
  { category: "US_EQUITY", series: null, total: 0 },
];

const portfolio = buildPortfolio(allocation, DEFAULT_FIRE_PREFERENCES);
assertDeepEqual(
  portfolio,
  [
    {
      category: "BR_EQUITY",
      series: "IBOV",
      weight: 0.999,
      constrainsSample: true,
    },
    {
      category: "GLOBAL_EQUITY",
      series: "VT",
      weight: 0.001,
      constrainsSample: true,
    },
  ],
  "selector mappings and zero-balance removal",
);

assertDeepEqual(
  eligibleMonths(portfolio),
  FIRE_RETURN_SERIES.IBOV.months.filter((month) =>
    FIRE_RETURN_SERIES.VT.months.includes(month),
  ),
  "a 0.1% included holding restricts the sample",
);

const excluded = buildPortfolio(allocation, {
  ...DEFAULT_FIRE_PREFERENCES,
  excluded_return_categories: ["GLOBAL_EQUITY"],
});
assertDeepEqual(
  excluded,
  [
    {
      category: "BR_EQUITY",
      series: "IBOV",
      weight: 0.999,
      constrainsSample: true,
    },
    {
      category: "GLOBAL_EQUITY",
      series: "CASH",
      weight: 0.001,
      constrainsSample: false,
    },
  ],
  "excluded value remains weighted but receives cash returns",
);
assertDeepEqual(
  eligibleMonths(excluded),
  FIRE_RETURN_SERIES.IBOV.months,
  "excluded categories and cash do not constrain the sample",
);

const selectableAllocation: FireAllocationBucket[] = [
  { category: "US_EQUITY", series: null, total: 1 },
  { category: "GLOBAL_EQUITY", series: null, total: 1 },
  { category: "CRYPTO", series: null, total: 1 },
];
assertDeepEqual(
  buildPortfolio(selectableAllocation, {
    ...DEFAULT_FIRE_PREFERENCES,
    us_equity_proxy: "VTI",
    global_equity_proxy: "VWRL",
    crypto_proxy: "CMBI10",
  }).map((slice) => slice.series),
  ["VTI", "VWRL", "CMBI10"],
  "all selectable proxy mappings",
);

const period = eligiblePeriod(portfolio);
const months = eligibleMonths(portfolio);
assertDeepEqual(
  period,
  { first: months[0], last: months[months.length - 1], count: months.length },
  "displayed period comes from the intersected months",
);

const withCash = buildPortfolio(
  [
    { category: "BR_EQUITY", series: "IBOV", total: 50 },
    { category: "CASH", series: "CASH", total: 50 },
  ],
  DEFAULT_FIRE_PREFERENCES,
);
assertDeepEqual(
  withCash.map((slice) => [
    slice.category,
    slice.weight,
    slice.constrainsSample,
  ]),
  [
    ["BR_EQUITY", 0.5, true],
    ["CASH", 0.5, false],
  ],
  "cash is weighted but never constrains",
);

assertDeepEqual(
  buildAgeInBondsPortfolio(withCash, 0.6).map((slice) => [
    slice.category,
    slice.series,
    slice.weight,
  ]),
  [
    ["CASH", "CASH", 0.5],
    ["BR_EQUITY", "IBOV", 0.3],
    ["FIXED_SELIC", "IMA_GERAL_EX_C", 0.2],
  ],
  "age in bonds keeps cash and creates the fixed-income fallback",
);

const agePortfolioWithExcludedVariable = buildPortfolio(
  [
    { category: "BR_EQUITY", series: "IBOV", total: 600 },
    { category: "GLOBAL_EQUITY", series: null, total: 200 },
    { category: "FIXED_CDI", series: "CDI", total: 200 },
  ],
  {
    ...DEFAULT_FIRE_PREFERENCES,
    excluded_return_categories: ["GLOBAL_EQUITY"],
  },
);
assertDeepEqual(
  buildAgeInBondsPortfolio(agePortfolioWithExcludedVariable, 0.5).map(
    (slice) => [
      slice.category,
      slice.series,
      Number(slice.weight.toFixed(6)),
      slice.constrainsSample,
    ],
  ),
  [
    ["BR_EQUITY", "IBOV", 0.375, true],
    ["GLOBAL_EQUITY", "CASH", 0.125, false],
    ["FIXED_CDI", "CDI", 0.5, true],
  ],
  "age in bonds keeps excluded categories on their original side",
);
