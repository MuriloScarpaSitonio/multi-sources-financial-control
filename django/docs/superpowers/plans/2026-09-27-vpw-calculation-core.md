# VPW Calculation Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the already-approved monthly VPW arithmetic, historical simulation, and per-trial income minima without deciding the pending growth estimator or pension model.

**Architecture:** Keep FIRE arithmetic and random draw ordering unchanged. Export its existing prepared portfolio and seeded RNG helpers for a dedicated VPW engine. The VPW engine accepts an explicit annual growth assumption, precomputes monthly withdrawal fractions once, and uses FIRE's asset-specific history and sampling.

**Tech Stack:** TypeScript, Node built-in test runner via tsx, existing FIRE history.

**Spec:** `django/docs/specs/vpw-model-review-decisions.md` (decisions 1, 7–10, 13–15, 17).

## Global Constraints

- No edits in the original checkout or unrelated user files; worktree `/private/tmp/financial-control-vpw`.
- Keep 1,500 production trials; tests may use small deterministic fixtures.
- Withdraw before each month's return; recompute against current balance and remaining months.
- User monthly spending is always the ceiling. Do not force final-year liquidation.
- Annual income is actual annual withdrawals divided by 12. Minimum-income percentiles use each trial's minimum first, including genuine zero income and excluding synthetic chart endpoints.
- This plan does not select a historical-growth estimator or pension behavior. Those remain pending user input and gate later integration.
- No merge, push, deployment, or publishing. Retain baseline benchmark and unchanged FIRE behavior.
- Full goal still requires preference APIs, worker/UI integration, accumulation, responsiveness checks, final performance comparison, and whole-branch review; completion of this plan is not completion of the goal.

## Review Focus

- Zero and negative annual growth must produce positive finite allowances (Task 1).
- Beginning-of-month timing must yield R$651.18/month for 100k, 20 years, 5% annual growth (Task 1).
- Very short remaining durations must not liquidate a whole year's wealth immediately (Task 2).
- Minimum-income results must retain genuine zero-income years and differ from minima of annual percentile lines (Task 2).
- Different supported assets and historical blocks must affect VPW returns through the same historical inputs as FIRE (Task 2).

### Task 1: Monthly withdrawal mathematics

**Files:** Create `react/src/pages/private/Home/vpwMath.ts` and `vpwMath.test.ts`.

**Interfaces:**
- `vpwMonthlyRate(annualGrowth: number, monthsRemaining: number): number` uses growth as a decimal, returns fraction of current balance withdrawn now.
- `vpwMonthlyRates(annualGrowth: number, totalMonths: number): Float64Array` returns one rate per month, with index 0 for the full horizon.
- `vpwTarget(monthlySpending: number, annualGrowth: number, monthsRemaining: number): number` returns portfolio required to initially fund that spending.

- [x] Write assertions for zero growth (120k, 120 months => 1k/month), 5% growth (100k, 240 months => 651.18454 ±0.01), one month => entire balance, negative growth => positive smaller withdrawal, negligible growth continuous with zero, invalid horizons/growth rejected. Independently simulate monthly payments under a steady 5% return and check the target's payment remains level through all 240 months.
- [x] Run `node --import tsx --test src/pages/private/Home/vpwMath.test.ts` from `react`. Expected: failing tests before implementation.
- [x] Implement the annuity-due monthly fraction using `log1p`/`expm1` for stable near-zero math. For zero growth use `1/monthsRemaining`. Precompute once. Validate finite growth > -1 and positive integer month count; reject impossible numeric inputs instead of silently inventing allowances.
- [x] Run the same tests. Expected: all pass. Run `node --import tsx src/pages/private/Home/firePortfolio.test.ts && node --import tsx src/pages/private/Home/fireBootstrap.test.ts`. Expected: exit 0.
- [x] Record evidence; commit with the engine once both tasks pass to keep the shared worktree deliverable coherent.

### Task 2: Monthly retirement engine and historical sampling

