# Constant-Percentage Withdrawal Strategy — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Constant-Percentage withdrawal strategy as a first-class Planning method. Each year the user withdraws `current_balance × rate%` — no inflation adjustment, no bond glide path, no bond bucket. The balance can never reach zero in nominal terms, but real income can drift below today's expenses if returns are weak; the indicator surfaces that risk via a historical bootstrap of withdrawal trajectories.

**Architecture:** Replace the dangling `constant_withdrawal` placeholder key (never wired, semantically misnamed) with a new `constant_percentage` key on backend and frontend. Add a fourth bootstrap variant — `runBootstrapWithPercentageWithdrawal` — that simulates `withdrawal = balance × rate` per year, never depletes nominally, and reports a *real-income-preservation* success rate (fraction of trials where the real withdrawal stayed at or above today's annual expenses for the whole horizon). Build a `ConstantPercentageIndicator` that follows the structural pattern of `ConstantDollarIndicator` but reframes the bar around income coverage rather than FIRE-target progress, since the strategy can't "fail" in the depletion sense.

**Tech Stack:** Django/DRF (backend), React/TypeScript/MUI (frontend), Recharts (charts), TanStack Query (data fetching).

**Pre-reads:**
- `.claude/skills/fire-bootstrap-methodology/SKILL.md` — bootstrap framing, percentile bands, design history. The new variant is a fourth member of that family.
- `react/src/pages/private/Home/fireBootstrap.ts` — existing static, time-varying-weights, and (after the Galeno plan) dynamic-withdrawal entry points.
- `react/src/pages/private/Home/AgeInBondsIndicator.tsx` — already does deterministic `patrimony × rate%` projection with an age glide; structurally the closest existing indicator. The new `ConstantPercentageIndicator` is the bootstrap version of this *minus* the age-glide allocation.
- `react/src/pages/private/Home/ConstantDollarIndicator.tsx` — reference layout for sliders, secondary stats gating, percentile bands chart.
- `react/src/pages/private/Home/VPWIndicator.tsx` — most recent first-class strategy added; shows the wiring pattern across hub card, detail page, home page, strategy content.
- `docs/superpowers/plans/2026-03-16-one-over-n-withdrawal.md` — most-recent reference for end-to-end strategy plumbing.
- `docs/superpowers/plans/2026-04-26-galeno-strategy.md` — sister plan; shares the "promote a placeholder to a real strategy" structure and the bootstrap-variant section format.
- The "Constant-percentage" Bogleheads-style writeup (the reference text the user pasted on 2026-04-26).

---

## Strategy reference

The constant-percentage method is one of the canonical retirement withdrawal rules:

1. **Each year:** `withdrawal = current_balance × rate%`. The rate is fixed (e.g., 4%) — only the *base* changes year-over-year as the portfolio fluctuates.
2. **No inflation adjustment.** Unlike Trinity-style constant-dollar, the user does *not* increment last year's withdrawal by inflation. The method counts on long-term portfolio growth (in real terms) to keep withdrawals from eroding in purchasing power.
3. **The balance never reaches zero in nominal terms.** Each year you take out a fraction; what's left compounds and gets sampled again next year. This is the headline "you'll never run out of money" property.
4. **Real-income failure mode.** What *can* go wrong: in a sustained bear market, `balance × rate` shrinks even in real terms, leaving the user with insufficient real income to cover expenses. There's no protective floor — withdrawals just fluctuate with portfolio value.

The relevant trade-off vs. constant-dollar (FIRE): you trade *predictability* of withdrawal amount for *durability* of the underlying capital. Constant-dollar can deplete the portfolio entirely if the sequence is bad; constant-percentage can't, but can leave you living on a small fraction of today's purchasing power.

The method is a good fit for users with low fixed expenses and year-to-year flexibility in spending.

---

## Naming and key

**Backend / API key:** `constant_percentage`. The existing `constant_withdrawal` placeholder is misleading (in retirement-planning literature "constant withdrawal" canonically means constant-dollar/Trinity, which is already `fire`) and was never wired to anything — it can be removed cleanly. See Task 1.

**UI title:** "Retirada percentual" with subtitle "Retire a mesma porcentagem do seu patrimônio a cada ano — o valor varia conforme o portfólio sobe ou desce." Avoid "Retirada constante" (collides with FIRE) and "% Constante" (collides with the legacy AgeInBondsIndicator label).

---

## Chunk 1: Backend Plumbing

### Task 1: Replace `constant_withdrawal` with `constant_percentage`

**Files:**
- Modify: `django/authentication/serializers.py:110-117` (PlanningPreferencesSerializer.selected_method choices)
- Modify: `django/authentication/serializers.py:231-262` (cross-field validation lists for `show_galeno` and `show_age_in_bonds`)

`constant_withdrawal` appears only in:
1. `selected_method` choices (placeholder — no UI ever produced it),
2. The `show_galeno` allow-list (line 233),
3. The `show_age_in_bonds` allow-list (line 254).

Nothing on the frontend ever sets `selected_method = "constant_withdrawal"`, no test exercises it, and no migration mentions it. Treat it as dead code.

- [ ] **Step 1: Write a failing test**

In `django/authentication/tests/test__user__views.py`, add at the end:

```python
def test__partial_update__planning_preferences__constant_percentage(client, user):
    # GIVEN
    data = {"planning_preferences": {"selected_method": "constant_percentage"}}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    user.refresh_from_db()
    assert user.planning_preferences["selected_method"] == "constant_percentage"


def test__partial_update__planning_preferences__constant_withdrawal_rejected(client, user):
    # GIVEN — the legacy placeholder must no longer be a valid choice
    data = {"planning_preferences": {"selected_method": "constant_withdrawal"}}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == 400
    assert "selected_method" in str(response.json())
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest authentication/tests/test__user__views.py::test__partial_update__planning_preferences__constant_percentage authentication/tests/test__user__views.py::test__partial_update__planning_preferences__constant_withdrawal_rejected -v`
Expected: first FAILS (`constant_percentage` not in choices), second FAILS (`constant_withdrawal` is still accepted).

- [ ] **Step 3: Replace the choice**

In `django/authentication/serializers.py`, replace the choices block at lines 110–118:

```python
class PlanningPreferencesSerializer(serializers.Serializer):
    selected_method = serializers.ChoiceField(
        choices=[
            "fire",
            "dividends_only",
            "constant_percentage",
            "one_over_n",
            "vpw",
        ],
        required=False,
    )
```

- [ ] **Step 4: Update cross-field validation lists**

In the same file, replace `"constant_withdrawal"` with `"constant_percentage"` at lines 233 and 254:

```python
            if merged.get("show_galeno") and merged.get("selected_method") not in (
                "fire",
                "constant_percentage",
                "one_over_n",
                "vpw",
            ):
                raise serializers.ValidationError(
                    {
                        "planning_preferences": {
                            "show_galeno": "Galeno só pode ser ativado com FIRE, Retirada percentual, Retirada 1/N ou VPW."
                        }
                    }
                )
```

```python
            if merged.get("show_age_in_bonds") and merged.get("selected_method") not in (
                "fire",
                "constant_percentage",
            ):
                raise serializers.ValidationError(
                    {
                        "planning_preferences": {
                            "show_age_in_bonds": "Idade em RF só pode ser ativado com FIRE ou Retirada percentual."
                        }
                    }
                )
```

> Note: if the Galeno plan (`docs/superpowers/plans/2026-04-26-galeno-strategy.md`) has already deprecated `show_galeno` server-side, the first block is gone and only the `show_age_in_bonds` update applies.

- [ ] **Step 5: Verify the failing tests now pass**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest authentication/tests/test__user__views.py -v`
Expected: all pass.

- [ ] **Step 6: Data migration for any stale rows**

Even though no UI ever wrote `constant_withdrawal`, a defensive one-shot migration prevents stale `selected_method = "constant_withdrawal"` rows from blowing up validation on the next `PATCH /users/{id}`.

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python manage.py makemigrations authentication --empty --name purge_constant_withdrawal`

Replace the migration body with:

```python
from django.db import migrations


def forwards(apps, schema_editor):
    UserModel = apps.get_model("authentication", "CustomUser")
    for user in UserModel.objects.all():
        prefs = user.planning_preferences or {}
        if prefs.get("selected_method") == "constant_withdrawal":
            prefs.pop("selected_method", None)
            user.planning_preferences = prefs
            user.save(update_fields=("planning_preferences",))


def backwards(apps, schema_editor):
    pass  # we never put it back


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "00XX_previous_migration"),
    ]
    operations = [migrations.RunPython(forwards, backwards)]
```

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python manage.py migrate authentication`
Expected: applies cleanly.

- [ ] **Step 7: Commit**

```bash
git add django/authentication/serializers.py django/authentication/migrations/00XX_purge_constant_withdrawal.py django/authentication/tests/test__user__views.py
git commit -m "refactor(planning): rename placeholder constant_withdrawal to constant_percentage"
```

---

## Chunk 2: Bootstrap with percentage withdrawal

### Task 2: Add `runBootstrapWithPercentageWithdrawal` to fireBootstrap.ts

**Files:**
- Modify: `react/src/pages/private/Home/fireBootstrap.ts` (add new export at end)
- Modify: `react/src/pages/private/Home/fireBootstrap.test.ts` (add test cases)

The existing variants all withdraw a fixed nominal amount per year, or take a `withdrawalAt` callback over a bucketed simulation (Galeno). The constant-percentage method needs neither — withdrawal each year is `balance × rate`, computed from the *current simulated balance* of a single bucket. The headline property: balance is multiplied by `(1 + r)(1 - rate)` each year, so it can shrink without bound but never crosses zero. Depletion-year tracking is therefore meaningless; the relevant failure metric is *real-income preservation*.

- [ ] **Step 1: Write failing tests**

Append to `react/src/pages/private/Home/fireBootstrap.test.ts`:

```typescript
import { runBootstrapWithPercentageWithdrawal } from "./fireBootstrap";

describe("runBootstrapWithPercentageWithdrawal", () => {
  it("never reports nominal depletion (balance > 0 always)", () => {
    const result = runBootstrapWithPercentageWithdrawal({
      startingBalance: 1_000_000,
      rate: 0.04,
      horizon: 50,
      weights: { equity: 1, ifix: 0, fixedIncome: 0 },
      annualExpenseTarget: 0,
      numTrials: 200,
    });
    // Final-year p10 must be strictly positive — multiplicative shrinkage
    // can't cross zero.
    const finalBand = result.bands[result.bands.length - 1];
    expect(finalBand.p10).toBeGreaterThan(0);
  });

  it("reports a real-income success rate gated on annualExpenseTarget", () => {
    // 2% rate + a 10M starting balance always covers a 100k expense target.
    const wins = runBootstrapWithPercentageWithdrawal({
      startingBalance: 10_000_000,
      rate: 0.02,
      horizon: 30,
      weights: { equity: 0.6, ifix: 0, fixedIncome: 0.4 },
      annualExpenseTarget: 100_000,
      numTrials: 200,
    });
    expect(wins.successRate).toBeGreaterThan(0.95);

    // 2% rate on a small balance can never cover a huge target.
    const losses = runBootstrapWithPercentageWithdrawal({
      startingBalance: 100_000,
      rate: 0.02,
      horizon: 30,
      weights: { equity: 0.6, ifix: 0, fixedIncome: 0.4 },
      annualExpenseTarget: 100_000,
      numTrials: 200,
    });
    expect(losses.successRate).toBe(0);
  });

  it("returns withdrawalBands and balanceBands of length horizon+1", () => {
    const result = runBootstrapWithPercentageWithdrawal({
      startingBalance: 1_000_000,
      rate: 0.04,
      horizon: 30,
      weights: { equity: 0.6, ifix: 0, fixedIncome: 0.4 },
      annualExpenseTarget: 40_000,
      numTrials: 100,
    });
    expect(result.bands.length).toBe(31);
    expect(result.withdrawalBands.length).toBe(30); // year 1..horizon
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx vitest run src/pages/private/Home/fireBootstrap.test.ts`
Expected: FAIL — `runBootstrapWithPercentageWithdrawal` is not exported.

- [ ] **Step 3: Implement the variant**

Append to `react/src/pages/private/Home/fireBootstrap.ts`:

```typescript
export type PercentageWithdrawalParams = {
  startingBalance: number;
  rate: number;            // fraction, e.g. 0.04 for 4%
  horizon: number;
  weights: AllocationWeights;
  // Real annual expenses, used for the success criterion. The bootstrap draws
  // *real* historical returns, so balance is in real BRL — comparing
  // `balance × rate` against today's real annualExpenses is apples-to-apples.
  // Pass 0 to disable the success criterion (every trial counts as success).
  annualExpenseTarget: number;
  numTrials?: number;
};

export type PercentageBootstrapResult = {
  successRate: number;             // fraction of trials where every-year withdrawal ≥ annualExpenseTarget
  realIncomeYearRate: number;      // fraction of all year-trials (not whole-trials) where withdrawal ≥ annualExpenseTarget — softer signal
  bands: BootstrapBand[];          // balance percentiles, year 0..horizon
  withdrawalBands: BootstrapBand[]; // withdrawal percentiles, year 1..horizon
  // First-shortfall stats: across trials, the year (1..horizon) where the
  // simulated withdrawal first dropped below annualExpenseTarget. null per trial
  // means it never did. The aggregates are over the trials that *did* shortfall.
  medianFirstShortfallYear: number | null;
  p10FirstShortfallYear: number | null;
};

const runPercentageTrial = (
  params: PercentageWithdrawalParams,
  rng: () => number,
): { firstShortfall: number | null; balances: number[]; withdrawals: number[]; allYearsCovered: boolean; coveredYears: number } => {
  const { startingBalance, rate, horizon, weights, annualExpenseTarget } = params;
  let balance = startingBalance;
  const balances = [balance];
  const withdrawals: number[] = [];
  let firstShortfall: number | null = null;
  let allYearsCovered = true;
  let coveredYears = 0;

  for (let y = 1; y <= horizon; y++) {
    balance = balance * (1 + drawBlendedReturn(weights, rng));
    const withdrawal = balance * rate;
    balance -= withdrawal;
    withdrawals.push(withdrawal);
    balances.push(balance);

    if (annualExpenseTarget > 0) {
      if (withdrawal >= annualExpenseTarget) {
        coveredYears++;
      } else {
        allYearsCovered = false;
        if (firstShortfall === null) firstShortfall = y;
      }
    } else {
      coveredYears++;
    }
  }
  return { firstShortfall, balances, withdrawals, allYearsCovered, coveredYears };
};

export const runBootstrapWithPercentageWithdrawal = (
  params: PercentageWithdrawalParams,
): PercentageBootstrapResult => {
  const numTrials = params.numTrials ?? 2000;
  if (params.startingBalance <= 0 || params.horizon <= 0 || params.rate <= 0) {
    return {
      successRate: 0,
      realIncomeYearRate: 0,
      bands: [],
      withdrawalBands: [],
      medianFirstShortfallYear: null,
      p10FirstShortfallYear: null,
    };
  }

  const rng = mulberry32(FIXED_SEED);
  const trials = Array.from({ length: numTrials }, () => runPercentageTrial(params, rng));

  const successRate =
    params.annualExpenseTarget > 0
      ? trials.filter((t) => t.allYearsCovered).length / numTrials
      : 1;
  const totalCoveredYears = trials.reduce((sum, t) => sum + t.coveredYears, 0);
  const totalYears = numTrials * params.horizon;
  const realIncomeYearRate = totalYears > 0 ? totalCoveredYears / totalYears : 0;

  const bands: BootstrapBand[] = [];
  for (let y = 0; y <= params.horizon; y++) {
    const sorted = trials.map((t) => t.balances[y]).sort((a, b) => a - b);
    bands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  const withdrawalBands: BootstrapBand[] = [];
  for (let y = 1; y <= params.horizon; y++) {
    const sorted = trials.map((t) => t.withdrawals[y - 1]).sort((a, b) => a - b);
    withdrawalBands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  const shortfallYears = trials
    .map((t) => t.firstShortfall)
    .filter((y): y is number => y !== null)
    .sort((a, b) => a - b);
  const medianFirstShortfallYear =
    shortfallYears.length > 0 ? shortfallYears[Math.floor(shortfallYears.length / 2)] : null;
  const p10FirstShortfallYear =
    shortfallYears.length >= numTrials * 0.1
      ? shortfallYears[Math.floor(numTrials * 0.1)]
      : null;

  return {
    successRate,
    realIncomeYearRate,
    bands,
    withdrawalBands,
    medianFirstShortfallYear,
    p10FirstShortfallYear,
  };
};
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx vitest run src/pages/private/Home/fireBootstrap.test.ts`
Expected: PASS, all three new cases.

- [ ] **Step 5: Commit**

```bash
git add react/src/pages/private/Home/fireBootstrap.ts react/src/pages/private/Home/fireBootstrap.test.ts
git commit -m "feat(planning): add percentage-withdrawal bootstrap variant"
```

### Task 3: Update fire-bootstrap-methodology skill

**Files:**
- Modify: `.claude/skills/fire-bootstrap-methodology/SKILL.md`

- [ ] **Step 1: Add a "Percentage-withdrawal variant (Constant-Percentage)" section**

Place it after the dynamic-withdrawal (Galeno) section. Cover:
- The trial loop is single-bucket (like the static-weights variant) but the withdrawal each year is `balance × rate` rather than a fixed amount.
- The mathematical consequence: the balance evolves multiplicatively as `balance × (1 + r)(1 - rate)` and never crosses zero. Depletion-year reporting is intentionally absent because it's not a real failure mode — the *real* failure mode is the user's withdrawal dropping below today's expenses for one or more years.
- Two success metrics, reported separately:
  - `successRate`: fraction of trials where the real withdrawal stayed at or above `annualExpenseTarget` for **every** year of the horizon. The conservative criterion.
  - `realIncomeYearRate`: fraction of *all year-trials* (numTrials × horizon) where the withdrawal cleared the target. The softer aggregate; useful when the user accepts occasional shortfall years.
- `medianFirstShortfallYear` and `p10FirstShortfallYear` give the timing distribution of when shortfalls first happen, computed only over trials that actually shortfall.
- Why we don't compute a `findSafeWithdrawalRate` here: the strategy can't deplete, so the binary-search target ("highest rate where success ≥ 95%") would land on whatever rate happens to produce withdrawals above expenses 95% of the time — which is a function of `startingBalance / annualExpenseTarget`, not of the rate alone. The right horizon-/allocation-aware reference is *not* SWR-style; it would be "what starting balance / rate ratio is enough?". Defer until needed.

- [ ] **Step 2: Append to "Things to preserve":**

> 9. **Don't add a depletion-year metric to the percentage-withdrawal variant.** It can't deplete. Reporting `medianDepletionYear: null` everywhere would be misleading clutter; the variant returns shortfall-year metrics instead, which capture the strategy's actual failure mode.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/fire-bootstrap-methodology/SKILL.md
git commit -m "docs(skill): document percentage-withdrawal bootstrap variant"
```

---

## Chunk 3: ConstantPercentageIndicator component

### Task 4: Build the indicator

**Files:**
- Create: `react/src/pages/private/Home/ConstantPercentageIndicator.tsx`

Mirrors the structural layout of `ConstantDollarIndicator.tsx`. The bar reframes around income coverage rather than FIRE-target progress because the strategy can't "fail" in the depletion sense.

- [ ] **Step 1: Define props and the math layer**

Create `react/src/pages/private/Home/ConstantPercentageIndicator.tsx`:

```typescript
import { useMemo, useState } from "react";

import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";
import { sliderSx } from "./consts";
import PatrimonySimulator from "./PatrimonySimulator";
import {
  computeWeights,
  runBootstrapWithPercentageWithdrawal,
  type BootstrapBand,
} from "./fireBootstrap";

const ProgressBar = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral600),
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 10,
    backgroundColor:
      value && value >= 100 ? getColor(Colors.brand) : getColor(Colors.danger200),
  },
}));

const numberTickFormatter = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const ChartTooltipContent = ({
  active,
  payload,
  hideValues,
}: {
  active?: boolean;
  payload?: { payload: BootstrapBand }[];
  hideValues?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <Stack
      spacing={0.5}
      sx={{
        border: "1px solid",
        p: 1,
        borderColor: getColor(Colors.brand400),
        backgroundColor: getColor(Colors.neutral600),
      }}
    >
      <p style={{ color: getColor(Colors.neutral300) }}>Ano {data.year}</p>
      <p style={{ color: getColor(Colors.danger200) }}>
        Pessimista (p10): {hideValues ? "***" : formatCurrency(data.p10)}/ano
      </p>
      <p style={{ color: getColor(Colors.brand200) }}>
        Mediana (p50): {hideValues ? "***" : formatCurrency(data.p50)}/ano
      </p>
      <p style={{ color: getColor(Colors.brand) }}>
        Otimista (p90): {hideValues ? "***" : formatCurrency(data.p90)}/ano
      </p>
    </Stack>
  );
};

type Props = {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  withdrawalRate: number;
  onWithdrawalRateChange: (value: number) => void;
  targetYears: number;
  onTargetYearsChange: (value: number) => void;
  equityTotal: number;
  ifixTotal: number;
  fixedIncomeTotal: number; // RF + bank, like ConstantDollarIndicator
  compact?: boolean;
  hideLabel?: boolean;
};

const ConstantPercentageIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  withdrawalRate,
  onWithdrawalRateChange,
  targetYears,
  onTargetYearsChange,
  equityTotal,
  ifixTotal,
  fixedIncomeTotal,
  compact = false,
  hideLabel = false,
}: Props) => {
  const { hideValues } = useHideValues();
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);
  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;

  const annualExpenses = avgExpenses * 12;
  const annualWithdrawal = effectivePatrimony * (withdrawalRate / 100);
  const monthlyWithdrawal = annualWithdrawal / 12;

  // Bar = today's withdrawal vs today's expenses. ≥ 100 % means "the strategy
  // covers your lifestyle right now". Unlike FIRE, there's no "FIRE number" to
  // be a fraction of — the strategy never depletes, so the relevant question
  // shifts from "do I have enough capital?" to "is the income enough?".
  const coverage = annualExpenses > 0 ? (annualWithdrawal / annualExpenses) * 100 : 0;

  const weights = useMemo(
    () => computeWeights(equityTotal, ifixTotal, fixedIncomeTotal),
    [equityTotal, ifixTotal, fixedIncomeTotal],
  );

  const bootstrap = useMemo(
    () =>
      runBootstrapWithPercentageWithdrawal({
        startingBalance: effectivePatrimony,
        rate: withdrawalRate / 100,
        horizon: targetYears,
        weights,
        annualExpenseTarget: annualExpenses,
      }),
    [effectivePatrimony, withdrawalRate, targetYears, weights, annualExpenses],
  );

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }
```

- [ ] **Step 2: Implement the render**

Append to the component body:

```typescript
  const monthlyWithdrawalLabel = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const monthlyExpensesLabel = hideValues ? "***" : formatCurrency(avgExpenses);
  const tooltipTitle =
    `Retire ${withdrawalRate}% do patrimônio a cada ano. ` +
    `Hoje: ${monthlyWithdrawalLabel}/mês. Despesas: ${monthlyExpensesLabel}/mês. ` +
    `Probabilidade histórica de manter renda real ≥ despesas em ` +
    `${targetYears} anos: ${(bootstrap.successRate * 100).toFixed(0)}%.`;

  const firstShortfallLabel = bootstrap.medianFirstShortfallYear ?? `${targetYears}+`;
  const p10ShortfallLabel = bootstrap.p10FirstShortfallYear ?? `${targetYears}+`;

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <ProgressBar variant="determinate" value={Math.min(coverage, 100)} />
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              transform: "translateY(-50%)",
              px: 1.5,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
            }}
          >
            {!hideLabel && (
              <Text color={Colors.neutral0} weight={FontWeights.MEDIUM} size={FontSizes.SEMI_SMALL}>
                Retirada percentual
              </Text>
            )}
            {hideValues ? (
              <Skeleton sx={{ bgcolor: getColor(Colors.neutral300), width: "60px" }} animation={false} />
            ) : (
              <Text color={Colors.neutral0} weight={FontWeights.SEMI_BOLD} size={FontSizes.SEMI_SMALL}>
                {coverage.toFixed(0)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {(() => {
            const gap = monthlyWithdrawal - avgExpenses;
            const gapFormatted = hideValues ? "***" : formatCurrency(Math.abs(gap));
            const sign = gap >= 0 ? "sobram" : "faltam";
            return `Retirada: ${monthlyWithdrawalLabel}/mês · Despesas: ${monthlyExpensesLabel}/mês (${sign}: ${gapFormatted}/mês)`;
          })()}
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Taxa: {withdrawalRate}% a.a.
        </Text>
        <Slider
          value={withdrawalRate}
          onChange={(_, v) => onWithdrawalRateChange(v as number)}
          min={2}
          max={8}
          step={0.5}
          size="medium"
          sx={sliderSx}
        />
        {!compact && (
          <>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Horizonte: {targetYears} anos
            </Text>
            <Slider
              value={targetYears}
              onChange={(_, v) => onTargetYearsChange(v as number)}
              min={20}
              max={80}
              step={5}
              size="medium"
              sx={sliderSx}
            />
            <PatrimonySimulator
              value={effectivePatrimony}
              onChange={setSimulatedPatrimony}
              onReset={() => setSimulatedPatrimony(null)}
              patrimonyTotal={patrimonyTotal}
              showReset={simulatedPatrimony !== null}
            />
          </>
        )}
      </Stack>
      {!compact && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Renda real ≥ despesas todos os anos: {(bootstrap.successRate * 100).toFixed(0)}% ·
            anos cobertos: {(bootstrap.realIncomeYearRate * 100).toFixed(0)}% ·
            primeira queda p10: {p10ShortfallLabel} anos · mediana: {firstShortfallLabel} anos
          </Text>
        </Stack>
      )}
      {!compact && bootstrap.withdrawalBands.length > 1 && (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={bootstrap.withdrawalBands} margin={{ top: 10, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="5" vertical={false} />
            <XAxis dataKey="year" stroke={getColor(Colors.neutral0)} tickLine={false} />
            <YAxis
              stroke={getColor(Colors.brand400)}
              tickLine={false}
              axisLine={false}
              tickFormatter={numberTickFormatter}
              tickCount={hideValues ? 0 : undefined}
            />
            <RechartsTooltip cursor={false} content={<ChartTooltipContent hideValues={hideValues} />} />
            <Line type="monotone" dataKey="p10" stroke={getColor(Colors.danger200)} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="p10 retirada anual" />
            <Line type="monotone" dataKey="p50" stroke={getColor(Colors.brand200)} strokeWidth={2} dot={false} name="Mediana retirada anual" />
            <Line type="monotone" dataKey="p90" stroke={getColor(Colors.brand)} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="p90 retirada anual" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Stack>
  );
};

export default ConstantPercentageIndicator;
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add react/src/pages/private/Home/ConstantPercentageIndicator.tsx
git commit -m "feat(planning): add ConstantPercentageIndicator with percentage-withdrawal bootstrap"
```

---

## Chunk 4: Frontend Plumbing

### Task 5: Extend types and rename `constant_withdrawal` → `constant_percentage`

**Files:**
- Modify: `react/src/pages/private/Planning/api.ts:3-4`

- [ ] **Step 1: Replace the placeholder**

```typescript
export type WithdrawalMethodKey =
  | "fire"
  | "dividends_only"
  | "constant_percentage"
  | "one_over_n"
  | "vpw";
export type ActiveMethodKey =
  | "fire"
  | "dividends_only"
  | "constant_percentage"
  | "one_over_n"
  | "vpw";
```

Note: this plan promotes `constant_percentage` straight into `ActiveMethodKey` (not the placeholder slot's previous purgatory). If the Galeno plan has already added `"galeno"` to `ActiveMethodKey`, include it here:

```typescript
export type ActiveMethodKey =
  | "fire"
  | "dividends_only"
  | "constant_percentage"
  | "one_over_n"
  | "vpw"
  | "galeno";
```

- [ ] **Step 2: Search-and-update remaining frontend references**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react/src && grep -rn "constant_withdrawal"`
Expected: zero results after the api.ts edit. If any string literals remain (older test fixtures, dead code), purge them.

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: exit 0. The new `constant_percentage` member of `ActiveMethodKey` will trigger a type error wherever the `STRATEGY_CONTENT` record or any exhaustive switch is missing the case — that's expected; the next tasks fill those in.

- [ ] **Step 4: Don't commit yet** — leave the type-error breadcrumb for the next tasks to consume.

### Task 6: Add the strategy content entry

**Files:**
- Modify: `react/src/pages/private/Planning/strategyContent.tsx` (add `constant_percentage` entry to STRATEGY_CONTENT)

- [ ] **Step 1: Add the entry**

Insert inside `STRATEGY_CONTENT`, between `dividends_only` and `one_over_n` (or wherever the existing key order suggests). Concrete copy:

```typescript
constant_percentage: {
  title: "Retirada percentual",
  subtitle:
    "Retire a mesma porcentagem do seu patrimônio a cada ano — o valor varia " +
    "conforme o portfólio sobe ou desce.",
  rationale: (
    <>
      <p>
        Esse método funciona assim: a cada ano, você retira uma porcentagem
        fixa do <em>valor atual</em> da carteira. Como o valor da sua carteira
        muda ano a ano com as oscilações do mercado, o valor em reais que você
        retira também flutua.
      </p>
      <p>
        Diferente do método FIRE (constante-dólar), essa retirada não é
        ajustada anualmente pela inflação. A premissa é que, no longo prazo, o
        crescimento real do portfólio compensa a inflação automaticamente.
      </p>
      <p>
        Exemplo: carteira de R$ 1.000.000 e taxa de 4% a.a. → primeira retirada
        de R$ 40.000 (R$ 3.333/mês). Se a carteira cair para R$ 800.000 no ano
        seguinte, a nova retirada será R$ 32.000 (R$ 2.666/mês). Se subir para
        R$ 1.200.000, a retirada será R$ 48.000 (R$ 4.000/mês).
      </p>
      <p>
        A grande vantagem é que sua carteira <strong>nunca chega a zero em
        termos nominais</strong>: como você sempre retira uma fração, sempre
        sobra alguma coisa. A desvantagem é que, em mercados ruins prolongados,
        sua renda real pode ficar abaixo das suas despesas — o método não
        oferece um piso garantido.
      </p>
      <p>
        Você pode preferir esse método se tem despesas fixas baixas e
        flexibilidade para gastar menos em anos ruins.
      </p>
    </>
  ),
  defaultsExplained: [
    {
      label: "O que significa a porcentagem na barra de progresso",
      explanation:
        "A barra mostra cobertura: retirada anual ÷ despesas anuais × 100. " +
        "≥ 100% significa que a retirada da estratégia hoje cobre suas " +
        "despesas. Diferente do FIRE, não há uma 'meta de FIRE' — a " +
        "estratégia nunca falha por depleção; o que pode falhar é a renda " +
        "ficar abaixo das despesas em algum ano.",
    },
    {
      label: "Probabilidade histórica de manter renda ≥ despesas",
      explanation:
        "Simulamos 2.000 cenários históricos (séries reais NEFIN/IFIX/risk-" +
        "free) e contamos a fração em que a retirada simulada manteve-se ≥ " +
        "despesas atuais por TODOS os anos do horizonte. É um critério " +
        "rígido — também mostramos a fração de anos cobertos no agregado.",
    },
    {
      label: "Primeira queda (p10/mediana)",
      explanation:
        "Em cenários onde houve queda da renda abaixo das despesas, " +
        "mostramos quando essa primeira queda costuma acontecer. p10 é o " +
        "10º percentil (a queda mais cedo entre os piores cenários); a " +
        "mediana é o ponto típico.",
    },
  ],
  pros: [
    { text: "Carteira nunca chega a zero em termos nominais — você sempre tem algo" },
    { text: "Implementação trivial: multiplique o saldo pela taxa e pronto" },
    { text: "Ajusta-se automaticamente ao tamanho da carteira sem decisões anuais" },
    { text: "Não depende de premissas inflacionárias rígidas" },
  ],
  cons: [
    { text: "Renda em reais varia muito ano a ano — exige flexibilidade no orçamento" },
    { text: "Em mercados ruins, sua renda real pode cair abaixo das despesas atuais" },
    { text: "Sem piso de proteção — não há mecanismo automático para sustentar despesas mínimas" },
    { text: "Pode acumular sobra grande em vez de gastar (fim de vida com patrimônio inutilizado)" },
  ],
},
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: still failing — switch cases in `StrategyDetailPage` and `Indicators.tsx` haven't been added. Continue to Task 7.

### Task 7: Add the Planning Hub card

**Files:**
- Modify: `react/src/pages/private/Planning/PlanningHub.tsx`

- [ ] **Step 1: Add the card**

Read the file to find the array/list of strategy cards and add a `constant_percentage` entry following the same shape as `vpw`. Place it in the same logical order as `STRATEGY_CONTENT` (between `dividends_only` and `one_over_n`).

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: closer to clean — only switch-case branches remain.

### Task 8: Wire ConstantPercentageIndicator into StrategyDetailPage

**Files:**
- Modify: `react/src/pages/private/Planning/StrategyDetailPage.tsx`

- [ ] **Step 1: Add state and import**

Add at the top of the imports:

```typescript
import ConstantPercentageIndicator from "../Home/ConstantPercentageIndicator";
```

Add new state hooks alongside the existing `fireWithdrawalRate` / `targetYears`:

```typescript
const [percentageRate, setPercentageRate] = useState(4);
const [percentageTargetYears, setPercentageTargetYears] = useState(30);
```

- [ ] **Step 2: Add the case branch in the indicator switch**

Inside the `switch (method)` block in the `indicator` IIFE, add:

```typescript
case "constant_percentage":
  return (
    <ConstantPercentageIndicator
      patrimonyTotal={patrimonyTotal}
      avgExpenses={avgExpenses}
      isLoading={isDataLoading || isReportsLoading}
      withdrawalRate={percentageRate}
      onWithdrawalRateChange={setPercentageRate}
      targetYears={percentageTargetYears}
      onTargetYearsChange={setPercentageTargetYears}
      equityTotal={equityTotal}
      ifixTotal={ifixTotal}
      fixedIncomeTotal={fixedIncomeTotal + bankAmount}
    />
  );
```

- [ ] **Step 3: Update `AGE_IN_BONDS_METHODS` if you want the toggle available**

The backend already allows `show_age_in_bonds` on `constant_percentage`. To match, add `"constant_percentage"` to the frontend allow-list:

```typescript
const AGE_IN_BONDS_METHODS: ActiveMethodKey[] = ["fire", "constant_percentage"];
```

> Heads-up: the existing `AgeInBondsIndicator` (deterministic, no bootstrap) was originally written as a constant-percentage strategy with an age glide. Combining the new `constant_percentage` strategy with the age-in-bonds toggle reproduces what `AgeInBondsIndicator` does — so the toggle naturally works here. If we want this combination to use a bootstrap (consistent with `ConstantDollarAgeInBondsIndicator`), it's a follow-up; this plan keeps the legacy `AgeInBondsIndicator` rendering for the combined case.

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit the whole frontend chunk**

```bash
git add react/src/pages/private/Planning/api.ts \
        react/src/pages/private/Planning/strategyContent.tsx \
        react/src/pages/private/Planning/PlanningHub.tsx \
        react/src/pages/private/Planning/StrategyDetailPage.tsx
git commit -m "feat(planning): add Retirada percentual strategy (constant_percentage) end to end"
```

### Task 9: Wire ConstantPercentageIndicator into the home Indicators panel

**Files:**
- Modify: `react/src/pages/private/Home/Indicators.tsx`

- [ ] **Step 1: Add state and import**

```typescript
import ConstantPercentageIndicator from "./ConstantPercentageIndicator";
```

```typescript
const [percentageRate, setPercentageRate] = useState(4);
const [percentageTargetYears, setPercentageTargetYears] = useState(30);
```

- [ ] **Step 2: Add the branch in the `selectedMethod` switch**

Inside the `{...}[selectedMethod]` map literal, add:

```typescript
constant_percentage: (
  <ConstantPercentageIndicator
    patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
    avgExpenses={expensesIndicators?.fire_avg ?? 0}
    isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
    withdrawalRate={percentageRate}
    onWithdrawalRateChange={setPercentageRate}
    targetYears={percentageTargetYears}
    onTargetYearsChange={setPercentageTargetYears}
    equityTotal={equityTotal}
    ifixTotal={ifixTotal}
    fixedIncomeTotal={fixedIncomeTotal + bankAmount}
    compact
  />
),
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add react/src/pages/private/Home/Indicators.tsx
git commit -m "feat(planning): render ConstantPercentageIndicator on home page"
```

---

## Chunk 5: Verification

### Task 10: Manual smoke test

- [ ] **Step 1: Start dev servers**

```bash
cd django && python manage.py runserver 8000 &
cd react && npm run dev &
```

- [ ] **Step 2: Walk the user flows**

Open the app and verify:

1. **Planning Hub** shows a "Retirada percentual" card alongside FIRE, Dividends-only, 1/N, VPW (and Galeno if that plan landed first).
2. **Detail page** renders the new indicator. Sliders move the bar (coverage), the bootstrap success rate, and the chart. With `rate = 4%`, `targetYears = 30`, a realistic patrimony and expenses, the bar shows a sensible coverage percentage and the chart shows three percentile bands of *withdrawal amount* over the horizon.
3. **Selecting Retirada percentual as active strategy** persists across reload.
4. **Home page** with `selectedMethod = "constant_percentage"` shows the compact indicator.
5. **Idade-em-RF toggle** is available on the strategy detail page (since `AGE_IN_BONDS_METHODS` was extended). Toggling it on swaps to the legacy `AgeInBondsIndicator` (or deterministic projection — current behavior).
6. **No legacy `constant_withdrawal` references** are reachable from the UI: the Planning Hub no longer offers it, and selecting any strategy persists with the new `constant_percentage` value.
7. **Bootstrap honesty check:** at high rates (e.g., 8%) and short horizons (e.g., 20y), success rate should drop noticeably; at low rates (e.g., 2%) success should approach 100%. Confirm the success metric is responsive to the slider, not pinned.

- [ ] **Step 3: Commit any small fixes uncovered**

If smoke testing surfaces issues, fix them and commit. If not, no commit needed.

### Task 11: Run the full test suite

- [ ] **Step 1: Backend**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest -x`
Expected: all pass.

- [ ] **Step 2: Frontend**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit && npx vitest run`
Expected: tsc exits 0, vitest reports green.

- [ ] **Step 3: Commit fixes if needed**

```bash
git commit -am "chore: address constant-percentage strategy regressions"
```

---

## Open questions to resolve before starting

1. **Slider range for `withdrawalRate`.** This plan uses `2..8` step `0.5`, matching `AgeInBondsIndicator`. `ConstantDollarIndicator` uses `2..6` because Trinity research caps there. Constant-percentage is more forgiving (no depletion) so a wider range is defensible — but cap at 8% to discourage clearly-unsafe-for-real-income inputs.

2. **Whether to expose `realIncomeYearRate` separately from `successRate`.** Both are reported by the bootstrap, but `successRate` is the headline conservative number. `realIncomeYearRate` is softer — fraction of all year-trials covered, not all-or-nothing per trial. The plan shows both. If we want only one in the UI, prefer the all-or-nothing one: it matches the reading users will give it ("did this strategy work?") more naturally than the year-aggregate.

3. **Idade-em-RF toggle interaction.** `AgeInBondsIndicator` was originally written as the constant-percentage method *with* an age glide. Should `constant_percentage` + `show_age_in_bonds` route to:
   - (a) the legacy `AgeInBondsIndicator` (deterministic, no bootstrap), as Task 8 specifies — preserves existing behavior, but the new strategy's bootstrap rigor is lost when the toggle is on; or
   - (b) a new `ConstantPercentageAgeInBondsIndicator` that bootstraps the percentage method *with* a time-varying glide via `runBootstrapWithVaryingWeights` — consistent with how the FIRE side now treats Idade-em-RF.

   Option (b) is the cleaner long-term answer. Defer to follow-up unless there's appetite to do it in this same plan.

4. **Backend choice cleanup.** The plan strips `constant_withdrawal` from `selected_method` choices and migrates any stale rows. Confirm with `python manage.py shell` that no production user has `selected_method = "constant_withdrawal"` before deploying — the migration handles it, but a pre-deploy count is reassuring.

5. **`AgeInBondsIndicator` may also need its label updated.** It currently displays "% Constante (Idade em RF)". With `constant_percentage` taking the "% constante" semantic real estate, consider renaming the toggled view to "Retirada percentual (Idade em RF)" for consistency. Cosmetic, not blocking.
