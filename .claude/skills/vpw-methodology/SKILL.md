---
name: vpw-methodology
description: Use when inspecting or changing VPW withdrawal math, historical returns, accumulation and retirement simulations, planning preferences, worker execution, or result presentation in this repository.
---

# VPW methodology

This reference describes the **current working-tree implementation**, checked on 2026-09-28. It records behavior, not product approval. In particular, the two retirement-start modes below differ; documenting them does not resolve whether that distinction is desirable.

## Source map

Paths are relative to the repository root. Within `react/src/pages/private/`:

| Concern | Source |
|---|---|
| Monthly formula and target | `Home/vpwMath.ts` |
| Invested allocation | `Home/vpwPortfolio.ts` |
| Simulation engines and output types | `Home/vpwSimulation.ts` |
| Effective inputs, growth, request construction | `Planning/vpw/vpwScenario.ts` |
| Inputs and submitted snapshots | `Planning/vpw/VPWStudio.tsx` |
| Results and charts | `Planning/vpw/VPWResults.tsx`, `Home/FireAccumulationChart.tsx` |
| Detail page, save behavior | `Planning/strategies/VPWDetail.tsx`, `Planning/api.ts` |
| Compact indicator | `Home/VPWIndicator.tsx` |
| History and sampling | `Home/firePortfolio.ts`, `Home/fireBootstrap.ts`, `Home/fireReturns.ts` |
| Background execution | `Home/fireSimulation.ts`, `Home/fireSimulation.worker.ts`, `Home/useFireSimulationWorker.ts` |

`Planning/StrategyDetailPage.tsx` routes VPW to `VPWDetail`. Home and PlanningHub use the compact `VPWIndicator`. The active VPW engines are `runVPWRetirement`, `runVPWAccumulation`, and `runVPWSimulation`; the legacy varying-withdrawal/varying-target functions in `fireBootstrap.ts` are not this page's engines.

## Inputs and historical growth

- `buildVPWPortfolio` excludes actual `CASH` buckets and nonpositive holdings, preserving the relative weights of invested assets. With no investments, it supplies a reference portfolio of 60% IBOV / 40% CDI for modeling; actual invested wealth remains zero.
- Asset-specific series, overrides, and earlier-history fallbacks use FIRE's shared infrastructure. `eligibleMonths` intersects the histories of constraining slices. Each sampled month is shared across assets. The active path does not use the old annual IFIX availability threshold.
- The annual growth assumption is the compounded real growth of the weighted monthly portfolio over the eligible history: `G = exp(12 / M * sum(log(1 + portfolioReturn_m))) - 1`. Weights stay fixed, equivalent to monthly rebalancing. This is not an arithmetic average of annual returns.
- Sampling is `independent_months` by default, or `contiguous_12_month_blocks`. Both use monthly inflation-adjusted returns. Empty aligned history throws. Block mode requires a complete contiguous 12-month window and throws if none exists; it does not automatically switch to independent months.
- Expenses default to `expensesIndicators.fire_avg`. Savings default to revenue average minus total expense average (`expensesIndicators.avg`), through `useStrategyCommonData`. Saved expense/savings overrides replace those defaults.
- Scenario wealth is the local simulated-wealth override, otherwise invested wealth. Separate accumulation timing always starts from actual invested wealth.

There are no manual return or RV-allocation controls. `getVPWPlanningPreferences` drops legacy return/allocation keys, although the backend serializer still accepts them for compatibility. Pensions/INSS and an additional withdrawal-tax model are absent.

## Monthly withdrawal formula

For annual real growth `G > -1`, remaining months `n`, and `L = log1p(G) / 12`:

```text
monthlyRate = (1 - exp(-L)) / (1 - exp(-n * L))
monthlyRate = 1 / n                  when G = 0
monthlyRate = 1                      when n = 1
allowance = min(balance * monthlyRate, balance)
payment = min(allowance, requestedMonthlySpending)
nextBalance = max(0, (balance - payment) * (1 + sampledMonthlyReturn))
target = requestedMonthlySpending / monthlyRate
```

This is a beginning-of-month annuity. `vpwMonthlyRates` precomputes the schedule with `log1p`/`expm1`; each month's allowance uses that month's balance and remaining duration. Negative growth is supported. The same timing applies in the final year.

The spending input is a mandatory ceiling: unused allowance stays invested. Consequently, the final balance need not be zero. The initial target and coverage describe the first withdrawal, not coverage throughout retirement. For a zero spending request, the current snapshot reports initial coverage as zero.

## Simulations and retirement start

All engines default to 1,500 trials and Mulberry32 seed 42. Portfolio returns and sampling are prepared outside trial-month loops.

### Separate accumulation result

`runVPWAccumulation` receives a target for each calendar year. The builder supplies targets through `min(80, targetAge - currentAge - 1)` years, calculated using the remaining months at each year.

Each trial adds savings before monthly growth and checks target crossing at annual boundaries, including today. After crossing, its balance is frozen for the remaining gap observations. `gapBands` contain `max(0, targetAtYear - balance)`. Crossing-time percentiles use only trials that reached the target; `successRate` is the fraction reaching it. No crossing gives null timing percentiles. Nonpositive savings returns null, even if today's wealth already reaches the target; the UI asks for positive contributions.

### Zero extra accumulation years

`runVPWSimulation` calls `runVPWRetirement` independently of the accumulation result. Retirement starts **today**, using scenario wealth and the full remaining horizon. It still runs when no accumulation trial reaches the target or accumulation is null.

