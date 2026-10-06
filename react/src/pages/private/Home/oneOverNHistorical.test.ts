import { expect, it } from "vitest";
import { runOneOverNRetirement } from "./oneOverNSimulation";
import { buildPortfolio } from "./firePortfolio";
import { DEFAULT_ONE_OVER_N_PREFERENCES } from "../Planning/api";
it.each(["independent_months", "contiguous_12_month_blocks"] as const)(
  "uses the selected real histories with repeatable %s sampling",
  (samplingMethod) => {
    const cash = buildPortfolio(
      [{ category: "CASH", series: "CASH", total: 600000 }],
      DEFAULT_ONE_OVER_N_PREFERENCES,
    );
    const stock = buildPortfolio(
      [{ category: "BR_EQUITY", series: "IBOV", total: 600000 }],
      DEFAULT_ONE_OVER_N_PREFERENCES,
    );
    const input = {
      startingBalance: 600000,
      monthlyExpenses: 1000,
      years: 5,
      numTrials: 20,
      samplingMethod,
      portfolio: cash,
    };
    const result = runOneOverNRetirement(input);
    expect(result).toEqual(runOneOverNRetirement(input));
    expect(result.withdrawalBands[0].p50).toBe(10000);
    expect(result.withdrawalBands).not.toEqual(
      runOneOverNRetirement({ ...input, portfolio: stock }).withdrawalBands,
    );
    expect(result.balanceBands.at(-1)?.p90).toBe(0);
  },
);
