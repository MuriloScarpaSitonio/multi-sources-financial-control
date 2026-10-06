import { describe, expect, it } from "vitest";
import { getVPWPlanningPreferences } from "../Planning/api";
import type { FireAllocationBucket } from "../Planning/fireAllocation";
import { buildVPWPortfolio } from "./vpwPortfolio";

const allocation: FireAllocationBucket[] = [
  { category: "CASH", series: "CASH", total: 500 },
  { category: "US_EQUITY", series: null, total: 200 },
  { category: "BR_EQUITY", series: "IBOV", total: 100 },
  { category: "FII", series: "IFIX", total: 100 },
  { category: "FIXED_IPCA", series: "IMA_B_5", total: 100 },
];

describe("VPW portfolio from the shared asset allocation endpoint", () => {
  it("includes bank cash while preserving asset-specific histories and actual wealth", () => {
    const result = buildVPWPortfolio(allocation, getVPWPlanningPreferences());
    expect(result.investmentTotal).toBe(1000);
    expect(result.stockPct).toBe(40);
    expect(result.allocation.some((bucket) => bucket.category === "CASH")).toBe(
      true,
    );
    expect(
      result.portfolio.map((slice) => [slice.series, slice.weight]),
    ).toEqual([
      ["CASH", 0.5],
      ["SPY", 0.2],
      ["IBOV", 0.1],
      ["IFIX", 0.1],
      ["IMA_B_5", 0.1],
    ]);
  });

  it("ignores saved allocation overrides and uses the actual portfolio", () => {
    const legacy = { stock_allocation_override: 50 };
    const preferences = { ...getVPWPlanningPreferences(), ...legacy };
    expect(buildVPWPortfolio(allocation, preferences)).toEqual(
      buildVPWPortfolio(allocation, getVPWPlanningPreferences()),
    );
    const normalized = getVPWPlanningPreferences({
      vpw: { ...legacy, target_age: 99 },
    });
    expect(normalized).not.toHaveProperty("stock_allocation_override");
  });

  it("keeps excluded investment categories in wealth while modeling their return as cash", () => {
    const result = buildVPWPortfolio(
      allocation,
      getVPWPlanningPreferences({
        vpw: { excluded_return_categories: ["US_EQUITY"] },
      }),
    );
    expect(result.investmentTotal).toBe(1000);
    expect(result.portfolio[1]).toMatchObject({
      category: "US_EQUITY",
      series: "CASH",
      weight: 0.2,
    });
  });

  it("uses actual CASH history for a cash-only portfolio", () => {
    const result = buildVPWPortfolio(
      [{ category: "CASH", series: "CASH", total: 10000 }],
      getVPWPlanningPreferences(),
    );
    expect(result.investmentTotal).toBe(10000);
    expect(result.stockPct).toBe(0);
    expect(
      result.portfolio.map((slice) => [slice.series, slice.weight]),
    ).toEqual([["CASH", 1]]);
  });

  it("resolves selected global/crypto histories", () => {
    const result = buildVPWPortfolio(
      [
        { category: "GLOBAL_EQUITY", series: null, total: 100 },
        { category: "CRYPTO", series: null, total: 100 },
      ],
      getVPWPlanningPreferences({
        vpw: { global_equity_proxy: "VWRL", crypto_proxy: "CMBI10" },
      }),
    );
    expect(result.portfolio.map((slice) => slice.series)).toEqual([
      "VWRL",
      "CMBI10",
    ]);
  });
});

it("history controls expose actual holdings and the existing empty-portfolio reference", () => {
  const result = buildVPWPortfolio(allocation, getVPWPlanningPreferences());
  expect(result.modeledAllocation).toEqual(allocation);
  const empty = buildVPWPortfolio([], getVPWPlanningPreferences());
  expect(empty.modeledAllocation.map((b) => b.series)).toEqual(["IBOV", "CDI"]);
});
