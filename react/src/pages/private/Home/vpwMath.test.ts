import assert from "node:assert/strict";
import { test } from "node:test";
import { vpwMonthlyRate, vpwMonthlyRates, vpwTarget } from "./vpwMath";

const close = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );

test("zero growth gives positive even payments over the remaining months", () => {
  close(120000 * vpwMonthlyRate(0, 120), 1000);
  close(vpwTarget(1000, 0, 120), 120000);
});

test("5% annual growth funds beginning-of-month payments, including the target", () => {
  const payment = 100000 * vpwMonthlyRate(0.05, 240);
  close(payment, 651.18, 0.01);
  close(vpwTarget(payment, 0.05, 240), 100000);
  // Independent cash-flow check, applying monthly growth only after payment.
  const monthlyGrowth = Math.pow(1.05, 1 / 12) - 1;
  let balance = 100000;
  const rates = vpwMonthlyRates(0.05, 240);
  for (const rate of rates) {
    close(balance * rate, payment, 1e-6);
    balance = (balance - payment) * (1 + monthlyGrowth);
  }
  close(balance, 0, 1e-6);
});

test("last month pays available balance regardless of assumed growth", () => {
  for (const growth of [-0.5, 0, 0.05]) close(vpwMonthlyRate(growth, 1), 1);
});

test("negative growth lowers the affordable payment without changing its sign", () => {
  const rate = vpwMonthlyRate(-0.05, 120);
  assert.ok(rate > 0 && rate < 1 / 120);
  assert.ok(vpwTarget(1000, -0.05, 120) > 120000);
});

test("negligible growth converges continuously to zero growth", () => {
  for (const rate of [-1e-14, 1e-14])
    close(vpwMonthlyRate(rate, 120), 1 / 120, 1e-12);
});

test("precomputed schedule covers every remaining month", () => {
  const schedule = vpwMonthlyRates(0, 3);
  assert.deepEqual([...schedule], [1 / 3, 1 / 2, 1]);
  assert.equal(vpwTarget(0, 0.05, 120), 0);
});

test("invalid horizons, returns, and expenses are rejected", () => {
  for (const months of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => vpwMonthlyRate(0.05, months), /months/i);
    assert.throws(() => vpwMonthlyRates(0.05, months), /months/i);
  }
  for (const growth of [-1, -2, NaN, Infinity])
    assert.throws(() => vpwMonthlyRate(growth, 120), /growth/i);
  for (const spending of [-1, NaN, Infinity])
    assert.throws(() => vpwTarget(spending, 0.05, 120), /spending/i);
});
