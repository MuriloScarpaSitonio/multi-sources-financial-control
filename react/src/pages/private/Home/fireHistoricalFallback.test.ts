import { describe, expect, it } from "vitest";
import { DEFAULT_FIRE_PREFERENCES } from "../Planning/api";
import {
  buildAgeInBondsPortfolio,
  buildPortfolio,
  eligibleMonths,
  returnForMonth,
} from "./firePortfolio";
import { FIRE_RETURN_SERIES } from "./fireReturns";

const bucket = {
  category: "FIXED_IPCA",
  series: "IMA_B_5_PLUS",
  total: 1000,
} as const;
const extended = () =>
  buildPortfolio([bucket], {
    ...DEFAULT_FIRE_PREFERENCES,
    historical_series_fallbacks: { "FIXED_IPCA:IMA_B_5_PLUS": "IBOV" },
  });
const seriesReturn = (key: "IBOV" | "IMA_B_5_PLUS", month: string) => {
  const data = FIRE_RETURN_SERIES[key];
  return data.realReturns[data.months.indexOf(month)];
};
describe("historical fallback", () => {
  it("prefixes earlier months, giving the primary priority at its first month and throughout overlap", () => {
    const portfolio = extended();
    const first = FIRE_RETURN_SERIES.IMA_B_5_PLUS.months[0];
    expect(eligibleMonths(portfolio)[0]).toBe("1995-01");
    expect(returnForMonth(portfolio[0], "1995-01")).toBe(
      seriesReturn("IBOV", "1995-01"),
    );
    expect(returnForMonth(portfolio[0], first)).toBe(
      seriesReturn("IMA_B_5_PLUS", first),
    );
    expect(returnForMonth(portfolio[0], "2020-03")).toBe(
      seriesReturn("IMA_B_5_PLUS", "2020-03"),
    );
    expect(portfolio[0].category).toBe("FIXED_IPCA");
    expect(portfolio[0].weight).toBe(1);
    expect(
      buildAgeInBondsPortfolio(portfolio, 0.4).find(
        (slice) => slice.category === "FIXED_IPCA",
      )?.fallbackSeries,
    ).toBe("IBOV");
  });
  it("still respects the other buckets' historical coverage", () => {
    const portfolio = [
      ...extended().map((slice) => ({ ...slice, weight: 0.5 })),
      {
        category: "CRYPTO",
        series: "BTC",
        weight: 0.5,
        constrainsSample: true,
      } as const,
    ];
    expect(eligibleMonths(portfolio)[0]).toBe(FIRE_RETURN_SERIES.BTC.months[0]);
  });
  it("leaves existing portfolios unchanged when no fallback is selected", () => {
    const portfolio = buildPortfolio([bucket], DEFAULT_FIRE_PREFERENCES);
    expect(portfolio).toEqual([
      {
        category: "FIXED_IPCA",
        series: "IMA_B_5_PLUS",
        weight: 1,
        constrainsSample: true,
      },
    ]);
    expect(eligibleMonths(portfolio)).toEqual(
      FIRE_RETURN_SERIES.IMA_B_5_PLUS.months,
    );
  });
});
