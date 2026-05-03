---
name: one-over-n-methodology
description: Explains the 1/N withdrawal indicator in the Planning module — what the deterministic projection computes, the unified "how much / how long" framing shared across strategies, the two-chart accumulation/drawdown split, and the deliberate rejection of flat expense reference lines that we iterated to before landing here.
---

# 1/N Methodology

This skill captures the design decisions behind the 1/N indicator in `react/src/pages/private/Home/OneOverNIndicator.tsx`. Read this before changing the projection math, the chart split, the slider semantics, or the "Aposenta aos X anos" reference line. The visual design has been re-litigated multiple times against an actively skeptical user — most "obvious improvements" were already tried and rejected.

## What 1/N is

A withdrawal strategy where in each year of retirement you draw `balance / yearsRemaining` from the portfolio. The denominator shrinks every year, so the strategy is intrinsically tied to a target depletion age (the year where `yearsRemaining` hits zero and the balance is consumed). It is *not* a fixed-percentage rule — the withdrawal rate evolves: 1/N → 1/(N−1) → 1/(N−2) … → 1/1.

Under positive real return, the per-year monthly withdrawal **drifts upward** in real terms over the retirement: balance falls slower than the denominator does, because returns refill what 1/N takes out. That drift is the strategy's signature and is what the drawdown chart exists to visualize.

## What the projection computes

Pure deterministic iteration in `computeProjection` — no historical bootstrap, no Monte Carlo. The math is closed-form given the user's real-return assumption:

**Phase 1 (accumulation):**
```
target = yearsRetirement × 12 × monthlyExpenses     // starting capital required
balance_{y+1} = balance_y × (1 + r) + monthlySavings × 12
gap_y = max(0, target − balance_y)
crossoverYear = first y where balance_y ≥ target
```

**Phase 2 (drawdown):**
```
yearsLeft_t = yearsRetirement − t
annualWithdrawal_t = balance_t / yearsLeft_t
balance_{t+1} = (balance_t − annualWithdrawal_t) × (1 + r)
```

`yearsRetirement` is derived from the slider as `targetDepletionAge − currentAge`, with `currentAge` from `dateOfBirth`. The savings, return rate, and patrimony are all driven by sliders with the data-driven defaults (avg revenues − avg expenses for savings; live patrimony for the patrimony slider; 5% real for return).

Both phases run in **real terms** — see "Inflation handling" below.

### Why no bootstrap

Unlike Trinity / FIRE, 1/N has no sequence-of-returns variance to model in the same way:

1. The withdrawal is *defined* as a fraction of remaining balance, so the strategy auto-adjusts to whatever happens to the portfolio. There's no "fail" event analogous to running out of money before death — by construction, 1/N depletes the patrimony exactly at the target age.
2. The interesting question for 1/N isn't "will it last?" (it lasts by definition) but "how much income will it produce?" — which under real returns is a deterministic transformation of the user's assumptions.
3. Adding a bootstrap would require swapping the deterministic real-return slider for a portfolio-allocation input + historical real returns, and the indicator currently doesn't take allocation as a prop. If 1/N's chart 2 ever needs sequence-of-returns bands, follow the FIRE bootstrap pattern (`runBootstrap` / `runAccumulationBootstrap` in `fireBootstrap.ts`) and migrate the call sites.

The trade-off: chart 2's per-year monthly-withdrawal bars show the *expected* trajectory at the chosen real return, not a percentile fan. If the user wants to see how a bad sequence affects 1/N specifically, that's a future enhancement, not a current capability.

## The unified "how much / how long" framing

This is the binding question every strategy in the Planning module must answer:

> **"Given my current expenses and my current patrimony, if I choose to follow strategy X, how much more money do I have to gather and how much time will it take given my average monthly savings?"**

Two outputs every strategy must produce:

1. **Falta juntar R$ X** — strategy-specific target patrimony minus current patrimony.
2. **Em N anos** — time to close that gap given monthly savings + real return.

For 1/N: target = `(targetDepletionAge − currentAge) × 12 × monthlyExpenses`. Other strategies have different target formulas (FIRE/SWR uses `(100/rate) × 12 × monthlyExpenses × horizonFactor`; dividends-only uses `monthlyExpenses × 12 / yieldRate`; etc.) but the *chart shape* and the *two-line summary* are unified across strategies.

The two text lines under the progress bar are load-bearing. They restate the answer in plain Portuguese:

- "Falta juntar R$ X para começar 1/N hoje"
- "Em N anos no seu ritmo (aposenta aos M anos)"

Don't remove them in favor of "the chart says it." The user explicitly asked for these as the canonical framing — chart is illustrative, text is the answer.

## Chart split — accumulation + drawdown

Two separate `ResponsiveContainer` charts, each with its own header. They answer fundamentally different questions:

### Chart 1 — "Acumulação — quanto falta e em quanto tempo"

