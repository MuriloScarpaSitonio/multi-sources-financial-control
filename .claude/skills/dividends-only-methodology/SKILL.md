---
name: dividends-only-methodology
description: Explains the "Viver de proventos" (dividends-only) indicator in the Planning module — what it computes, why it deliberately uses backward-looking diagnostics over forward Monte Carlo (unlike FIRE/1-N/VPW), the conservative-bound framing of the time-to-goal estimate, and the hand-maintained reference constants (IDIV, IFIX, IPCA).
---

# Dividends-only Methodology

This skill captures the design decisions behind the dividends-only indicator in `react/src/pages/private/Home/DividendsOnlyIndicator.tsx`. Read this before changing the coverage formula, the time-to-goal calculation, the diagnostic row, or the hand-maintained reference constants in `react/src/pages/private/Home/consts.ts`. Strategy-page copy lives in `react/src/pages/private/Planning/strategyContent.tsx` under the `dividends_only` key.

## What the indicator computes

For a user with `patrimonyTotal`, `avgPassiveIncome` (trailing-12m credited dividends + JCP + FII rendimentos), and `avgExpenses` (FIRE-categorized monthly expenses):

1. **Current yield** = `avgPassiveIncome × 12 / patrimonyTotal × 100`. Fallback to 6% when `patrimonyTotal === 0`. The yield slider (1%–15%, step 0.5) lets users override this for what-if exploration.
2. **Required patrimony** = `effectiveExpenses × 12 / yield`. The patrimony level at which the chosen yield's monthly income covers expenses 1:1.
3. **Coverage %** = `displayIncome / effectiveExpenses × 100`. `displayIncome` is `avgPassiveIncome` by default; switches to `effectivePatrimony × yield / 12` when the user moves the yield or patrimony simulators (any simulation engages the formula path).
4. **Time-to-goal** (closed-form, see "Time-to-goal" section below).
5. **Diagnostics** over a user-controlled history window (`windowYears`, 1–10y discrete slider, default 3y), computed from `useIncomesHistoric` data sorted ascending by parsed date.

`effectiveExpenses` is `simulatedExpenses ?? avgExpenses` — the user has an `<ExpenseSimulator>` slider that overrides expenses for what-if exploration. Crucially, `effectiveExpenses` flows **only** into forward-looking values (1, 2, 3, 4 above) — the diagnostics in (5) deliberately keep using the real `avgExpenses`. See "Forward-looking only: simulated-expense scope" below.

## Why backward-looking diagnostics, not forward Monte Carlo

FIRE / 1-N / VPW all run a Monte Carlo bootstrap on historical IBOV / IFIX / CDI / BCB IPCA series, then surface percentile bands and success rates. Dividends-only deliberately does **not** do this, for one specific reason:

**We don't have an aggregate dividend-yield time series for dividend-focused portfolios.** B3 publishes IFIX and IDIV as **total-return** indices — index value bakes distributions into the price level; aggregate DY is not a published metric. NEFIN does publish weekly market-wide DY (2001–2023, Sept-stale), but its median is ~2.5% — far below what dividend-focused investors actually earn. Bootstrapping on it would systematically understate yields and produce simulation output that *looks* rigorous and *is* misleading.

Three forward-projection alternatives were explored and rejected:

1. **40-year exponential-compounding chart** (`p(t) = p0·(1+r)ⁿ + c·((1+r)ⁿ−1)/r`, plotted): rejected as theater — the line always crosses the expense reference at some horizon, so the chart always tells a hopeful story regardless of inputs.
2. **Hyperbolic required-patrimony-vs-yield curve**: rejected as a math lesson disconnected from any planning question the user is actually asking.
3. **NEFIN-bootstrap with dividends-only withdrawal rule**: rejected because the aggregate-yield input is wrong-distribution.

