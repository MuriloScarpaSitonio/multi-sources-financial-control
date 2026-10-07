import { expect, it } from "vitest";
import { traceOneOverNTrial } from "./oneOverNTrial";
it("spends the full annual allowance monthly and exhausts wealth at the end", () => {
  const t = traceOneOverNTrial({
    startingBalance: 600000,
    years: 20,
    monthlyReturns: Array(240).fill(0),
  });
  expect(t.annualWithdrawals).toEqual(Array(20).fill(30000));
  expect(t.monthlyPayments).toEqual(Array(240).fill(2500));
  expect(t.balances).toHaveLength(21);
  expect(t.balances[0]).toBe(600000);
  expect(t.balances.at(-1)).toBe(0);
  expect(t.minimumMonthlyIncome).toBe(2500);
});
it.each([0.1, -0.1, -1])(
  "spends all final-year wealth without reinvesting its allowance (%s)",
  (r) => {
    const t = traceOneOverNTrial({
      startingBalance: 12000,
      years: 1,
      monthlyReturns: Array(12).fill(r),
    });
    expect(t.annualWithdrawals).toEqual([12000]);
    expect(t.monthlyPayments).toEqual(Array(12).fill(1000));
    expect(t.balances.at(-1)).toBe(0);
  },
);
it.each([
  { years: 0, monthlyReturns: [] },
  { years: 1, monthlyReturns: [0] },
  { years: 1, monthlyReturns: Array(12).fill(NaN) },
  { years: 1, monthlyReturns: Array(12).fill(-1.1) },
])("rejects invalid retirement arithmetic", (args) => {
  expect(() =>
    traceOneOverNTrial({ startingBalance: 1000, ...args }),
  ).toThrow();
});
it("allows income to fall after poor returns", () => {
  const t = traceOneOverNTrial({
    startingBalance: 24000,
    years: 2,
    monthlyReturns: Array(24).fill(Math.pow(0.5, 1 / 12) - 1),
  });
  expect(t.minimumMonthlyIncome).toBeCloseTo(500, 6);
  expect(t.annualWithdrawals[0]).toBe(12000);
});