- X axis: years from today (0 → crossoverYear).
- Y axis: R$ (real terms).
- **Green line**: patrimônio rising at savings + real return.
- **Red line**: gap (`target − balance`, clamped at 0) declining.
- Both lines converge at `(crossoverYear, target)` on the right edge — the goal post is implicit in their meeting point, not drawn as a flat reference line.
- Yellow vertical `ReferenceLine` at `crossoverYear` labeled "aposenta aos X anos" with right margin = 90px so the label doesn't get clipped.

### Chart 2 — "Aposentadoria — após atingir o alvo, como 1/N se comporta"

- X axis: years of retirement (0 → yearsRetirement).
- Y axis: dual — left is monthly withdrawal in R$, right is remaining patrimônio in R$ (very different magnitudes).
- **Green bars**: per-year monthly withdrawal. Drift up under positive real return — that's the 1/N signature.
- **Blue line**: remaining patrimônio declining toward zero at depletion age.
- No expense reference line (see "Why no flat expense line" below).

Chart 2 explicitly assumes the user has reached the target (Option 1 in the design discussion). It is *not* "what if you retired today with current patrimony?" That alternative was rejected because:

1. Chart 1 already conveys today's shortfall via the gap.
2. Chart 2's unique value is showing the *strategy's drawdown signature* — which only manifests when you assume successful accumulation. Otherwise every strategy looks the same dismal way ("not enough money, line crashes").
3. Comparing strategies side-by-side requires a fixed reference point — "starting at the target." Otherwise FIRE vs 1/N vs Dividends-only would be muddled by their respective gaps to target.

The chart 2 header makes the assumption explicit ("após atingir o alvo, como 1/N se comporta"). Don't soften it back to ambiguous wording.

## Why no flat expense line on the chart

This was iterated extensively. The user rejected — in order — every variant of "show expenses as a flat reference and the strategy's withdrawal as a growing line and call the crossover the retirement age":

| Attempt | Shape | Why rejected |
|---|---|---|
| A | Original — withdrawal area + flat dashed expenses + crossover age | "the expenses comparison is FLAT", visually says "growing surplus forever" |
| B | Drawdown only (descending area) | Kills the "when can I retire?" question entirely |
| C | Year-1 income at each candidate retirement age vs flat expenses | Asymptote at target age — withdrawal numerator grows AND denominator shrinks |
| D | Cap chart at `comfort_ratio × expenses` to hide asymptote | "do not try to hide it. something in your design is totally wrong" |
| E | Patrimony exponential vs required-capital declining linearly to 0 at target | "same shit" — declining required line is artifact of fixed end-age |
| Years vs years | Y = years portfolio covers; reference = years remaining (declining) | "the red line makes no sense" — declining reference is non-intuitive |
| FIRE-shape | Patrimony rising vs flat target = `N × 12 × expenses` | "isn't this the same flat line as the expenses I first complained about but just presented in different terms?" — yes, it is |

The break-out was the user articulating the unified framing themselves: *"how much more do I need and how long will it take given my savings?"* That reframes the flat target from "comparison of dynamic things" (rejected) to "an explicit goal post you're saving toward" (accepted). The visual implementation drops the flat *line* and instead lets the curves converge at the goal point — same math, different visual story.

**Rule:** if a future iteration is tempted to add a horizontal "expenses × constant" reference line to either chart, that's the same mistake under a new name. The user will recognize it.

## Inflation handling

