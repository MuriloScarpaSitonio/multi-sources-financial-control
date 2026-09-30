---
name: fire-bootstrap-methodology
description: Use when changing or explaining FIRE simulations, historical proxies and complements, accumulation and retirement timing, age-in-bonds allocation, safe withdrawal rates, or result semantics in the Planning module.
---

# FIRE bootstrap methodology

Checked against the implementation on 2026-09-22. Paths below are relative to the repository root. This documents current behavior, including distinctions between calculation paths; it does not authorize financial-methodology changes.

## Start with the relevant source

- Allocation and fixed-income classification: `django/variable_income_assets/services/fire_allocation.py`.
- Historical series construction and providers: `django/variable_income_assets/fire_returns/series.py` and `sources.py`; generated data: `react/src/pages/private/Home/fireReturns.ts`.
- Proxy selection, historical intersections and age-in-bonds composition: `react/src/pages/private/Home/firePortfolio.ts`.
- Sampling, retirement, accumulation and safe-rate kernels: `react/src/pages/private/Home/fireBootstrap.ts`.
- Simulation orchestration and age-in-bonds solver: `react/src/pages/private/Home/fireSimulation.ts`.
- Actual versus simulated wealth and summary semantics: `react/src/pages/private/Home/fireResultPresentation.ts`.
- Submitted scenarios and comparison: `react/src/pages/private/Planning/fire/fireStudioScenario.ts` and `FireSimulationStudio.tsx`.
- Worker lifecycle: `react/src/pages/private/Home/useFireSimulationWorker.ts` and `fireSimulation.worker.ts`.
- Saved preferences: `react/src/pages/private/Planning/api.ts` and the FIRE preferences serializer in `django/authentication/serializers.py`.

Before changing a result, trace its submitted input, kernel and presentation. When code and this reference differ, establish the current behavior from executable code and tests, report the discrepancy, and update this reference with the authorized change. Older comments inside the kernels can still describe annual or three-bucket behavior.

## Portfolio and historical returns

FIRE uses weighted `PortfolioSlice` entries, not the legacy equity/IFIX/CDI triplet. Positive allocation totals determine weights. Backend buckets retain the affected assets and their current normalized values.

| Holding classification | Default historical mapping |
|---|---|
| Brazilian equities | IBOV |
| US equities | SPY or VTI preference |
| Global equities | VT or VWRL preference |
| FII | IFIX |
| Crypto | BTC or CMBI10 preference |
| CDI fixed income | CDI |
| Selic fixed income | IMA-S |
| Prefixed fixed income | IRF-M 1 through one year remaining; IRF-M 1+ beyond |
| IPCA fixed income | IMA-B 5 through five years remaining; IMA-B 5+ beyond |
| Bank money | CASH |

Maturity thresholds use calendar anniversaries relative to the allocation date. They select market-return proxies; they do not simulate each bond's contractual yield, coupons or redemption. Bucket classification is a snapshot, not automatic monthly migration between maturity buckets during a trial.

Historical returns are monthly and real in BRL. Foreign series include currency conversion before IPCA deflation. Consult the provider implementation for the exact source instrument: a product-facing name is not necessarily its downloaded ticker. Series ranges and availability come from the generated data, not hardcoded dates in this skill.

`real = (1 + nominal BRL return) / (1 + monthly IPCA) - 1`.

**CASH means zero nominal yield:** its real return is `1 / (1 + IPCA) - 1`. It is neither CDI nor zero real return. It does not constrain the shared historical sample. The UI calls this money “Dinheiro”.

Explicit per-bucket primary overrides take precedence over defaults. `buildPortfolio` also retains compatibility with excluded-category preferences: absent an explicit override, an excluded category maps to CASH without reallocating its weight to other assets. Keep asset category separate from selected historical series.

## Historical complements and the available period

A slice can have one primary series and one earlier fallback. The fallback supplies only months strictly before the primary's first month. The primary owns its first month onward; a fallback does not fill later holes or extend the primary's end date.

The eligible sample is the intersection of the month keys available to every constraining slice. All positive included FIRE slices matter: the legacy 0.5% materiality threshold does not apply to this portfolio API.

