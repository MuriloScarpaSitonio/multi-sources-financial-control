---
name: vpw-methodology
description: Explains the VPW (Variable Percentage Withdrawal) indicator in the Planning module — the PMT-based withdrawal-rate schedule, the two bootstrap variants (varying-target accumulation + varying-withdrawal drawdown), the FIRE-cloned chart layout, and the design decisions iterated against an active user that future-you should not re-litigate.
---

# VPW Methodology

This skill captures the design decisions behind the VPW indicator in `react/src/pages/private/Home/VPWIndicator.tsx` and the two bootstrap primitives it relies on in `react/src/pages/private/Home/fireBootstrap.ts` (`runBootstrapWithVaryingWithdrawal`, `runAccumulationBootstrapVarying`). Read this before changing the PMT math, either bootstrap variant, the chart layout, the slider arrangement, the tooltip, or the percentile-checkbox UI. Several "obvious improvements" were already tried and rejected.

## What VPW is

A withdrawal strategy from the Bogleheads VPW tables. Each year:

```
withdrawalRate_y = -PMT(realReturn, yearsRemaining, -1, 0)
                 = realReturn × (1 + realReturn)^N / ((1 + realReturn)^N − 1)
withdrawal_y = balance_y × withdrawalRate_y
```

`yearsRemaining` shrinks every year (`targetAge − currentAge − y`). The PMT formula returns the annuity-equivalent fraction of capital that, given a fixed real return, would consume the portfolio exactly by the target age. The withdrawal *rate* rises monotonically with age (4% at 30 years remaining → 100% at 1 year remaining), but the withdrawal *amount* depends on portfolio performance.

By construction the portfolio depletes to zero at the target age in the deterministic case. In the stochastic case, withdrawals are bounded by current balance, so the portfolio cannot run out in nominal terms within the horizon — only the *amount* taken varies trial-to-trial.

## Two bootstrap variants

VPW uses two bootstrap primitives in `fireBootstrap.ts`:

### `runBootstrapWithVaryingWithdrawal` (drawdown / chart 2)

For each of N (default 1500) trials, simulate `horizon` years of retirement:

1. Start with `startingBalance` (the patrimony at the moment of retirement — see "Anchoring chart 2" below).
2. Each year `y`:
   - `w = clamp(withdrawalAt(y, balance), 0, balance)` — VPW can't overdraw.
   - `balance = (balance − w) × (1 + drawAlignedYearReturn(weights, availableIndices, rng))` — withdrawal **before** growth.
3. Output `withdrawalBands` (length `horizon`) and `balanceBands` (length `horizon + 1`) of p10/p50/p90.

`VaryingWithdrawalResult` has no `successRate` field because withdrawals are bounded by balance — depletion at horizon end is structural, not a failure mode.

#### Why withdraw-before-growth (vs FIRE's grow-then-withdraw)

`runTrial` (FIRE) does `balance = balance × (1 + r) − annualWithdrawal`. The VPW variant does `(balance − w) × (1 + r)` because PMT computes the rate against the **start-of-year** balance — annuity-due semantics. The cash must come out before that year's return is realized; otherwise the rate is being applied to a balance that already includes a year of returns the user hasn't earned yet. There's a comment on the loop documenting this divergence — don't "harmonize" it.

### `runAccumulationBootstrapVarying` (accumulation / chart 1)

Counterpart to FIRE's `runAccumulationBootstrap`, but takes a `targetAt: (year) => number` callback because VPW's target shrinks each year (PMT denominator grows as horizon shrinks). Per trial:

1. Start with `startingBalance`.
2. Each year `y` (until crossing or `maxYears`):
   - `balance = (balance + annualContribution) × (1 + drawAlignedYearReturn(weights, availableIndices, rng))` — contribution **before** growth (matching FIRE).
   - If `balance >= targetAt(y)`, mark `yearReached = y` and freeze balance for the remaining years.
3. Output `gapBands` (length `maxYears + 1`) of `max(0, targetAt(y) − balance_y)`, plus `p10/p50/p90 yearsToTarget` (best/median/worst decile crossing year) and `successRate` (fraction of trials that crossed within `maxYears`).

`AccumulationResult` is reused across FIRE and VPW — VPW's variant just has a different per-year target.

### Sampling: availability-aware aligned-year, size-1 blocks

Both VPW bootstraps call `drawAlignedYearReturn(weights, availableIndices, rng)` from `fireBootstrap.ts`. For each simulated year, one historical calendar year is drawn uniformly from `availableIndices`, and that year's per-asset returns are combined with the weights — equity, IFIX, and fixed income all come from the same calendar year, preserving cross-asset correlation in stressed regimes (e.g. 2008 hits all assets jointly). Year-to-year autocorrelation is still dropped (size-1 blocks).