Everything in the indicator is in **real terms** (today's purchasing power):

- `realReturn` slider is real return = nominal return − inflation, already net of inflation.
- `monthlyExpenses` (from `expensesIndicators.fire_avg`) is held flat in real terms — equivalent to assuming expenses inflate 1:1 with the consumer basket.
- `monthlyAportes` (from `revenuesAvg − expensesAvg`) is also held flat in real terms — equivalent to assuming the user gets inflation raises that preserve savings purchasing power.
- `target = N × 12 × monthlyExpenses` is in real R$ — the corresponding nominal target at retirement is much larger (multiplied by `(1+inflation)^crossoverYear`), but the indicator never displays nominal R$.

The user verified the math by walking through a concrete example (R$ 4M target real ≡ R$ 10.6M nominal in 20 years at 5% inflation; both correspond to the same purchasing power). If you ever switch the indicator to nominal R$, expect the displayed numbers to balloon — most retirement planners stick to real because nominal numbers mislead readers who can't intuitively deflate.

## Slider semantics

| Slider | Min/Max/Step | Default | Drives |
|---|---|---|---|
| Idade alvo (depleção) | 70/105/1 | from preferences (default 90) | `yearsRetirement = targetAge − currentAge` |
| Retorno real | 1%/8%/0.5 | from preferences (default 5%) | both phases — accumulation growth and drawdown growth |
| Patrimônio | 0 / max(5×total, 1M) / 50k | live `patrimonyTotal` | accumulation starting balance |
| Aportes mensais | 0 / max(3×avg, 10k) / 100 | `revenuesAvg − expensesAvg` | accumulation contribution |
| Despesas mensais | 0 / max(3×avg, 10k) / 100 | `expensesIndicators.fire_avg` | target via `N × 12 × despesas`, drawdown comparison |

All sliders are MUI `Slider` with `step` set, so they're discrete in behavior. We tried adding `marks` for visual ticks; user rejected ("polluting"). They are unmarked but step-snapping.

`PatrimonySimulator`, `SavingsSimulator`, and `ExpensesSimulator` are the wrapped slider+textfield+reset components. All three follow the same pattern (textfield + slider + reset button when overridden) but live in separate files. Reuse via shared abstraction is open work — for now they're sibling files with the same shape but different labels and defaults. Don't introduce a fourth bespoke simulator without consolidating all three into a generic one first.

In `compact` mode (home page summary), the chart and the patrimony/savings simulators are hidden. Only the progress bar, the 1/N math summary, and the target depletion age slider remain. Don't render the charts in compact mode — they're heavy and the summary tile is too small to fit them legibly.

## Call sites

Three call sites pass the props:

- `Home/Indicators.tsx` — compact mode. Already had `revenuesIndicators` from `useRevenuesIndicators({ startDate, endDate })`. Computes `avgMonthlySavings = (revenuesIndicators?.avg ?? 0) − (expensesIndicators?.avg ?? 0)`.
- `Planning/PlanningHub.tsx` — compact mode. Added `useHomeRevenuesIndicators()` to source `revenuesIndicators.avg`.
- `Planning/StrategyDetailPage.tsx` — full chart mode. Same hook addition. The `monthlySavingsOverride` state lives at this call site (slider override default is null = use derived).

`avgMonthlySavings` is computed using `expensesIndicators.avg` (total trailing-12 expenses including non-FIRE items like debt repayment) — *not* `fire_avg`. Reason: savings = income minus *actual* current spending, which includes things that won't carry into retirement. Using `fire_avg` would inflate the savings figure with money the user is still spending now.

## Things to preserve when modifying

1. **Don't reintroduce a flat expenses reference line on either chart.** This was iterated through ~7 attempts. The user will recognize it as the same mistake. The unified "how much / how long" framing is the workaround.

2. **Don't combine the two charts back into one.** The unified "V shape" was tried (gap declining → bars rising) and worked, but each phase answers a different question and the unified Y axis was conceptually overloaded. Keep them separate so each can grow independently (e.g., chart 2 might gain a real bootstrap fan in the future).

3. **Chart 2's framing is "after reaching the target"** — not "if you retired today." See the design discussion above. Don't change the chart 2 header without checking with the user.

4. **The two text lines below the progress bar (`Falta juntar X` / `Em N anos`)** are load-bearing. They state the canonical answer in Portuguese. The chart is illustrative; the text is the answer. Removing them in favor of the chart breaks the unified framing.

5. **Real-terms accounting.** Don't switch to nominal without rebuilding the inflation model — sliders, defaults, and target formula all assume real terms.

6. **`monthlySavings = revenuesAvg − expensesAvg.avg`, not `expensesAvg.fire_avg`.** Using fire_avg would over-state savings.

7. **Compact mode hides chart and simulators.** The home page summary tile is too small. Always check the `compact` prop before rendering heavy elements.

8. **Sliders without marks but step-snapping.** Marks were explicitly rejected as visually polluting.

9. **Right margin on chart 1 = 90px** — needed to fit the "aposenta aos X anos" reference line label. recharts' label positioning options for `ReferenceLine` don't reliably honor `textAnchor`, so we widen the margin instead of fighting the rendering.

10. **No bootstrap currently.** If you add one, follow the `runBootstrap` / `runAccumulationBootstrap` pattern in `fireBootstrap.ts` — Mulberry32 with `FIXED_SEED = 42`, allocation-weighted historical real returns. Document the addition here and at the call sites.

## The unified-framing rollout (open work)

This same chart shape and "Falta juntar / Em N anos" framing is intended to apply to **all** strategies in the Planning module — not just 1/N. As of writing, only 1/N has been migrated. FIRE / Constant-Dollar already has its own bootstrap-based two-chart split (see `fire-bootstrap-methodology` skill); when extending the others (Dividends-only, VPW, Age-in-Bonds), reuse this skill's design patterns:

- Compute strategy-specific `target` formula.
- Show the same `Falta juntar X` / `Em N anos` text pair.
- Render two charts: accumulation (gap shrinking + patrimônio rising) and drawdown (strategy's signature).
- Pass `avgMonthlySavings` from the same source.
- Add a savings simulator with the live default.

Don't re-litigate the flat-reference-line question per strategy — the rejection generalizes.
