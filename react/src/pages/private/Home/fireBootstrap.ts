import {
  EQUITY_REAL_RETURNS,
  FIRE_RETURNS_YEARS,
  FIXED_INCOME_REAL_RETURNS,
  IFIX_REAL_RETURNS,
  IFIX_YEARS,
} from "./fireReturns";

export type AllocationWeights = {
  equity: number;
  ifix: number;
  fixedIncome: number;
};

export type WeightsAtFn = (yearIndex: number) => AllocationWeights;

export type BootstrapBand = {
  year: number;
  p10: number;
  p50: number;
  p90: number;
};

export type BootstrapResult = {
  successRate: number;
  bands: BootstrapBand[];
  // Per-year withdrawal percentile bands. Year y (1..horizon) holds the
  // percentile of `min(annualWithdrawal, balance_at_year_y_start)` across
  // trials — i.e., what each retiree actually spent that year. Stays flat at
  // `annualWithdrawal` while solvent, drops to 0 once a trial depletes.
  // Length = horizon (year 1..horizon, no entry for year 0 since no
  // withdrawal happens before year 1 of retirement).
  withdrawalBands: BootstrapBand[];
  medianDepletionYear: number | null;
  p10DepletionYear: number | null;
};

// Mulberry32 PRNG — fast, seedable. Used so the same inputs produce the same
// success rate / percentiles across page reloads (instead of jittering with
// Math.random's per-mount entropy).
const mulberry32 = (seed: number) => () => {
  let t = (seed = (seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FIXED_SEED = 42;

// IFIX return for each year in FIRE_RETURNS_YEARS, or null when the IFIX
// series doesn't cover that year (years before 2011). Built once at module
// load so the bootstrap inner loop only does index math.
const IFIX_BY_FIRE_INDEX: readonly (number | null)[] = FIRE_RETURNS_YEARS.map(
  (year) => {
    const ifixIdx = IFIX_YEARS.indexOf(year);
    return ifixIdx === -1 ? null : IFIX_REAL_RETURNS[ifixIdx];
  },
);

const ALL_FIRE_YEAR_INDICES: readonly number[] = FIRE_RETURNS_YEARS.map(
  (_, i) => i,
);
const IFIX_AVAILABLE_FIRE_INDICES: readonly number[] = ALL_FIRE_YEAR_INDICES
  .filter((i) => IFIX_BY_FIRE_INDEX[i] !== null);

// Materiality threshold for forcing the IFIX-aligned (2011–2025) sample
// window. A user holding even a single share of any FII produces a tiny
// nonzero `weights.ifix` (e.g. R$1k of FII in a R$1M portfolio → 0.001).
// Strict `> 0` would drop the user from the full 1995-onwards sample to the
// shorter IFIX-aligned sample for that. Above the threshold we accept that the
// user has material IFIX exposure and the 2011-onwards sample is the honest one
// to use.
//
// 0.005 (0.5%) is the chosen default: below it the FII line item barely
// shows up on the user's allocation pie chart, so the cost of pretending
// they don't hold it (for sample-window purposes) is much smaller than the
// cost of pretending they hold material IFIX.
export const MIN_WEIGHT_FOR_RETURN_SERIES = 0.005;

// Indices into FIRE_RETURNS_YEARS available for sampling under given weights.
// Material IFIX exposure (≥ MIN_WEIGHT_FOR_RETURN_SERIES) restricts the
// sample to IFIX-available years (2011–2025); below threshold we use the
// full IBOV/CDI/IPCA range (1995–2025), keeping the larger sample for users whose
// IFIX exposure is dust or zero.
const availableYearIndices = (w: AllocationWeights): readonly number[] =>
  w.ifix >= MIN_WEIGHT_FOR_RETURN_SERIES
    ? IFIX_AVAILABLE_FIRE_INDICES
    : ALL_FIRE_YEAR_INDICES;

// True if the IFIX-restricted sample window applies to the given weights.
// Used by indicator UI to disclose when SWR / drawdown numbers are based on
// the shorter 2011–2025 sample so users don't compare them to long-history
// Trinity-style numbers.
export const isIfixRestrictedSample = (w: AllocationWeights): boolean =>
  w.ifix >= MIN_WEIGHT_FOR_RETURN_SERIES;

// Time-varying-weights variant: returns true if *any* simulated year along
// `weightsAt` over `[0, horizon)` triggers the IFIX-restricted sample. Used
// by age-in-bonds-style indicators where the user's current allocation can
// understate (or overstate) the simulated IFIX exposure — e.g. a user with
// 0.4% IFIX today but a high IFIX:equity ratio sees the glide drive
// `weights.ifix` above threshold during the stock-heavy years of retirement.
// In that case the simulation actually uses the 2011–2025 window even
// though `isIfixRestrictedSample(staticWeights)` is false, and the
// disclosure should fire.
export const isIfixRestrictedSampleForVaryingWeights = (
  weightsAt: WeightsAtFn,
  horizon: number,
): boolean => {
  for (let y = 0; y < horizon; y++) {
    if (isIfixRestrictedSample(weightsAt(y))) return true;
  }
  return false;
};

// Draw one calendar-year-aligned blended return: pick a historical year
// uniformly from `availableIndices` and combine that year's per-asset returns
// with the weights. All asset classes draw from the same calendar year, so
// cross-asset correlation (e.g. 2008's correlated stress across equity, IFIX,
// fixed income) is preserved — unlike independent per-asset sampling, which
// would pair 2008 equity with random other years' bonds. Year-to-year
// autocorrelation is still dropped (size-1 blocks); see the skill's
// "Methodology limits" section.
const drawAlignedYearReturn = (
  w: AllocationWeights,
  availableIndices: readonly number[],
  rng: () => number,
): number => {
  const idx = availableIndices[Math.floor(rng() * availableIndices.length)];
  // ifixR is non-null whenever w.ifix > 0 (availableIndices is restricted to
  // IFIX-available years in that case). When w.ifix === 0 the term is killed
  // by multiplication; `?? 0` is defensive against floating-point edge cases.
  const ifixR = IFIX_BY_FIRE_INDEX[idx];
  return (
    w.equity * EQUITY_REAL_RETURNS[idx] +
    w.ifix * (ifixR ?? 0) +
    w.fixedIncome * FIXED_INCOME_REAL_RETURNS[idx]
  );
};

type Trial = {
  depletionYear: number | null;
  balances: number[];
  withdrawals: number[]; // length horizon — actual amount withdrawn each year
};

const runTrial = (
  startingBalance: number,
  annualWithdrawal: number,
  horizon: number,
  weights: AllocationWeights,
  availableIndices: readonly number[],
  rng: () => number,
): Trial => {
  const balances = [startingBalance];
  const withdrawals: number[] = [];
  let balance = startingBalance;
  let depletionYear: number | null = null;
  for (let y = 1; y <= horizon; y++) {
    if (balance <= 0) {
      balances.push(0);
      withdrawals.push(0);
      continue;
    }
    const grown =
      balance * (1 + drawAlignedYearReturn(weights, availableIndices, rng));
    const actualWithdrawal = Math.min(annualWithdrawal, Math.max(0, grown));
    balance = grown - actualWithdrawal;
    if (balance <= 0 && depletionYear === null) {
      depletionYear = y;
      balance = 0;
    }
    balances.push(balance);
    withdrawals.push(actualWithdrawal);
  }
  return { depletionYear, balances, withdrawals };
};

export const runBootstrap = (
  startingBalance: number,
  annualWithdrawal: number,
  horizon: number,
  weights: AllocationWeights,
  numTrials = 2000,
): BootstrapResult => {
  if (annualWithdrawal <= 0 || startingBalance <= 0 || horizon <= 0) {
    return {
      successRate: annualWithdrawal <= 0 ? 1 : 0,
      bands: [],
      withdrawalBands: [],
      medianDepletionYear: null,
      p10DepletionYear: null,
    };
  }

  const rng = mulberry32(FIXED_SEED);
  const availableIndices = availableYearIndices(weights);
  const trials = Array.from({ length: numTrials }, () =>
    runTrial(
      startingBalance,
      annualWithdrawal,
      horizon,
      weights,
      availableIndices,
      rng,
    ),
  );
  const successRate =
    trials.filter((t) => t.depletionYear === null).length / numTrials;

  const bands: BootstrapBand[] = [];
  for (let y = 0; y <= horizon; y++) {
    const sorted = trials.map((t) => t.balances[y]).sort((a, b) => a - b);
    bands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  const withdrawalBands: BootstrapBand[] = [];
  for (let y = 1; y <= horizon; y++) {
    const sorted = trials.map((t) => t.withdrawals[y - 1]).sort((a, b) => a - b);
    withdrawalBands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  // Compute depletion percentiles over ALL trials (success = +∞), so
  // `medianDepletionYear` and `p10DepletionYear` share the same denominator.
  // Without this, you get incoherent pairs like "median 56 / p10 nunca"
  // because median was over failed trials only and p10 over all trials.
  const sortedDepletion = trials
    .map((t) => t.depletionYear ?? Infinity)
    .sort((a, b) => a - b);
  const p10Raw = sortedDepletion[Math.floor(numTrials * 0.1)];
  const p50Raw = sortedDepletion[Math.floor(numTrials * 0.5)];
  const medianDepletionYear = p50Raw === Infinity ? null : p50Raw;
  const p10DepletionYear = p10Raw === Infinity ? null : p10Raw;

  return {
    successRate,
    bands,
    withdrawalBands,
    medianDepletionYear,
    p10DepletionYear,
  };
};

export const computeWeights = (
  equityTotal: number,
  ifixTotal: number,
  fixedIncomeTotal: number,
): AllocationWeights => {
  const total = equityTotal + ifixTotal + fixedIncomeTotal;
  if (total <= 0) return { equity: 0, ifix: 0, fixedIncome: 1 };
  return {
    equity: equityTotal / total,
    ifix: ifixTotal / total,
    fixedIncome: fixedIncomeTotal / total,
  };
};

// Binary-search the highest withdrawal rate (as %) where bootstrap success rate
// meets `targetSuccess` at the given horizon and allocation. Result is the
// horizon- and allocation-adjusted SWR. Used to compute the FIRE target so the
// progress bar reflects an honest "FIRE'd?" answer at any horizon, instead of
// being decoupled from sequence-of-returns risk.
export const findSafeWithdrawalRate = (
  horizon: number,
  weights: AllocationWeights,
  targetSuccess: number = 0.9,
  numTrials: number = 1000,
): number => {
  if (horizon <= 0) return 0;
  // Bootstrap success is scale-invariant: doubling both balance and withdrawal
  // produces an identical trajectory year-by-year, so success rate depends only
  // on the rate (their ratio), not the absolute amounts. Any positive value
  // works here — 1M is just a convenient placeholder; the user's actual
  // patrimony is irrelevant to "what's the safe withdrawal rate?".
  const dummyPatrimony = 1_000_000;
  let lo = 0.005;
  let hi = 0.1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const result = runBootstrap(
      dummyPatrimony,
      dummyPatrimony * mid,
      horizon,
      weights,
      numTrials,
    );
    if (result.successRate >= targetSuccess) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo * 100;
};

// Time-varying-weights variant. The simulated portfolio rebalances each year
// to weights returned by `weightsAt(yearIndex)`. Used by strategies whose
// allocation is intrinsic to the strategy itself (e.g. age-in-bonds: bond% =
// currentAge + yearIndex). For static weights use `runBootstrap`.
const runTrialVaryingWeights = (
  startingBalance: number,
  annualWithdrawal: number,
  horizon: number,
  weightsByYear: readonly AllocationWeights[],
  availableByYear: readonly (readonly number[])[],
  rng: () => number,
): Trial => {
  const balances = [startingBalance];
  const withdrawals: number[] = [];
  let balance = startingBalance;
  let depletionYear: number | null = null;
  for (let y = 1; y <= horizon; y++) {
    if (balance <= 0) {
      balances.push(0);
      withdrawals.push(0);
      continue;
    }
    // index y-1 = weights applied during the year that ends at index y
    const grown =
      balance *
      (1 +
        drawAlignedYearReturn(
          weightsByYear[y - 1],
          availableByYear[y - 1],
          rng,
        ));
    const actualWithdrawal = Math.min(annualWithdrawal, Math.max(0, grown));
    balance = grown - actualWithdrawal;
    if (balance <= 0 && depletionYear === null) {
      depletionYear = y;
      balance = 0;
    }
    balances.push(balance);
    withdrawals.push(actualWithdrawal);
  }
  return { depletionYear, balances, withdrawals };
};

export const runBootstrapWithVaryingWeights = (
  startingBalance: number,
  annualWithdrawal: number,
  horizon: number,
  weightsAt: WeightsAtFn,
  numTrials = 2000,
): BootstrapResult => {
  if (annualWithdrawal <= 0 || startingBalance <= 0 || horizon <= 0) {
    return {
      successRate: annualWithdrawal <= 0 ? 1 : 0,
      bands: [],
      withdrawalBands: [],
      medianDepletionYear: null,
      p10DepletionYear: null,
    };
  }

  const rng = mulberry32(FIXED_SEED);
  // Materialize weights and per-year available-year indices once. `weightsAt`
  // is deterministic, so this is a strict win — the inner loop avoids both
  // the function call and the `availableYearIndices` rebuild per trial-year.
  const weightsByYear: AllocationWeights[] = Array.from(
    { length: horizon },
    (_, i) => weightsAt(i),
  );
  const availableByYear: (readonly number[])[] = weightsByYear.map(
    availableYearIndices,
  );
  const trials = Array.from({ length: numTrials }, () =>
    runTrialVaryingWeights(
      startingBalance,
      annualWithdrawal,
      horizon,
      weightsByYear,
      availableByYear,
      rng,
    ),
  );
  const successRate =
    trials.filter((t) => t.depletionYear === null).length / numTrials;

  const bands: BootstrapBand[] = [];
  for (let y = 0; y <= horizon; y++) {
    const sorted = trials.map((t) => t.balances[y]).sort((a, b) => a - b);
    bands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  const withdrawalBands: BootstrapBand[] = [];
  for (let y = 1; y <= horizon; y++) {
    const sorted = trials.map((t) => t.withdrawals[y - 1]).sort((a, b) => a - b);
    withdrawalBands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  // Compute depletion percentiles over ALL trials (success = +∞), so
  // `medianDepletionYear` and `p10DepletionYear` share the same denominator.
  // Without this, you get incoherent pairs like "median 56 / p10 nunca"
  // because median was over failed trials only and p10 over all trials.
  const sortedDepletion = trials
    .map((t) => t.depletionYear ?? Infinity)
    .sort((a, b) => a - b);
  const p10Raw = sortedDepletion[Math.floor(numTrials * 0.1)];
  const p50Raw = sortedDepletion[Math.floor(numTrials * 0.5)];
  const medianDepletionYear = p50Raw === Infinity ? null : p50Raw;
  const p10DepletionYear = p10Raw === Infinity ? null : p10Raw;

  return {
    successRate,
    bands,
    withdrawalBands,
    medianDepletionYear,
    p10DepletionYear,
  };
};

// Same idea as `findSafeWithdrawalRate`, but evaluating a trajectory of
// allocations rather than one fixed weights vector. The "safe rate" returned
// is contingent on the *full* glide path traced by `weightsAt` over `horizon`
// — changing the trajectory (e.g. starting age, glide-path slope) changes the
// safe rate even at the same nominal horizon.
export const findSafeWithdrawalRateWithVaryingWeights = (
  horizon: number,
  weightsAt: WeightsAtFn,
  targetSuccess: number = 0.9,
  numTrials: number = 1000,
): number => {
  if (horizon <= 0) return 0;
  const dummyPatrimony = 1_000_000;
  let lo = 0.005;
  let hi = 0.1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const result = runBootstrapWithVaryingWeights(
      dummyPatrimony,
      dummyPatrimony * mid,
      horizon,
      weightsAt,
      numTrials,
    );
    if (result.successRate >= targetSuccess) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo * 100;
};

// Per-year, balance-dependent withdrawal callback.
// `yearIndex` runs from 0 to horizon-1; `currentBalance` is the start-of-year
// balance. Return the nominal withdrawal amount in currency units.
export type WithdrawalAtFn = (yearIndex: number, currentBalance: number) => number;

// Bands for strategies whose withdrawal is a function of the current balance.
// Result shape differs from `BootstrapResult` on purpose: there's no
// `successRate` or depletion year, because withdrawals are bounded by the
// current balance and so cannot deplete the portfolio in nominal terms.
//
// Indexing convention:
// - `withdrawalBands[i].year === i` is the withdrawal taken in year `i`
//   (0 ≤ i < horizon). Length is `horizon`.
// - `balanceBands[i].year === i` is the balance at the start of year `i`;
//   `balanceBands[0]` is the starting balance and `balanceBands[horizon]`
//   is the final balance after the last withdrawal and growth. Length is
//   `horizon + 1`.
export type VaryingWithdrawalResult = {
  withdrawalBands: BootstrapBand[];
  balanceBands: BootstrapBand[];
};

type VaryingWithdrawalTrial = {
  withdrawals: number[]; // length horizon
  balances: number[];    // length horizon + 1 (start of each year + final)
};

const runTrialVaryingWithdrawal = (
  startingBalance: number,
  weights: AllocationWeights,
  availableIndices: readonly number[],
  horizon: number,
  withdrawalAt: WithdrawalAtFn,
  rng: () => number,
): VaryingWithdrawalTrial => {
  const balances: number[] = [startingBalance];
  const withdrawals: number[] = [];
  let balance = startingBalance;
  for (let y = 0; y < horizon; y++) {
    if (balance <= 0) {
      withdrawals.push(0);
      balances.push(0);
      continue;
    }
    const w = Math.max(0, Math.min(withdrawalAt(y, balance), balance));
    // Withdraw before growth (start-of-year): VPW computes the rate against the
    // pre-return balance via PMT, so the cash must come out before that year's
    // return is realized. This differs from `runTrial`'s grow-then-withdraw.
    balance =
      (balance - w) *
      (1 + drawAlignedYearReturn(weights, availableIndices, rng));
    if (balance < 0) balance = 0;
    withdrawals.push(w);
    balances.push(balance);
  }
  return { withdrawals, balances };
};

// Bootstrap variant for strategies whose withdrawal recomputes each year as a
// function of the current balance (e.g. VPW: balance × pmt(realReturn, yearsLeft)).
// Returns percentile bands for both the withdrawal stream and the balance path.
// Static `weights` drive return draws; the schedule itself comes from the
// withdrawal callback.
export const runBootstrapWithVaryingWithdrawal = (
  startingBalance: number,
  weights: AllocationWeights,
  horizon: number,
  withdrawalAt: WithdrawalAtFn,
  numTrials = 2000,
): VaryingWithdrawalResult => {
  if (startingBalance <= 0 || horizon <= 0) {
    return { withdrawalBands: [], balanceBands: [] };
  }

  const rng = mulberry32(FIXED_SEED);
  const availableIndices = availableYearIndices(weights);
  const trials = Array.from({ length: numTrials }, () =>
    runTrialVaryingWithdrawal(
      startingBalance,
      weights,
      availableIndices,
      horizon,
      withdrawalAt,
      rng,
    ),
  );

  const withdrawalBands: BootstrapBand[] = [];
  for (let y = 0; y < horizon; y++) {
    const sorted = trials.map((t) => t.withdrawals[y]).sort((a, b) => a - b);
    withdrawalBands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  const balanceBands: BootstrapBand[] = [];
  for (let y = 0; y <= horizon; y++) {
    const sorted = trials.map((t) => t.balances[y]).sort((a, b) => a - b);
    balanceBands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  return { withdrawalBands, balanceBands };
};

// Forward-running variant: accumulation phase. Starting from `startingBalance`,
// add `annualContribution` each year, sample one historical real return at the
// portfolio's `weights`, and stop when the running balance crosses `target`.
// Used for the "how many years until I reach my FIRE target?" forecast on the
// FIRE / Idade-em-RF indicators.
//
// Percentile semantics are inverted relative to the depletion variants:
// - p10 years to target = best decile (reached fastest)
// - p50 = median
// - p90 = worst decile (reached slowest)
//
// `successRate` is the fraction of trials that crossed the target within
// `maxYears`. Trials that never reach are excluded from the percentile stats
// so the median doesn't get pinned to the cap; their absence is signaled
// through `successRate < 1`.
export type AccumulationParams = {
  startingBalance: number;
  annualContribution: number;
  target: number;
  weights: AllocationWeights;
  maxYears?: number;
  numTrials?: number;
};

export type AccumulationResult = {
  successRate: number;
  medianYearsToTarget: number | null;
  p10YearsToTarget: number | null; // best case (faster)
  p90YearsToTarget: number | null; // worst case (slower)
  // Gap-to-target percentile bands. `gap = max(0, target − balance)` per trial
  // per year, sorted across trials. Length = maxYears + 1. Past a trial's
  // crossing year its gap is 0 forever, so the p10/p50/p90 bands all converge
  // to 0 by `p90YearsToTarget` and stay there. The drawdown side of the FIRE
  // story is rendered by a separate `runBootstrap` call, not by this result.
  gapBands: BootstrapBand[];
};

const runAccumulationTrial = (
  starting: number,
  contribution: number,
  target: number,
  weights: AllocationWeights,
  availableIndices: readonly number[],
  maxYears: number,
  rng: () => number,
): { yearReached: number | null; balances: number[] } => {
  const balances = [starting];
  let balance = starting;
  let yearReached: number | null = balance >= target ? 0 : null;
  for (let y = 1; y <= maxYears; y++) {
    if (yearReached !== null) {
      // Crossed already — accumulation phase is done. Pin balance at target
      // so gap = max(0, target − balance) = 0 from this year onwards. The
      // post-crossing trajectory is no longer the responsibility of this
      // bootstrap; the consuming chart pairs it with a separate drawdown
      // simulation seeded at fireTarget.
      balances.push(target);
      continue;
    }
    balance =
      (balance + contribution) *
      (1 + drawAlignedYearReturn(weights, availableIndices, rng));
    if (balance >= target) yearReached = y;
    balances.push(balance);
  }
  return { yearReached, balances };
};

export const runAccumulationBootstrap = (
  params: AccumulationParams,
): AccumulationResult => {
  const numTrials = params.numTrials ?? 2000;
  const maxYears = params.maxYears ?? 60;
  const empty: AccumulationResult = {
    successRate: 0,
    medianYearsToTarget: null,
    p10YearsToTarget: null,
    p90YearsToTarget: null,
    gapBands: [],
  };
  if (params.target <= 0 || params.startingBalance < 0) {
    return empty;
  }

  const rng = mulberry32(FIXED_SEED);
  const availableIndices = availableYearIndices(params.weights);
  const trials = Array.from({ length: numTrials }, () =>
    runAccumulationTrial(
      params.startingBalance,
      params.annualContribution,
      params.target,
      params.weights,
      availableIndices,
      maxYears,
      rng,
    ),
  );

  // Gap bands: at each year y, sort `max(0, target − balance)` across trials.
  // Smaller gap = better (closer to target), so p10 = best decile, p90 = worst.
  const gapBands: BootstrapBand[] = [];
  for (let y = 0; y <= maxYears; y++) {
    const sorted = trials
      .map((t) => Math.max(0, params.target - t.balances[y]))
      .sort((a, b) => a - b);
    gapBands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  const reached = trials
    .map((t) => t.yearReached)
    .filter((y): y is number => y !== null);
  const successRate = reached.length / numTrials;
  if (reached.length === 0) {
    return { ...empty, gapBands };
  }

  const sorted = [...reached].sort((a, b) => a - b);
  return {
    successRate,
    medianYearsToTarget: sorted[Math.floor(sorted.length / 2)],
    p10YearsToTarget: sorted[Math.floor(sorted.length * 0.1)],
    p90YearsToTarget: sorted[Math.floor(sorted.length * 0.9)],
    gapBands,
  };
};

// Variant of the accumulation bootstrap where the target is year-dependent
// (e.g. VPW: target shrinks each year as remaining horizon shortens). Same
// trial mechanics as `runAccumulationBootstrap` (contribution-then-growth,
// freeze post-crossing). Difference: per-year gap is computed against
// `targetAt(y)` rather than a fixed `target`.
export type VaryingAccumulationParams = {
  startingBalance: number;
  annualContribution: number;
  targetAt: (year: number) => number;
  weights: AllocationWeights;
  maxYears?: number;
  numTrials?: number;
};

const runVaryingAccumulationTrial = (
  starting: number,
  contribution: number,
  targetAt: (year: number) => number,
  weights: AllocationWeights,
  availableIndices: readonly number[],
  maxYears: number,
  rng: () => number,
): { yearReached: number | null; balances: number[] } => {
  const balances = [starting];
  let balance = starting;
  let yearReached: number | null = balance >= targetAt(0) ? 0 : null;
  for (let y = 1; y <= maxYears; y++) {
    if (yearReached !== null) {
      balances.push(balance);
      continue;
    }
    balance =
      (balance + contribution) *
      (1 + drawAlignedYearReturn(weights, availableIndices, rng));
    if (balance >= targetAt(y)) yearReached = y;
    balances.push(balance);
  }
  return { yearReached, balances };
};

export const runAccumulationBootstrapVarying = (
  params: VaryingAccumulationParams,
): AccumulationResult => {
  const numTrials = params.numTrials ?? 2000;
  const maxYears = params.maxYears ?? 60;
  const empty: AccumulationResult = {
    successRate: 0,
    medianYearsToTarget: null,
    p10YearsToTarget: null,
    p90YearsToTarget: null,
    gapBands: [],
  };
  if (params.startingBalance < 0) return empty;

  const rng = mulberry32(FIXED_SEED);
  const availableIndices = availableYearIndices(params.weights);
  const trials = Array.from({ length: numTrials }, () =>
    runVaryingAccumulationTrial(
      params.startingBalance,
      params.annualContribution,
      params.targetAt,
      params.weights,
      availableIndices,
      maxYears,
      rng,
    ),
  );

  const gapBands: BootstrapBand[] = [];
  for (let y = 0; y <= maxYears; y++) {
    const target = params.targetAt(y);
    const sorted = trials
      .map((t) => Math.max(0, target - t.balances[y]))
      .sort((a, b) => a - b);
    gapBands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  const reached = trials
    .map((t) => t.yearReached)
    .filter((y): y is number => y !== null);
  const successRate = reached.length / numTrials;
  if (reached.length === 0) {
    return { ...empty, gapBands };
  }

  const sorted = [...reached].sort((a, b) => a - b);
  return {
    successRate,
    medianYearsToTarget: sorted[Math.floor(sorted.length / 2)],
    p10YearsToTarget: sorted[Math.floor(sorted.length * 0.1)],
    p90YearsToTarget: sorted[Math.floor(sorted.length * 0.9)],
    gapBands,
  };
};