`availableYearIndices(w)` uses a strict `w.ifix > 0` rule: any nonzero IFIX exposure restricts the sample window to IFIX-available years (2011–2025, 15 years); zero IFIX uses the full NEFIN range (2001–2025, 25 years). A tiny IFIX rounding artifact could therefore cliff the window from 25 → 15 years. A `MIN_WEIGHT_FOR_RETURN_SERIES` threshold was considered and deferred until real artifacts show up.

The full discussion (data sources, methodology limits, prior IID variant) lives in the `fire-bootstrap-methodology` skill — don't duplicate it here.

## Chart layout — pure FIRE clone

Two `ResponsiveContainer` charts. Layout decisions copied from `ConstantDollarIndicator.tsx` after multiple iterations on a custom VPW shape were rejected:

### Shared checkbox row (above both charts)

`Otimista / Mediana / Pessimista` checkboxes drive `showOtimista / showMediana / showPessimista` from one source of truth. Both charts read the same flags, so toggling once affects both. Cannot disable all three (last-checked checkbox disables itself, matching the FIRE pattern). Renders right-aligned (`justifyContent="flex-end"`).

### Chart 1 — Acumulação

Header: `Acumulação · quanto falta para a meta` (matches FIRE).

- X axis: `dataKey="age"` (not year-from-now). Tick labels show ages directly so the user reads "at age 45 the gap is X" without mental conversion.
- Y axis: gap (R$).
- 3 lines: gap p10 (`Colors.brand`, otimista), gap p50 (`Colors.brand200`, mediana), gap p90 (`Colors.danger200`, pessimista). All decline toward 0 as patrimony rises and target falls.
- 3 reference lines for crossover ages — `currentAge + crossoverYearP10/P50/P90` — labeled `otimista · aposenta aos N` / `mediana · aposenta aos N` / `pessimista · aposenta aos N`. `dy` offsets stagger labels so they don't overlap.
- Top-margin 50px on the chart so the reference labels render above the plot area without clipping.

Below the header: `<SavingsSimulator>` (because aportes mensais directly drive accumulation; placement near the chart it affects).

The skill's earlier deterministic single-line + falling-target version was rejected after the user asked for "p10 / p50 / p90 like FIRE." Don't revert.

### Chart 2 — Aposentadoria

Header: `Aposentadoria · trajetória do patrimônio depois de atingir a meta` (matches FIRE).