What survived: the **36-month-default bar chart of actual credited dividends** (sourced from `incomes/historic_report`, fetched via `useIncomesHistoric`), plus four diagnostics computed on real user data, plus a single derived time-to-goal number (see below) presented conditionally.

## The four core display elements

1. **Coverage progress bar** — `displayIncome / avgExpenses` clamped at 100% width. Brand-green at ≥100%, danger200 below. Wrapped in a tooltip explaining the formula.
2. **Headline gap line** — branched on `coveragePercentage`:
   - ≥100%: `"Independência financeira atingida! Sobram R$X/mês"`
   - <100%: `"Com yield Y%, independência financeira quando acumular R$Z (faltam R$W, ~Na Mb a esse ritmo de aporte)"`
   - The duration uses `formatMonthsAsDuration` (years+months for ≥12m, "X meses" otherwise).
3. **Diagnostic row** — sits above the chart with the headline coverage stat. Wrapping flex row (`gap=3`, `flexWrap`) so it collapses gracefully on narrow screens. Order:
   - Headline: `N% dos últimos Xa cobriram as despesas` (LARGE/SEMI_BOLD/brand for the percentage, EXTRA_SMALL/neutral400 for the clause)
   - `Cobertura média M% (± SD%)` — population mean + stdev of monthly `credited / avgExpenses × 100`
   - `Pior trimestre P%` — minimum of rolling 3-month sums divided by `3 × avgExpenses`. Brand-green ≥100%, danger200 below.
   - `Tendência YoY ±X%` — last-12m avg credited vs prior-12m avg, gated on `≥18` months of data.
   - `YoY real ±X%` — `(1 + nominal_yoy) / (1 + IPCA) − 1`, IPCA from `TYPICAL_TRAILING_IPCA_PCT`. See "YoY real" section.
   - `Janela: Xa` — discrete slider (1–10y, step 1, marks at every integer) controlling all of the above.
4. **Bar chart** — reuses `BarChartCreditedAndProvisionedWithAvg` from `react/src/pages/private/Incomes/Reports/charts.tsx` with `responsive`, `hideProvisioned`, `creditedFill = brand400`, `referenceStroke = danger200`, `referenceLabel = "Despesas"`, `showLegend = false`. The provisioned series is hidden because the page tracks *received* dividends, not declared-but-unpaid. The shared chart component is intentional DRY — both the Reports page and this indicator render the same shape.

## Time-to-goal: yield as compounding rate

The duration in the gap line is computed inline (not in a useMemo — cheap and depends on already-derived state):

```
t_months = ln((goal + c/r) / (current + c/r)) / ln(1+r)
```

with edge cases handled: r=0 + c=0 → Infinity, r=0 + c>0 → linear `(goal-current)/c`, c=0 + r>0 → pure compounding `ln(goal/current)/ln(1+r)`, current ≥ goal → 0.

`r` here is `yield/100/12` — the monthly **dividend yield**, treated as the monthly compounding rate. This deliberately conflates two distinct things:

- **Dividend yield** — what the portfolio pays out annually as a fraction of its value.
- **Total return** — capital appreciation + dividend yield.

For the strategy's pre-FIRE phase (where dividends are reinvested), the conflation has a defensible interpretation: "if dividends are reinvested and asset prices stay flat in real terms, this is when we hit the target." That's a **conservative lower bound**, not a forecast. The "Como o tempo até a independência é estimado" entry in `defaultsExplained` discloses this explicitly. Frame matters: the gap line says "*a esse ritmo*" not "*you will*".

A separate "expected total return" slider was rejected — it adds a speculation knob and plants a forecast in the user's head.

## Forward-looking only: simulated-expense scope

The `<ExpenseSimulator>` slider lets users explore "what if my expenses were R$X?". Three options were considered for how that override propagates:

| Option | Forward-looking values (coverage %, required patrimony, time-to-goal) | Backward-looking diagnostics (Pior trimestre, Cobertura média, YoY, % cobriram) | Chart reference line |
|---|---|---|---|
| Lockstep | shifts | shifts | shifts |
| Forward-only (chosen) | shifts | stays at real `avgExpenses` | stays at real `avgExpenses` |
| Disabled | n/a | — | — |

