import { expect, it, vi } from "vitest";
vi.mock("./fireReturns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fireReturns")>();
  return {
    ...actual,
    FIRE_RETURN_SERIES: {
      ...actual.FIRE_RETURN_SERIES,
      IMA_B_5_PLUS: {
        ...actual.FIRE_RETURN_SERIES.IMA_B_5_PLUS,
        months: ["2004-05", "2004-07"],
        realReturns: [0.01, 0.02],
      },
    },
  };
});
import { eligibleMonths, returnForMonth } from "./firePortfolio";
it("does not fill primary gaps or extend its end date", () => {
  const portfolio = [
    {
      category: "FIXED_IPCA",
      series: "IMA_B_5_PLUS",
      fallbackSeries: "IBOV",
      weight: 1,
      constrainsSample: true,
    },
  ] as const;
  expect(eligibleMonths(portfolio)[0]).toBe("1995-01");
  expect(eligibleMonths(portfolio).at(-1)).toBe("2004-07");
  expect(eligibleMonths(portfolio)).not.toContain("2004-06");
  expect(returnForMonth(portfolio[0], "2004-05")).toBe(0.01);
  expect(() => returnForMonth(portfolio[0], "2004-06")).toThrow();
});
