import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FIRE_RETURN_SERIES } from "../../Home/fireReturns";
import { historicalPhases } from "./fireHistoricalDatasets";
import FireHistoricalCoverage from "./FireHistoricalCoverage";
afterEach(cleanup);
const slice = {
  category: "FIXED_SELIC",
  series: "IMA_S",
  fallbackSeries: "CDI",
  weight: 1,
  constrainsSample: true,
} as const;
it("counts only shared eligible months when displaying fallback contribution", () => {
  render(
    <FireHistoricalCoverage
      slice={slice}
      months={["1995-01", FIRE_RETURN_SERIES.IMA_S.months[0]]}
    />,
  );
  expect(screen.getByText("50% complementado · 50% principal")).toBeVisible();
});
it("explains when another bucket prevents the earlier dataset from being used", () => {
  render(<FireHistoricalCoverage slice={slice} months={["2020-01"]} />);
  expect(screen.getByText("0% complementado · 100% principal")).toBeVisible();
  expect(screen.getByText(/Os outros grupos limitam/)).toBeVisible();
});
it("does not invent percentages when the histories have no common months", () => {
  render(<FireHistoricalCoverage slice={slice} months={[]} />);
  expect(screen.getByText(/Sem meses em comum/)).toBeVisible();
  expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
});

it("keeps accumulation history separate from age-in-bonds retirement history", () => {
  const phases = historicalPhases(
    [
      {
        category: "US_EQUITY",
        series: "VTI",
        fallbackSeries: "SPY",
        weight: 1,
        constrainsSample: true,
      },
    ],
    true,
  );
  expect(phases[0].months[0]).toBe("2000-01");
  expect(phases[1].months[0]).toBe("2005-04");
});
it("allows bond-only history to expand after the equity sleeve disappears", () => {
  const phases = historicalPhases(
    [
      {
        category: "GLOBAL_EQUITY",
        series: "VT",
        weight: 0.5,
        constrainsSample: true,
      },
      { ...slice, weight: 0.5 },
    ],
    true,
  );
  expect(phases[1].months[0]).not.toBe("1995-01");
  expect(phases[2].months[0]).toBe("1995-01");
  expect(phases[2].portfolio).toHaveLength(1);
});