**Files:** Create `react/src/pages/private/Home/vpwSimulation.ts` and `vpwSimulation.test.ts`; export existing `preparePortfolio` and `mulberry32` from `fireBootstrap.ts` without changing their bodies.

**Interfaces:**
- Consumes Task 1's rate schedule and FIRE `preparePortfolio(portfolio, method)` returning precomputed returns and month-index sampler.
- `runVPWRetirement(input: VPWRetirementInput): VPWRetirementResult`.
- Input: `startingBalance`, `monthlySpending`, `years`, `annualGrowth`, `portfolio: readonly PortfolioSlice[]`, `samplingMethod: SamplingMethod`, optional `numTrials` default 1500.
- Output: `withdrawalBands` (annual sums, year 0..years-1), `balanceBands` (start plus year ends, year 0..years), `minimumMonthlyIncome: {p10,p50,p90}`.
- No pension behavior in this interface yet; later integration must extend the contract after approval.

- [x] Write tests against real engine with controlled historical series restored after each test: 5% steady returns keep uncapped monthly allowance level; zero growth pays 1000/month from120k over10y; spending capped at500 retains wealth; final year receives returns on unspent balance; first-month shock changes next month's allowance; no synthetic income endpoint; per-trial minimum calculated before percentile; actual zero-income trials retained; deterministic results for repeated inputs; asset-specific SPY vs IBOV returns; both historical sampling modes; reject non-finite/negative amounts and invalid trial/horizon inputs.
- [x] Run `node --import tsx --test src/pages/private/Home/vpwSimulation.test.ts`. Expected: failing tests before implementation.
- [x] Implement monthly simulation with precomputed rates and prepared returns, fixed seed42, bounded payment `min(balance*rate, monthlySpending, balance)`, then return on remainder. Aggregate complete annual values and trial minima. Avoid exponentiation/history searches in the trial/month loop. Use existing FIRE percentile convention (sorted array index floor(n*p)).
- [x] Run both VPW test files and existing FIRE scripts. Expected: all pass. Run `node node_modules/typescript/bin/tsc -b`. Expected: exit0.
- [x] Compare representative calculation timings against immutable baseline with unchanged trial counts. Treat comparison as preliminary until complete simulation/UI integration exists.
- [x] Record task evidence and commit only these approved calculation changes. Leave the overall goal active.

### Task 3: Accumulation with prepared asset-specific histories

**Files:** Extend `react/src/pages/private/Home/vpwSimulation.ts` and `vpwSimulation.test.ts`.

**Interfaces:**
- `runVPWAccumulation(input: VPWAccumulationInput): AccumulationResult | null` consumes `startingBalance`, `monthlySavings`, `targets: readonly number[]` (target at year0 through end of actual horizon), `portfolio`, `samplingMethod`, optional `numTrials` default1500.
- Targets are supplied by the caller, keeping the pending pension/growth decisions outside this engine. No default growth estimate is selected.
- Return null when savings <=0. Otherwise use FIRE's `AccumulationResult` contract, with timing percentiles conditional on trials that reached a target and reach fraction over all trials.

- [x] Add tests: zero/negative savings yields null; 12k initial plus1k/month reaches36k in2years atzero returns; changing annual targets affects crossing; initial coverage reachesyear0; impossible target reports nulltimes and actual-length gapbands; partial reach fraction excludes failures from timingpercentiles; contribution arrives beforemonthlyreturns; repeated sampling results deterministic.
- [x] Run the VPW simulation tests. Expected: fail before function exists.
- [x] Implement once-prepared returns and targets, annual checkpoints, contribution-before-growth, and frozen post-crossing balances matching existing FIRE/VPW conventions. Validate finite inputs and nonnegative targets. Use caller-supplied targetcount as horizon; later caller caps it to min(80,remainingyears-1).
- [x] Run both VPW files, all FIRE regression tests, and TypeScript compilation. Expected: pass.
- [x] Extend benchmark mode to compare both new engines against immutable baseline, retaining explicit matched growth assumptions; distinguish this from final worker/UI and historical-estimator performance gate.

