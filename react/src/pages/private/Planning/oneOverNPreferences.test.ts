import { expect, it } from "vitest";
import { getOneOverNPlanningPreferences } from "./api";
it("ignores legacy fixed returns and defaults historical sampling", () => {
  const legacy = { target_depletion_age: 90, real_return: 8 };
  const p = getOneOverNPlanningPreferences({ one_over_n: legacy });
  expect(p).not.toHaveProperty("real_return");
  expect(p).toMatchObject({
    target_depletion_age: 90,
    extra_accumulation_years: 0,
    sampling_method: "independent_months",
    monthly_savings_override: null,
  });
});
it("preserves historical assumptions and signed savings", () => {
  expect(
    getOneOverNPlanningPreferences({
      one_over_n: {
        extra_accumulation_years: 3,
        sampling_method: "contiguous_12_month_blocks",
        monthly_savings_override: -500,
        historical_series_fallbacks: { "FIXED_IPCA:IMA_B_5_PLUS": "IBOV" },
      },
    }),
  ).toMatchObject({
    extra_accumulation_years: 3,
    monthly_savings_override: -500,
    historical_series_fallbacks: { "FIXED_IPCA:IMA_B_5_PLUS": "IBOV" },
  });
});
