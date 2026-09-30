import { describe, expect, it } from "vitest";
import { getFirePlanningPreferences, getVPWPlanningPreferences } from "./api";
import { buildPortfolio } from "../Home/firePortfolio";

describe("VPW historical preferences", () => {
  it("defaults independently from FIRE saved choices using the same historical defaults", () => {
    const saved = {
      fire: {
        sampling_method: "contiguous_12_month_blocks" as const,
        us_equity_proxy: "VTI" as const,
      },
    };
    const vpw = getVPWPlanningPreferences(saved);
    expect(vpw.sampling_method).toBe("independent_months");
    expect(vpw.us_equity_proxy).toBe("SPY");
    expect(vpw.global_equity_proxy).toBe("VT");
    expect(vpw.crypto_proxy).toBe("BTC");
    expect(vpw.excluded_return_categories).toEqual([]);
    expect(vpw.historical_series_overrides).toEqual({});
    expect(vpw.historical_series_fallbacks).toEqual({});
    expect(getFirePlanningPreferences(saved).sampling_method).toBe(
      "contiguous_12_month_blocks",
    );
    expect(getFirePlanningPreferences(saved).us_equity_proxy).toBe("VTI");
  });

  it("builds an asset-specific portfolio from saved VPW choices", () => {
    const preferences = getVPWPlanningPreferences({
      vpw: {
        sampling_method: "contiguous_12_month_blocks",
        us_equity_proxy: "VTI",
        crypto_proxy: "CMBI10",
        historical_series_overrides: { "FIXED_IPCA:IMA_B_5_PLUS": "IMA_B_5" },
        historical_series_fallbacks: { "FIXED_IPCA:IMA_B_5_PLUS": "IBOV" },
      },
    });
    const portfolio = buildPortfolio(
      [
        { category: "US_EQUITY", series: null, total: 200 },
        { category: "CRYPTO", series: null, total: 100 },
        { category: "FIXED_IPCA", series: "IMA_B_5_PLUS", total: 100 },
      ],
      preferences,
    );
    expect(preferences.sampling_method).toBe("contiguous_12_month_blocks");
    expect(
      portfolio.map((slice) => [
        slice.category,
        slice.series,
        slice.weight,
        slice.fallbackSeries,
      ]),
    ).toEqual([
      ["US_EQUITY", "VTI", 0.5, undefined],
      ["CRYPTO", "CMBI10", 0.25, undefined],
      ["FIXED_IPCA", "IMA_B_5", 0.25, "IBOV"],
    ]);
  });
});