### Task 4: Shared history preference contracts, separate strategy persistence

**Files:** Modify `django/authentication/serializers.py`, `django/authentication/tests/test__user__views.py`, `react/src/pages/private/Planning/api.ts`, `react/src/pages/private/Home/firePortfolio.ts`, `react/src/pages/private/Planning/fire/FireHistoricalDrawer.tsx`, and `fireHistoricalDatasets.ts`. Create `react/src/pages/private/Planning/vpwPreferences.test.ts`.

**Interfaces:**
- `HistoricalPreferencesSerializer` contains exactly FIRE's existing sampling/proxy/exclusion/override/fallback fields and their validators. FIRE and VPW inherit it; FIRE-only fields, legacy IFIX normalization, and representation behavior remain unchanged.
- `HistoricalPlanningPreferences` exports the common history-only fields. FIRE and VPW preferences both include them. `DEFAULT_HISTORICAL_PREFERENCES` retains FIRE's existing defaults: independentmonths, SPY, VT, BTC, empty exclusions/overrides/fallbacks.
- Portfolio builders and historical controls accept `Required<HistoricalPlanningPreferences>` instead of requiring unrelated FIRE spending settings.
- VPW settings stay under `preferences.vpw`, consistent with existing per-strategy preference ownership. Reusing data must not make VPW edits silently modify FIRE. Existing return fields remain temporarily until the growth estimator is approved and integrated.

- [x] Backend RED: VPW history fields roundtrip through PATCH/GET, clearing fallbacks retains overrides, FIRE saved preferences remain unchanged, inactive strategy writes remain rejected, and invalid sampling/proxy/history keys are rejected.
- [x] Run targeted authentication tests. Expected: failures because current VPW serializer drops unknown history fields.
- [x] Extract the history-only serializer base without changing FIRE field definitions or validation. Make VPW inherit it. Run the targeted suite. Expected: pass.
- [x] Frontend RED: getVPWPlanningPreferences supplies FIRE-equivalent history defaults independently of saved FIRE choices; saved VPW choices override defaults; buildPortfolio accepts VPW history preferences and maps US/crypto/index-linked fixed income correctly.
- [x] Run the new Vitest preference suite. Expected: fail for missing defaults.
- [x] Extract shared preference type/defaults, narrow history-control types, and add defaults to VPW. Run the suite and existing FIRE regression suite plus tsc -b. Expected: pass.

### Task 5: VPW portfolio adapter

**Files:** Create `react/src/pages/private/Home/vpwPortfolio.ts` and `vpwPortfolio.test.ts`.

**Interfaces:** `buildVPWPortfolio(allocation: readonly FireAllocationBucket[], preferences: Required<VPWPlanningPreferences>)` returns `{allocation, investmentTotal, stockPct, portfolio}`. `allocation` excludes bank cash and nonpositive positions; history exclusions that model an invested category as cash remain invested assets. The actual total is never replaced by simulated wealth.

- [x] Test asset-specific US/crypto/fixed-income histories, exclusion of bank cash, preservation of within-group holdings proportions under an RV/RF override, and the existing empty-holdings 60% IBOV/40% CDI fallback. Test 0%/100% overrides when one group is absent.
- [x] Run the new Vitest suite. Expected: fail before adapter exists.
- [x] Use the existing `buildPortfolio` history resolver; scale the two groups only when an override is present. Keep original categories and series; synthesize IBOV/CDI only for absent groups, matching the previous VPW fallback.
- [x] Run adapter tests, existing FIRE portfolio tests, and TypeScript. Expected: pass.

### Task 6: VPW jobs in the existing worker

**Files:** Extend `fireSimulation.ts`, `vpwSimulation.ts`, `fireSimulation.test.ts`, `useFireSimulationWorker.test.tsx`, and `useFireSimulationWorker.ts` if stale-error protection needs correction.