A complement may extend one bucket's history without extending the portfolio's usable period because another bucket still limits the intersection. Coverage percentages must use the actual shared eligible months. Zero complement usage is possible even with a valid saved fallback. Gaps remain gaps.

The configuration UI restricts primary choices to the selected subgroup. Earlier complements may represent a different asset type; eligibility requires usable earlier history. This is an explicit modeling substitution, not reconstructed returns of the original asset. Do not describe a longer sample as inherently more accurate.

“Comparar sem complemento” derives a second request by removing fallbacks from the same submitted snapshot. Preserve all other inputs. A changed sample changes the scenarios drawn, so it is a sensitivity comparison rather than a paired causal experiment on identical historical paths.

## Sampling and retirement cash flow

Supported sampling modes:

- `independent_months` (default): draw eligible months independently with replacement.
- `contiguous_12_month_blocks`: draw starts of complete, calendar-contiguous 12-month blocks, concatenate sampled blocks, and truncate to the requested length. Starts need not be January. Blocks cannot bridge missing months or wrap around the dataset. An unavailable full block produces an error rather than silently changing methods.

Within each simulated month, all slices use the same historical calendar month, including the appropriate primary or fallback source. This preserves observed cross-asset alignment. Block mode additionally preserves ordering inside each block, not between independently drawn blocks.

The portfolio return is the weighted sum of slice returns. Static weights remain constant; age-in-bonds weights change by simulation year. This implies rebalancing to the modeled weights, without transaction costs.

Retirement simulates `horizon × 12` months:

1. Grow balance by the sampled real monthly return.
2. Withdraw `min(annualExpenses / 12, max(0, grownBalance))`.
3. Record depletion when balance reaches zero; remaining balances and withdrawals stay zero.

Contributions stop when retirement begins. The horizon counts retirement years, not accumulation plus retirement. Annual chart balances are year-end observations; withdrawal bands aggregate the actual monthly withdrawals within each year.

Retirement success is the fraction never depleted within the horizon. Balance and withdrawal bands are pointwise p10/p50/p90 across trials, not three continuous representative paths. Depletion percentiles include successful trials as infinity; a percentile at infinity is returned as `null`.

## Withdrawal rate and FIRE target

Lifestyle retirement uses expenses as the withdrawal amount. The chosen withdrawal rate separately drives the target and the rate-test bootstrap; it does not replace expenses in the lifestyle calculation.

Safe-rate search uses 1,000 trials per candidate, 20 binary-search iterations, a 90% survival threshold, and a search interval of 0.5%–10% annually. It returns the lower bound as a percentage. The bounds are numerical limits, not proof that the returned rate meets the threshold in every edge case. Ordinary retirement and accumulation kernels default to 2,000 trials.

For the same portfolio, sampling mode and appropriate allocation path:

```text
safeRate = safe-rate search at selected horizon
baselineSafeRate = safe-rate search at 30 years
horizonFactor = max(1, baselineSafeRate / safeRate)
targetMultiplier = (100 / chosenRate) × horizonFactor
fireTarget = annualExpenses × targetMultiplier
```

The implementation uses factor 1 when either safe rate is nonpositive and multiplier 0 when the chosen rate is nonpositive. Preserve these guards. The clamp prevents a short horizon from lowering the target below the chosen-rate cash-flow floor.

The rate test starts with R$1,000,000 and withdraws that amount times the chosen rate annually, split monthly. It answers a scale-invariant rate question. Lifestyle survival answers whether the scenario's wealth sustains its expenses. Neither probability is the wealth-to-target percentage.

## Actual wealth, simulated wealth and accumulation

A patrimony override is scenario wealth available at the start, not money added at a future retirement date. Keep these current distinctions explicit:

- Static lifestyle retirement uses `simulatedPatrimony ?? actualPatrimony`.
- The static ordinary accumulation forecast starts from actual patrimony, as defined by `buildFirePatrimonyInputs`.
- Static extended accumulation starts from scenario patrimony.
- Age-in-bonds receives effective scenario patrimony for its accumulation and lifestyle paths.