- X axis: `dataKey="age"`. Starts at `currentAge + crossoverYearP50` (median retirement age).
- Y axis: balance (R$). **Single Y-axis** — earlier dual-axis variant was rejected.
- 3 lines: balance p10 (`Colors.danger200`, pessimista — smallest balance is worst case), balance p50 (`Colors.brand200`, mediana), balance p90 (`Colors.brand`, otimista — largest balance is best case). Color semantics flip relative to chart 1 because for *gap* small=good and for *balance* large=good.
- Withdrawal info lives in the tooltip only — no withdrawal lines on the chart.
- One synthetic chart point appended at `targetAge` with `withdrawalP*=0` and `balanceP*=balanceBands[horizon].p*` so the depletion-to-zero is visibly traced (without it the chart's right edge shows the start-of-year balance of the last simulated year, not the post-sweep zero).

#### Tooltip

For chart 2, color-matched to chart strokes:

```
Idade: X
Pessimista (p10): R$ Y · R$ Z/mês       ← if showPessimista
Mediana (p50):    R$ Y · R$ Z/mês       ← if showMediana
Otimista (p90):   R$ Y · R$ Z/mês       ← if showOtimista
```

Each line shows balance + monthly withdrawal at that percentile. The earlier 6-line tooltip was rejected as too dense; merging balance and withdrawal onto one line per percentile preserves both pieces of info without bloating.

For chart 1 (accumulation):

```
Idade X (ano Y)
Otimista (p10): falta R$ N        ← if showOtimista
Mediana (p50): falta R$ N         ← if showMediana
Pessimista (p90): falta R$ N      ← if showPessimista
```

Tooltip rows render only when the corresponding checkbox is on — toggling a percentile off removes both the chart line and its tooltip row.

### Anchoring chart 2 at the projected retirement age

Chart 2's bootstrap is seeded at `currentAge + crossoverYearP50` (median retirement age) with starting balance `effectiveMonthlyExpenses × 1200 / vpwRate(yearsAtRetirement)` — i.e., the VPW target at the median retirement age. Two consequences:

1. When the user can already retire today (`crossoverYearP50 === 0`), chart 2 collapses naturally to the "retire today" view.
2. When accumulation never crosses (`crossoverYearP50 === null` after MAX_ACCUM_YEARS), chart 2 doesn't render — there's no "after the target" if the target is never reached.

This is **Option 1** from the design discussion. **Option 2** (anchor at `currentAge`, simulate "if you retired today") was rejected because it shows a counterfactual when `gap > 0` and produces dismal-looking charts regardless of strategy. Don't revert.

The seed uses the *deterministic* PMT target (`expenses × 1200 / rate`) rather than the patrimony at crossover from the bootstrap — by construction those match, but the deterministic form is exact, doesn't depend on which trial we picked, and is independent of the band shape.

## Slider layout — two rows only

After multiple revisions the user landed on **exactly two rows**:

### Row 1 (assumptions)

Wrapped in `<Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">`. In order:

- Idade alvo (slider, marks unlabeled, 70–105, step 1)
- Alocação RV: X% / RF: Y% (override slider, 0–100, step 5) + `Resetar` button when overridden
- Retorno RV (slider, marks unlabeled, 3–15%, step 0.5) — gray-out + disable when `effectiveStockPct < 0.01`
- Retorno RF (slider, marks unlabeled, 1–8%, step 0.5) — gray-out + disable when `effectiveBondPct < 0.01`

Tooltips on inert sliders explain "Sem efeito: alocação RV/RF é 0%". Marks have empty `label: ""` — they're discrete tick visuals only, not labeled.

### Row 2 (what-if)

Wrapped in `<Stack direction="row" gap={2} flexWrap="wrap">`. Two reusable simulators:

- `<PatrimonySimulator>` (label "Patrimônio", drives `effectiveInvestment`)
- `<ExpenseSimulator>` (label "Despesas mensais", drives `effectiveMonthlyExpenses`)

Both reuse the FIRE components — don't fork.

The `<SavingsSimulator>` is **not** in row 2. It lives below the accumulation chart's header because aportes mensais only directly affect that chart (they shift `crossoverYearP*` which propagates to chart 2 via the seed, but conceptually it belongs with the accumulation phase).

Earlier four-row layouts (separate rows for allocation, target+returns, patrimony, expenses) were rejected as visually noisy.

## Effective values flow

Every consumer of `monthlyExpenses` reads `effectiveMonthlyExpenses = simulatedExpenses ?? avgExpenses`. Same pattern for patrimony, savings, allocation:

| Live source | Override | Effective |
|---|---|---|
| `avgExpenses` (prop) | `simulatedExpenses` | `effectiveMonthlyExpenses` |
| `investmentTotal` (derived) | `simulatedPatrimony` | `effectiveInvestment` |
| `avgMonthlySavings` (prop) | `simulatedSavings` | `effectiveSavings` |
| `derivedStockPct` (computed) | `overrideStockPct` | `effectiveStockPct` |

`effectiveSavings` clamps negatives to zero (`Math.max(0, avgMonthlySavings)`) — same convention as 1/N. `effectiveBondPct = 100 - effectiveStockPct`.

The three label/tooltip surfaces ("Saque", `(simulado)` italic prefix on allocation, `(override)` annotation in bar tooltip) all read effective values, so the displayed numbers always match what's being simulated.

## Bank cash exclusion

VPW operates on **`investmentTotal = equityTotal + ifixTotal + fixedIncomeTotal`** — bank cash is NOT included. Same reasoning as before: bank cash is emergency-fund-coded (per `FinancialHealthSummary.tsx`), not retirement-portfolio-coded. Including it would inflate the rate's denominator and silently overstate the planned withdrawal.

This differs from `ConstantDollarIndicator` (basic FIRE), which bundles bank cash into `fixedIncomeTotal + bankAmount`. The codebase is genuinely inconsistent across strategies — VPW follows the exclusion convention. There is no UI affordance flagging the exclusion (no "+ R$ X em conta" line) — the user removed it.

`bankAmount` is **not** a `VPWIndicator` prop. Earlier iterations took it for a planned UI line that was then dropped — YAGNI'd out.

## "Cobertura: X%" prefix

The progress bar's percentage reads **"Cobertura: 65.4%"**, not bare "65.4%". Disambiguates from the "Saque: 4.7% a.a." rate value below — both are percent-formatted to one decimal and easy to conflate.

## No RF > RV warning

An earlier version flagged "Retorno RF acima do RV — pouco usual historicamente". This claim is false for the BR market: CDI real ~5,5% (2000–2024) routinely exceeded Ibovespa real ~2% in the same window. Removed. Don't reintroduce.

## Determinism

Both bootstrap variants use **Mulberry32** seeded with `FIXED_SEED = 42`, identical to all other variants in the file. Reload jitter would be especially bad on VPW because every slider change re-runs both bootstraps (1500 × 30+ years × per-year PMT calls + 1500 × 80 years × per-year target calls).

## Compact-mode behavior

In compact mode (home dashboard, planning hub card):

- Bar + sublabel ("Saque: X% a.a. · R$ Y/mês") visible.
- All sliders, simulators, charts, gap labels: hidden.
- Bar tooltip still works.

The compact view exists for tile space; the full experience lives on `/planning/vpw`.

## Unified "how much / how long" framing

Same binding question across all Planning strategies (see `one-over-n-methodology`):

> *"Given my current expenses and my current patrimony, if I choose to follow strategy X, how much more money do I have to gather and how much time will it take given my average monthly savings?"*

For VPW: target = `effectiveMonthlyExpenses × 1200 / vpwRate(yearsRemaining)` at current age. Two text lines under the progress bar (load-bearing — the chart is illustrative, the text is the answer):

- **"Falta juntar R$ X para começar VPW hoje"** (red when gap > 0, brand when gap = 0)
- **"Em N anos no seu ritmo (aposenta aos M anos)"** / "Pode aposentar hoje aos N anos" / "Mais de 80 anos no seu ritmo — aumente os aportes ou o retorno"

`accumulationLabels` reads from `crossoverYearP50` (median) — not p10 (overpromise) or p90 (underpromise).

## Things to preserve when modifying

1. **Don't switch `runTrialVaryingWithdrawal` to grow-then-withdraw ordering.** VPW's PMT semantics require start-of-year withdrawal. Grow-first would silently shift results by a year of compounding.

2. **Don't replace gap bands with a single deterministic patrimony+target line on chart 1.** That was the earlier shape and the user explicitly asked for FIRE-style p10/p50/p90 bands. The shrinking target is implicit in the gap converging to 0 faster than just balance-growth would explain.

3. **Don't merge the two charts.** They're separate ResponsiveContainers with different X-axis semantics (accumulation runs from `currentAge` forward; drawdown anchors at retirement age). Keep them independent.

4. **Don't reintroduce the dual Y-axis on chart 2.** Withdrawal info goes in the tooltip only. Single Y-axis for balance.

5. **Don't anchor chart 2 at current age (Option 2).** Option 1 wins. The "after atingir a meta" header is load-bearing.

6. **Keep the percentile checkboxes shared across both charts.** One source of truth (`visibleScenarios`); rendered above both charts; affects both line visibility and tooltip rows.

7. **Keep `bankAmount` out of the `VPWIndicator` prop surface.**

8. **Don't add an RF > RV warning.** BR market reality contradicts the US-equity-premium reflex.

9. **Keep the slider layout at 2 rows.** Earlier four-row variants were rejected. Allocation merges into row 1; expense + patrimony merge into row 2; savings simulator lives below the accumulation chart header.

10. **Don't remove the `marks` (unlabeled) on the discrete sliders.** They're tick visuals only; explicit labels were rejected as polluting in 1/N's history but unlabeled marks are accepted across both.

11. **Don't fold the `accumulation` and `projection` `useMemo`s back into one.** Order matters — `accumulation` produces `crossoverYearP50` which `projection` reads to determine retirement age. They're sequential by design.

12. **`MAX_ACCUM_YEARS = 80`.** Same cap as 1/N. Above this, the projection truncates and the time-text label switches to the danger-colored "Mais de 80 anos no seu ritmo" copy.

13. **The `(simulado)` italic indicator** must appear next to "Alocação RV: X% / RF: Y%" when `overrideStockPct !== null`. The bar tooltip's *(override)* annotation is the second surface.

14. **Match FIRE's chart header styling exactly:** `size={FontSizes.EXTRA_SMALL}` + `weight={FontWeights.MEDIUM}` + `color={Colors.neutral200}`. `mt: 2` on the second header to give breathing room from the chart above.

15. **Don't switch the sampler back to per-asset independent draws.** Aligned-year sampling preserves cross-asset correlation in stressed regimes (2008-style joint stress hits all assets together); the old IID variant biased success rates upward by under-counting joint stress. Don't relax the strict `weights.ifix > 0` cliff to a `MIN_WEIGHT_FOR_RETURN_SERIES` threshold without first confirming real rounding artifacts in practice — the decision was deferred deliberately.

## Call sites

Three call sites pass the props:

- `Home/Indicators.tsx` — compact mode. Computes `monthlySavings = (revenuesIndicators?.avg ?? 0) − (expensesIndicators?.avg ?? 0)` and passes as `avgMonthlySavings`.
- `Planning/PlanningHub.tsx` — compact mode. Same `avgMonthlySavings` calculation; placeholder no-op handlers for sliders since they're hidden in compact.
- `Planning/StrategyDetailPage.tsx` — full chart mode. Passes `derivedMonthlySavings` (NOT the centralized `monthlySavings` override that FIRE uses). VPW manages its own `simulatedSavings` state internally — same self-contained pattern as 1/N.

`avgMonthlySavings` uses `expensesIndicators.avg` (total trailing-12 expenses including non-FIRE items), not `fire_avg`. Same reason as 1/N: savings = income minus *actual* current spending. Using `fire_avg` would over-state savings.
