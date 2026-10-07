import { beforeEach, expect, it, vi } from "vitest";
import { findOneOverNTargets } from "./oneOverNTargets";
const fixture = vi.hoisted(() => ({ returns: [0], badTrials: 0 }));
vi.mock("./fireBootstrap", async (importOriginal) => {
  const original = await importOriginal<typeof import("./fireBootstrap")>();
  return {
    ...original,
    preparePortfolio: () => {
      let trial = 0;
      return {
        returns: fixture.returns,
        sampleMonths: (count: number) =>
          Array(count).fill(trial++ < fixture.badTrials ? 1 : 0),
      };
    },
  };
});
beforeEach(() => {
  fixture.returns = [0];
  fixture.badTrials = 0;
});
const input = {
  monthlyExpenses: 2500,
  years: 20,
  portfolio: [],
  samplingMethod: "independent_months" as const,
  numTrials: 20,
};
it("reduces the target with the remaining lifetime rather than delaying depletion", () => {
  expect(findOneOverNTargets(input, 1)).toEqual([600000, 570000]);
});
it("checks late income, not just the initial withdrawal", () => {
  fixture.returns = [Math.pow(0.5, 1 / 12) - 1];
  expect(
    findOneOverNTargets({ ...input, monthlyExpenses: 1000, years: 2 }, 0)[0],
  ).toBe(48000);
});
it("uses 95% coverage rather than 90%", () => {
  fixture.returns = [0, Math.pow(0.5, 1 / 12) - 1];
  fixture.badTrials = 2;
  expect(
    findOneOverNTargets({ ...input, monthlyExpenses: 1000, years: 2 }, 0)[0],
  ).toBe(48000);
});
it("zero expenses do not need a capital target", () => {
  expect(findOneOverNTargets({ ...input, monthlyExpenses: 0 }, 1)).toEqual([
    0, 0,
  ]);
});
it("reports an unavailable target when more than 5% lose all future income", () => {
  fixture.returns = [0, -1];
  fixture.badTrials = 2;
  expect(() => findOneOverNTargets({ ...input, years: 2 }, 0)).toThrow(/meta/i);
});