We chose forward-only. Reason: the diagnostics answer "given what actually happened over the last N years, how did my dividend stream behave against my actual expenses?". A counterfactual ("if my expenses had been R$X all along, X% of months would have covered them") is a different question and reframing the same numbers as the answer to it is confusing.

Concretely: `effectiveExpenses` is used in `coveragePercentage`, `requiredPatrimony`, the time-to-goal formula, and the surplus line. The `diagnostics` `useMemo` and the chart's `<ReferenceLine y={avgExpenses}>` use `avgExpenses` directly. If a future change makes diagnostics react to the slider, that's a deliberate design pivot — re-litigate the table above before doing it.

## YoY real: deflating nominal trend by IPCA

`yoyDeltaPct` measures nominal trailing-12m income growth. To answer "is this stream keeping up with inflation?", the indicator additionally computes:

```
yoyRealDeltaPct = (1 + yoyDeltaPct/100) / (1 + IPCA/100) − 1
```

where `IPCA = TYPICAL_TRAILING_IPCA_PCT` (currently 4.5, hardcoded in `consts.ts`).

A **negative YoY real** is the canonical signal that the dividends-only strategy is structurally failing for this user — nominal payouts may look stable, but expenses (which inflate with IPCA) are outrunning them. This is the dividends-only analog of "sequence-of-returns risk" in a withdrawal strategy: not the failure mode of any single bad month, but the slow erosion of real coverage over time.

The strategy explanation entry **"Risco de erosão real após atingir a meta"** in `strategyContent.tsx` names this risk in writing, explains why dividends-only is exposed to it (no automatic IPCA adjustment, unlike Trinity-style FIRE), points to the YoY real diagnostic, and lists three concrete mitigations.

## Hand-maintained constants

Two reference constants in `react/src/pages/private/Home/consts.ts` are deliberately not derived at runtime:

1. **`TYPICAL_DIVIDEND_YIELD`** — `{rangeMin: 6, rangeMax: 10, idiv: 7, ifix: 8}`. Sourced from Economatica's March 2023 study (10y window ending Feb/2023): IDIV 7.28%, IFIX 7.81%, IBOV 4.54%. The full provenance and a staleness disclaimer are in the `defaultsExplained` entry titled "De onde vem a faixa típica…" (if present — the user has edited that entry across iterations). Live alternatives were considered (BCB-style API, Status Invest scrape) and rejected: B3 doesn't publish aggregate DY for these indices; the numbers move slowly enough that an annual hand-revisit beats a fragile scrape.
2. **`TYPICAL_TRAILING_IPCA_PCT`** — `4.5`. Last reviewed 2026-05. Source for the next review: BCB SGS series 433 (`https://api.bcb.gov.br/dados/serie/bcdata.sgs.433`). A live fetch was considered and rejected for the same reason — IPCA moves slowly, the diagnostic only needs an order-of-magnitude reference, and adding a network call complicates the indicator without proportional benefit.

Both have explicit "revisit annually" comments and a `Last reviewed:` date in the source. Treat the `Last reviewed` date as the canonical update cadence cue.

## What's deliberately NOT here (and why)

- **No forward Monte Carlo / bootstrap simulation.** Aggregate dividend-yield history for dividend-focused portfolios doesn't exist in a usable form. See "Why backward-looking diagnostics".
- **No post-FIRE patrimony trajectory chart.** Same reason — would require speculation about future yield realizations that we'd be projecting from market-wide data that doesn't represent dividend-focused portfolios.
- **No total-return slider separate from yield.** One slider, conservative-bound framing. Adding total-return doubles the speculation surface.
- **No live IPCA fetch.** Hardcoded constant per the established TYPICAL_DIVIDEND_YIELD pattern. Diagnostic doesn't need precision below ~0.5pp.
- **No provisioned-dividend bars.** `hideProvisioned` is set on the shared chart — the page tracks money the user has actually received, not declared-but-unpaid distributions. Tooltip and `monthsAboveExpenses` counter follow suit.
- **No sequence-of-returns Monte Carlo of post-FIRE coverage.** The analog is captured by `Pior trimestre` (sequence-of-bad-quarters in the actual history) and `YoY real` (slow erosion). Backward-looking, real data, no forecasts.

