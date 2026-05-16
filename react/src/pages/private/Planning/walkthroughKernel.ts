// Shared primitives for the FIRE-strategy interactive walkthroughs
// (`BootstrapWalkthrough` for the SWR finder, `FireTargetWalkthrough` for
// the FIRE goal calculation). Both demos use the same fixed example
// portfolio (70% equity / 30% fixed income, no IFIX → full 25-year NEFIN
// sample) so their numbers are directly comparable to Trinity-style
// references. The kernel keeps the demo math in one place: simulation
// rules can change without two files drifting apart.

import {
  EQUITY_REAL_RETURNS,
  FIRE_RETURNS_YEARS,
  FIXED_INCOME_REAL_RETURNS,
} from "../Home/fireReturns";

export const EXAMPLE_EQUITY_WEIGHT = 0.7;
export const EXAMPLE_FI_WEIGHT = 0.3;
export const STARTING_BALANCE = 1_000_000;
export const DEFAULT_HORIZON = 30;
export const HORIZON_MIN = 20;
export const HORIZON_MAX = 80;
export const TRIALS_PER_SEARCH_TEST = 1000;

// Mulberry32 PRNG — matches `fireBootstrap.ts`'s production PRNG so the
// walkthroughs behave deterministically across reloads with the same seed.
export const mulberry32 = (seed: number) => () => {
  let t = (seed = (seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// One historical calendar year's blended real return at the example weights.
// Aligned-year sampling — same calendar year used across asset classes,
// matching `drawAlignedYearReturn` in `fireBootstrap.ts`. The example
// portfolio has zero IFIX so the full 25-year NEFIN window is available.
export const drawYearReturn = (yearIdx: number) =>
  EXAMPLE_EQUITY_WEIGHT * EQUITY_REAL_RETURNS[yearIdx] +
  EXAMPLE_FI_WEIGHT * FIXED_INCOME_REAL_RETURNS[yearIdx];

// Indices into FIRE_RETURNS_YEARS that one trial's `horizon` years draw,
// given a seed. Independent draws (size-1 blocks); year-to-year
// autocorrelation is dropped, cross-asset correlation is preserved by
// downstream alignment.
export const sampleTrialYears = (seed: number, horizon: number): number[] => {
  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let y = 0; y < horizon; y++) {
    out.push(Math.floor(rng() * FIRE_RETURNS_YEARS.length));
  }
  return out;
};

export type TrialResult = {
  balances: number[]; // length horizon + 1
  yearIndices: number[]; // length horizon
  busted: boolean;
};

// Simulate one retiree withdrawing `rate × STARTING_BALANCE` per year for
// `horizon` years. End-of-year withdrawal (Trinity convention) — grow the
// balance, then withdraw, then check for depletion.
export const simulateTrial = (
  rate: number,
  seed: number,
  horizon: number,
): TrialResult => {
  const yearIndices = sampleTrialYears(seed, horizon);
  const annualWithdrawal = STARTING_BALANCE * rate;
  const balances: number[] = [STARTING_BALANCE];
  let balance = STARTING_BALANCE;
  let busted = false;
  for (const idx of yearIndices) {
    if (balance <= 0) {
      balances.push(0);
      continue;
    }
    const grown = balance * (1 + drawYearReturn(idx));
    const withdrawal = Math.min(annualWithdrawal, Math.max(0, grown));
    balance = grown - withdrawal;
    if (balance <= 0) {
      busted = true;
      balance = 0;
    }
    balances.push(balance);
  }
  return { balances, yearIndices, busted };
};

// Fraction of `TRIALS_PER_SEARCH_TEST` simulated retirees who survive `horizon`
// years at `rate`. Same cohort across rate tests — `seedBase` reseeds
// `mulberry32` from the same constant, so iteration `i` of the binary search
// always sees the same dice rolls. Mirrors production's
// `findSafeWithdrawalRate`.
export const simulateSuccessRate = (
  rate: number,
  seedBase: number,
  horizon: number,
): number => {
  let survivors = 0;
  for (let i = 0; i < TRIALS_PER_SEARCH_TEST; i++) {
    const t = simulateTrial(rate, seedBase + i, horizon);
    if (!t.busted) survivors++;
  }
  return survivors / TRIALS_PER_SEARCH_TEST;
};

export type SearchIteration = {
  iter: number;
  lo: number;
  hi: number;
  mid: number;
  successRate: number;
  passes: boolean;
};

// Binary-search the highest withdrawal rate that clears 90% success.
// Returns the full per-iteration history (used by the SWR animation step
// in BootstrapWalkthrough) plus the converged final rate (used by the
// FIRE-target walkthrough's horizon-stretch math).
export const runBinarySearch = (
  seedBase: number,
  horizon: number,
): SearchIteration[] => {
  const iterations: SearchIteration[] = [];
  let lo = 0.005;
  let hi = 0.1;
  const TARGET = 0.9;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const successRate = simulateSuccessRate(mid, seedBase, horizon);
    const passes = successRate >= TARGET;
    iterations.push({ iter: i, lo, hi, mid, successRate, passes });
    if (passes) lo = mid;
    else hi = mid;
  }
  return iterations;
};

// Convenience: run the search and return only the converged rate, mirroring
// production's `findSafeWithdrawalRate` which discards the iteration history.
// Used by the FIRE-target walkthrough's Step 2 to compute the horizon stretch
// (SWR(30) ÷ SWR(chosen horizon)).
export const findExampleSafeRate = (
  seedBase: number,
  horizon: number,
): number => {
  const iters = runBinarySearch(seedBase, horizon);
  const last = iters[iters.length - 1];
  return last.passes ? last.mid : last.lo;
};