Ordinary accumulation adds `annualContribution / 12` before each month's return. It checks the target at year end (or at time zero if already reached). Defaults are 2,000 trials and a 60-year target-search window. After first reaching the target, the forecast pins subsequent target gaps to zero; it is not a continued wealth projection.

Time-to-target percentiles include only trials that reach the target; `successRate` reports their fraction separately. For time and gap, p10 is favorable and p90 unfavorable, the reverse of wealth-band interpretation.

Extra accumulation is an integer number of years after first reaching the target, supported from 1 through 60; zero keeps the ordinary calculation path. Contributions and monthly returns continue during those extra years. A subsequent fall below target does not restart the clock. Each qualifying trial starts retirement from its own resulting wealth. The retirement horizon then begins, without contributions.

Extended retirement statistics are conditional on reaching retirement. Report `retirementStartRate` and `retirementTrialCount` separately; do not call conditional survival the success probability of every original accumulation trial. `medianStartingBalance` is a presentation reference, not a single balance used to simulate all retirees. For age-in-bonds, each extended trial's retirement allocation starts at its own elapsed retirement age.

## Age-in-bonds solver

Cash category weights remain unchanged. The invested share is split into variable and fixed income with bond fraction `min(age, 100) / 100`; relative weights within each group are retained. If a group is absent, synthetic defaults are IBOV for variable income and IMA_GERAL_EX_C for fixed income. Proxy overrides do not change the asset's group.

Accumulation retains the current portfolio. Retirement uses annual age-dependent weights. Retirement age affects safe rates and target size, while target size affects time to retirement, so `solveAgeInBondsFireState` resolves them together.

The solver makes at most five passes. It stops on consecutive equal median target times, repeated medians (cycle), or target change below 1% after sufficient passes. Cycle and iteration-limit exits choose the largest visited target, breaking ties by longer median accumulation. An unreachable target returns `drawdownAtTarget: null`. The next age anchor includes current age, median years to target, and extra accumulation years.

Keep safe rates, target, accumulation, rate test and target drawdown tied to the selected solver pass. Use its `anchorAge` for its target preview rather than reconstructing a different anchor. Extended accumulation replaces the target drawdown with its conditional retirement result. The ordinary lifestyle path remains anchored at current age.

## Execution, presentation and changes

The studio submits scenario snapshots to a Web Worker. Draft controls, saved preferences and the last submitted calculation are distinct states. Worker responses carry request IDs; obsolete work is terminated and stale responses ignored. Moving work off the UI thread does not by itself reduce calculation time.

Wealth-to-target progress is wealth divided by FIRE target, not a survival probability. Identify whether wealth means actual, scenario, or median projected retirement wealth. For current card placement and progress styling, inspect the studio and metric components rather than copying old indicator markup. The success verdict helper separately uses 95% and 80% thresholds; those are not the 90% safe-rate search threshold.

The methodology walkthrough is an educational example with its own controls. Inspect `FireMethodologyWalkthrough.tsx` and `walkthroughKernel.ts` when changing its sampling or explanations; do not present its allocation as the user's actual portfolio.

Preserve deterministic outputs for performance-only changes: Mulberry32 seed 42, random draw count/order, complete-horizon draws even after depletion, slice summation order, trial counts, search iterations and percentile conventions. Precomputed returns and eligible block starts are reusable work; changing floating-point operation order can still change exact results. Benchmark identical fixtures and verify output equality before claiming a speedup.

For methodology changes, obtain explicit approval before changing formulas, sampling semantics, precision, trial counts or financial assumptions. Relevant regression coverage lives beside the Home kernels (`fireBootstrap`, `firePortfolio`, `fireHistoricalFallback`, `fireExtendedAccumulation`, `fireSimulation`) and in the Planning studio tests. Check deterministic baseline behavior, fallback boundaries/gaps, conditional retirement denominators, and age-in-bonds anchors for the paths touched.

Limitations to communicate: historical resampling is not a forecast or guarantee; proxy returns may differ materially from actual holdings; shared history can be short and regime-dependent; block mode preserves only within-block dependence; real-value projections do not model inflation as a separate stochastic process; tax, fees, trading costs and individual bond maturity cash flows are not modeled by these kernels.