## Shared components used here

These exist outside `DividendsOnlyIndicator.tsx` and are intentionally shared with other strategies. Don't fork them for dividends-only-specific tweaks; thread props instead.

- **`SavingsSimulator`** (`react/src/pages/private/Home/SavingsSimulator.tsx`) — TextField + slider + reset, with `max = max(avgMonthlySavings × 3, 10000)`. Same component used by FIRE / 1-N / VPW. Default `avgMonthlySavings` here is `revenuesIndicators.avg − avgExpenses` (clamped ≥0).
- **`ExpenseSimulator`** (`react/src/pages/private/Home/ExpenseSimulator.tsx`) — same shape (TextField + slider + reset). Same component used by FIRE. Default `avgMonthlyExpenses` is the real `avgExpenses`. Override flows into forward-looking values only — see "Forward-looking only: simulated-expense scope".
- **`PatrimonySimulator`** — also shared. Reset clears **all** simulators (yield, patrimony, savings, expenses) in one call.
- **`BarChartCreditedAndProvisionedWithAvg`** (`react/src/pages/private/Incomes/Reports/charts.tsx`) — historical bars of credited+provisioned income with a configurable reference line. Originally only used by the /assets/incomes Reports page; parameterized with `responsive`, `referenceLabel`, `referenceStroke`, `showLegend`, `creditedFill`, `provisionedFill`, `hideProvisioned`, `height` so the indicator could reuse it without forking.

## Things to preserve when modifying

1. **Don't add forward Monte Carlo without aggregate dividend-portfolio yield history.** The only rigorous data source we'd have is NEFIN's market-wide DY, and it systematically underestimates dividend-focused portfolios. Fix the data first.
2. **Don't conflate "yield" with "total return" silently.** The current code does conflate them, but it's disclosed in writing as a conservative-bound assumption. Any change must preserve that framing or replace it with something equivalently honest.
3. **Don't replace the YoY real formula with `nominal − IPCA` without checking the math.** The current `(1 + nom)/(1 + ipca) − 1` is the geometric (correct) deflation; the additive approximation is fine for small numbers but drifts at high inflation.
4. **Don't change `TYPICAL_*` constants silently.** Update the `Last reviewed:` comment in the same commit. The whole point of the hardcode-with-pattern is that the next person can audit when it was last touched.
5. **Don't fork `SavingsSimulator`, `PatrimonySimulator`, `ExpenseSimulator`, or `BarChartCreditedAndProvisionedWithAvg`** for dividends-only tweaks. They're DRY across strategies; thread props.
5b. **Don't make simulated expenses flow into the historical diagnostics.** That's the chosen scope (forward-only); the table in "Forward-looking only: simulated-expense scope" was already adjudicated. Re-open the question explicitly before changing it.
6. **Don't drop the `hideProvisioned` flag on the chart** without reconsidering the whole "actual received vs declared" framing — the diagnostic counters all assume `credited` only.
7. **Don't make the window slider continuous.** Discrete 1–10y with marks is intentional — non-integer windows would make the YoY pair-up math (last-12m vs prior-12m) inconsistent with the visual.
8. **The `defaultsExplained` entries for `dividends_only` in `strategyContent.tsx` are part of the methodology, not just copy.** They name the conservative-bound assumption, the IPCA-erosion risk, and the time-to-goal formula. Removing them creates silent overclaims in the UI.