There is no automatic anchoring to the median target-crossing age. The full page explicitly labels this as withdrawals starting today.

### Positive extra accumulation years

`runVPWExtendedAccumulation` instead follows a continuous history for each trial, starting from scenario wealth:

1. Accumulate with nonnegative monthly contributions until an annual target crossing.
2. Continue contributing for the selected extra years.
3. Start withdrawals from that trial's own balance, ending at the unchanged target age.

Crossing must leave room for the extra years plus at least one retirement year. Below target with nonpositive savings is rejected; already-at-target scenarios can wait extra years with zero savings.

`extendedAccumulation` reports the retirement-start fraction/count and median start time, balance, and first-month income. Only trials starting retirement contribute retirement statistics. Bands retain calendar-year indices; each year's observations include only trials already retired. With no participating trials, retirement bands are empty, start statistics are null, and the UI omits the retirement summary/table. The separate actual-wealth accumulation result is still returned.

**Zero extra years and positive extra years select different simulation paths.** A retirement-spending success probability is not currently calculated. Accumulation `successRate` and retirement-start rate are different outcomes.

## Retirement outputs

- `withdrawalBands`: annual withdrawal totals, indexed from year zero; the UI divides by 12 for monthly averages.
- `balanceBands`: starting balance and subsequent year-end balances, including the final balance. No synthetic zero-income endpoint is added to withdrawal observations.
- `minimumMonthlyIncome`: for each trial, take its smallest annual withdrawal total divided by 12; then take p10/p50/p90 across those minima. These are worst-year monthly averages, not minimum individual-month payments or minima of the year-by-year percentile lines. Genuine zero withdrawals count.

Year-by-year percentile lines do not represent a single simulated life history. For retirement income/balance, p10 is pessimistic and p90 optimistic. For accumulation gaps, smaller is better: p10 is optimistic and p90 pessimistic.

## Current page and persistence

`VPWStudio` uses a collapsible desktop scenario column and a results column; mobile exposes an expandable scenario panel. Inputs are wealth, monthly expenses, monthly contributions, and ending age. Advanced controls contain **Anos extras de acumulação**, shared historical-series settings, and the 12-month-block switch. It is not the old two-row slider UI.

The first valid snapshot is submitted automatically. Later edits require **Recalcular**; displayed results use the submitted snapshot, not unsubmitted edits. The shared worker dispatches `kind: "vpw"`, rejects stale replies, and supports retry. Inputs remain available during calculation and after errors.

Defaults are ending age 99, extra years zero, null monetary overrides, and shared historical defaults. The age control is bounded by `max(70, currentAge + 1)` through 105; at/above 105 no valid future horizon exists. Extra years are integers 0–60 and must leave a retirement year. VPW preferences are saved under `vpw` when this is the active strategy and the user saves. Simulated wealth is local state and is not persisted. FIRE preferences remain separate. Backend validation lives in `django/authentication/serializers.py`.

### Results currently rendered

`VPWResults` presents:

1. Extra-accumulation context when applicable; otherwise the retire-today context.
2. A headline showing **Renda no pior ano · cenário pessimista**: `minimumMonthlyIncome.p10`.
3. Cards for actual wealth, capital needed for the initial requested withdrawal, ending age, first monthly withdrawal, requested monthly spending, and pessimistic worst-year shortfall. The final three require a retirement result. With extra years, first withdrawal is the median among participating trials. The ordinary first-withdrawal tooltip distinguishes allowance from the capped payment.
4. A worst-year income/shortfall scenario table and shared scenario checkboxes.
5. Separate retirement income and retirement balance charts, each with its own single Y-axis and tooltip. The income chart includes a requested-spending reference line.
6. Accumulation timing, reached fraction, and the shared `FireAccumulationChart` when savings are positive and there is more than one gap point. Its markers say **meta**, not a guarantee of retirement. When p90 crossing time exists, the chart trims observations after that crossing year plus two; the simulation horizon itself is unchanged.
7. A collapsed historical-data section with real growth, sampled range, allocation, trial count, method, and per-slice coverage.

Thus there can be **three charts**, in retirement-income, retirement-balance, accumulation order. All use calendar age. When retirement observations exist, scenario checkboxes control the table and all charts, mapping the reversed accumulation-gap percentiles correctly; the last enabled scenario cannot be unchecked. With no retiring trials, the accumulation chart can remain visible but the checkbox row is absent. Retirement income is not confined to a combined balance tooltip.

The compact indicator computes the snapshot without bootstrap simulations. It shows initial coverage, capped initial withdrawal, and ending age; no progress bar, sliders, or charts. It supplies zero derived savings, while saved savings preferences can still override that value; snapshot validation can therefore surface an extra-accumulation error in compact mode.

## Maintaining this reference

Check model changes against `vpwMath.test.ts` and `vpwSimulation.test.ts`; check input/presentation changes against the VPW scenario, studio, results, preference, detail, and compact-indicator tests beside their source. Performance evidence and harness usage are in `django/docs/benchmarks/README.md`. Compare the same trial counts, horizons, portfolios, and sampling modes; worker execution alone does not establish acceptable latency.

For intended requirements and unresolved acceptance, consult `django/docs/specs/vpw-model-review-decisions.md` and `django/docs/specs/vpw-implementation-progress.md`. Those records and this descriptive skill serve different purposes. Updating this file to match code does not authorize changing behavior or establish that the current UI has been accepted.