**Interfaces:**
- `VPWSimulationInput` supplies shared `portfolio` and `samplingMethod`, a `retirement` input without those fields, and an `accumulation` input without those fields. The caller explicitly supplies growth and targets; this job does not select the pending estimator or pension assumptions.
- `runVPWSimulation(input)` returns `{retirement, accumulation}` from the tested engines.
- Add broader `PlanningSimulationRequest`/`PlanningSimulationResult` unions containing FIRE and VPW variants. Preserve FIRE-specific types. The existing worker invokes `runPlanningSimulation`, and the same hook has typed overloads for either strategy. No second worker protocol or copied lifecycle hook.

- [x] Test dispatch of both VPW calculations in one serializable job, distinct actual/simulated starting balances, cancellation, ignored stale successes/errors, and surfaced current-job errors.
- [x] Run the worker/dispatch suites. Expected: fail before VPW dispatch exists (and if an obsolete worker error replaces current state).
- [x] Add the VPW branch before the existing FIRE branches, leaving FIRE math untouched. Guard stale error callbacks as well as stale messages.
- [x] Run all relevant frontend and engine tests and the production build. Expected: pass.
- [x] Measure a real worker job separately from main-thread responsiveness; final page-level responsiveness still requires page integration.

### Task 7: Recoverable target-age controls

**Files:** Modify `react/src/pages/private/Home/VPWIndicator.tsx`; create `VPWIndicator.test.tsx`.

- [x] Test that a saved target age70 for a person aged80 leaves an editable target control, and raising it commits81. Typed values at/below80 must not be committed. No new age range is introduced beyond the existing70–105range.
- [x] Run the component tests. Expected: fail because the existing early return hides the control.
- [x] Reuse FIRE's number input for the target-age control in both valid and invalid full-page states. Minimum is max(70,currentAge+1); retain max105. For current ages at/above105, show the existing range limit and disable changes instead of offering an invalid selection. Compact cards retain concise status only.
- [x] Run tests and TypeScript. Expected: pass. Preserve other financial/UI behavior until the remaining integration step.

### Task 8: Correct existing accumulation messages

**Files:** Modify `VPWIndicator.tsx`, `VPWSimulationResults.tsx`, and `VPWIndicator.test.tsx`.

- [x] Add page tests for no date with zero savings while retaining the target, actual one-year accumulation horizon with0%reach, and initial coverage wording with100%target reach but no claim that retirement is safe today.
- [x] Run the component suite. Expected: these three cases fail on the existing messages.
- [x] Suppress accumulation when savings<=0, retain returned successRate and horizon, show target-reach percentage, use the actual horizon in unreached text, and describe current coverage as initial withdrawal coverage. Do not change unresolved financial assumptions.
- [x] Run page tests, the full relevant frontend suite, and production build. Expected: pass.

## Approved follow-up: FIRE-format VPW corrections

Latest explicit user approval supersedes the earlier manual allocation-control plan. Implemented in the main worktree without commits:

- [x] Extra accumulation after target crossing, persisted 0–60 years with zero default; trial-specific starting balances; fixed end age and calendar-age conditional bands.
- [x] Remove allocation/cash sentence and RV field; ignore legacy saved RV allocation values.
- [x] Replace custom coverage banner with FIRE's actual metric-card component and income results.
- [x] Engine/scenario regressions observed failing before implementation; existing API extra-year RED tests now pass; UI persistence and manual recalculation pass.
- [x] Final fresh focused review: one Important timing-guard finding, reproduced RED and fixed; no deferred findings. Main-worktree/uncommitted owner instructions override skill commits and isolated-worktree steps.
- [x] Final updated full-suite and performance evidence recorded in completion audit. All nine matched cases passed the no-slowdown gate; extra-years and worker measurements recorded separately.

Browser QA remains unverified because Chrome access was denied earlier; do not substitute source delivery or jsdom for browser evidence.
