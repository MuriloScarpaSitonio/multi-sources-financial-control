import { expect, it } from "vitest";
import { DEFAULT_ONE_OVER_N_PREFERENCES } from "../api";
import {
  buildOneOverNSnapshot,
  withoutOneOverNHistoricalFallbacks,
} from "./oneOverNScenario";
const draft = {
  isReady: true,
  currentAge: 40,
  allocation: [
    { category: "CASH" as const, series: "CASH" as const, total: 900000 },
    { category: "FIXED_CDI" as const, series: "CDI" as const, total: 100000 },
  ],
  preferences: DEFAULT_ONE_OVER_N_PREFERENCES,
  simulatedPatrimony: null,
  avgExpenses: 5000,
  monthlySavings: -500,
};
it("includes cash exactly once and keeps signed savings", () => {
  const s = buildOneOverNSnapshot(draft)!;
  expect(s.actualPatrimony).toBe(1000000);
  expect(s.request.kind).toBe("one_over_n");
  expect(s.request.input.accumulation.monthlySavings).toBe(-500);
  expect(s.portfolio[0]).toMatchObject({ series: "CASH", weight: 0.9 });
  expect(s.initialMonthlyIncome).toBeCloseTo(1666.6666667);
});
it("does not submit unready or invalid-age data", () => {
  expect(buildOneOverNSnapshot({ ...draft, isReady: false })).toBeNull();
  expect(() => buildOneOverNSnapshot({ ...draft, currentAge: 95 })).toThrow(
    /idade/i,
  );
});
it("keeps simulated retirement wealth separate from actual accumulation wealth", () => {
  const s = buildOneOverNSnapshot({ ...draft, simulatedPatrimony: 2000000 })!;
  expect(s.patrimony).toBe(2000000);
  expect(s.request.input.accumulation.startingBalance).toBe(1000000);
});
it("cash-only portfolios do not become 60/40", () => {
  const s = buildOneOverNSnapshot({
    ...draft,
    allocation: [draft.allocation[0]],
  })!;
  expect(s.portfolio).toHaveLength(1);
  expect(s.portfolio[0]).toMatchObject({ series: "CASH", weight: 1 });
});
it("removes historical complements without changing scenario amounts", () => {
  const s = buildOneOverNSnapshot(draft)!;
  expect(withoutOneOverNHistoricalFallbacks(s).patrimony).toBe(1000000);
});
