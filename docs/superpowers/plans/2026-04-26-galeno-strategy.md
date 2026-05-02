# Galeno Withdrawal Strategy — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Galeno from a buffer-tracking add-on toggle into a first-class withdrawal strategy with its own dynamic withdrawal rule (`withdrawal = bond_total / N`), a dedicated indicator that runs a historical bootstrap of the strategy's actual mechanics, and full Planning Hub integration alongside `fire` / `dividends_only` / `one_over_n` / `vpw`.

**Architecture:** Add `"galeno"` as a new `ActiveMethodKey` (frontend) and a new choice in `PlanningPreferencesSerializer.selected_method` (backend). Build a new `GalenoStrategyIndicator` component that reuses the time-varying-weights bootstrap infrastructure from `fireBootstrap.ts`, extended with a new variant that sources the per-year withdrawal from the simulated bond bucket rather than from a fixed annual amount. The existing `GalenoIndicator` (buffer/runway tracker) becomes a *secondary* indicator shown when the user is still in the accumulation phase.

**Tech Stack:** Django/DRF (backend), React/TypeScript/MUI (frontend), Recharts (charts), TanStack Query (data fetching).

**Pre-reads:**
- `.claude/skills/fire-bootstrap-methodology/SKILL.md` — bootstrap framing, percentile bands, the gate-on-fireProgress-≥-100 design, the time-varying-weights variant.
- `react/src/pages/private/Home/fireBootstrap.ts` — existing static + time-varying entry points.
- `react/src/pages/private/Home/ConstantDollarIndicator.tsx` — reference layout for a fully-featured FIRE indicator.
- `react/src/pages/private/Home/VPWIndicator.tsx` — most recent strategy added; shows the wiring pattern (Planning Hub card, StrategyDetailPage indicator, Indicators.tsx home-page indicator, strategyContent.tsx copy).
- `docs/superpowers/plans/2026-03-16-one-over-n-withdrawal.md` — most-recent reference for end-to-end strategy plumbing (backend choices, serializer validation, planning preferences hooks, frontend hub card, detail page).
- The "Combination" / "Galeno Strategy" writeup (Bogleheads-style) describing the actual mechanics — see "Strategy reference" below.

---

## Strategy reference

The Galeno withdrawal method is a *complete* alternative to constant-dollar and constant-percentage:

1. **Initial setup.** Allocate the portfolio so the bond bucket holds `N` years of expenses (`N = 7.5` in the canonical writeup). Whatever is left goes to stocks.
2. **Each year:** sell `transferRate%` of the *current* stock allocation; the proceeds move into bonds.
3. **Withdrawal that year:** `bond_total / N`. The user lives on this; expenses are not the input — the bond bucket's current size is.
4. The dynamic transfer + N-year averaging is what gives the method its two literature-promised properties:
   - **Tracks portfolio value:** bull markets grow the bond bucket faster (bigger transfers from a bigger stock pile), so withdrawals rise. Bear markets shrink it, so withdrawals fall.
   - **Smooths fluctuations:** the `/N` averaging dampens year-to-year volatility into something liveable.

The current `GalenoIndicator.tsx` only models the *accumulation runway* ("how long until my bond bucket reaches `N × expenses`?") and is driven by static UI inputs, not by a return simulation. It is silent on the withdrawal rule (step 3) and on the dynamic adjustment (steps 2–4 in retirement). Promoting Galeno to a strategy means modeling all of it.

---

## Chunk 1: Backend Plumbing

### Task 1: Add `"galeno"` to selected_method choices

**Files:**
- Modify: `django/authentication/serializers.py:110-118` (PlanningPreferencesSerializer.selected_method choices)
- Modify: `django/authentication/serializers.py:231-244` (show_galeno cross-field validation — see Step 4)

- [ ] **Step 1: Write failing test**

In `django/authentication/tests/test__user__views.py`, add at the end:

```python
def test__partial_update__planning_preferences__galeno(client, user):
    # GIVEN
    data = {"planning_preferences": {"selected_method": "galeno"}}

    # WHEN
    response = client.patch(f"{URL}/{user.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    user.refresh_from_db()
    assert user.planning_preferences["selected_method"] == "galeno"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest authentication/tests/test__user__views.py::test__partial_update__planning_preferences__galeno -v`
Expected: FAIL — `"galeno"` is not a valid choice.

- [ ] **Step 3: Add the choice**

In `django/authentication/serializers.py`, replace the choices list at line 111–117:

```python
class PlanningPreferencesSerializer(serializers.Serializer):
    selected_method = serializers.ChoiceField(
        choices=[
            "fire",
            "dividends_only",
            "constant_withdrawal",
            "one_over_n",
            "vpw",
            "galeno",
        ],
        required=False,
    )
```

- [ ] **Step 4: Decide on `show_galeno` interaction**

The legacy add-on toggle `show_galeno` still exists in the serializer and is validated against the legacy `GALENO_METHODS` list (`fire`, `constant_withdrawal`, `one_over_n`, `vpw`). With Galeno becoming its own strategy, the add-on toggle is conceptually retired — keeping it would let a user pick `selected_method = "galeno"` AND tick `show_galeno` against another method, which double-shows the indicator.

Choose one:

- **Option A (recommended):** Hard-fail server-side. Replace the cross-field check at lines 231–244 with: `if merged.get("show_galeno"): raise ValidationError("show_galeno is deprecated; pick selected_method='galeno' instead")`. Migrate any user with `show_galeno: True` to `selected_method: "galeno"` in a one-shot data migration (see Task 2).
- **Option B:** Silently coerce `show_galeno: True` → `selected_method: "galeno"` server-side and clear the boolean. Easier for clients but hides the deprecation.

This plan assumes Option A. Document the decision in the commit message.

- [ ] **Step 5: Update tests that exercised `show_galeno`**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest authentication/tests/test__user__views.py -k "galeno" -v`
Expected: existing `show_galeno` tests now fail with the new validation error. Update them to pass `{"selected_method": "galeno"}` instead, OR add a `test__partial_update__planning_preferences__show_galeno_deprecated` that asserts the 400 response.

- [ ] **Step 6: Run all authentication tests**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest authentication/tests/test__user__views.py -v`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add django/authentication/serializers.py django/authentication/tests/test__user__views.py
git commit -m "feat(planning): add 'galeno' as selectable strategy and deprecate show_galeno toggle"
```

### Task 2: Data migration for existing `show_galeno: True` users

**Files:**
- Create: `django/authentication/migrations/00XX_migrate_show_galeno_to_selected_method.py`

- [ ] **Step 1: Generate empty migration**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python manage.py makemigrations authentication --empty --name migrate_show_galeno_to_selected_method`
Expected: empty migration file created. Note the number it gets — substitute for `00XX` below.

- [ ] **Step 2: Write the migration**

Replace the empty migration body with:

```python
from django.db import migrations


def forwards(apps, schema_editor):
    UserModel = apps.get_model("authentication", "CustomUser")
    for user in UserModel.objects.all():
        prefs = user.planning_preferences or {}
        if prefs.get("show_galeno"):
            prefs["selected_method"] = "galeno"
            prefs.pop("show_galeno", None)
            user.planning_preferences = prefs
            user.save(update_fields=("planning_preferences",))


def backwards(apps, schema_editor):
    UserModel = apps.get_model("authentication", "CustomUser")
    for user in UserModel.objects.all():
        prefs = user.planning_preferences or {}
        if prefs.get("selected_method") == "galeno":
            prefs.pop("selected_method", None)
            prefs["show_galeno"] = True
            user.planning_preferences = prefs
            user.save(update_fields=("planning_preferences",))


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "00XX_previous_migration"),  # replace with actual previous migration name
    ]
    operations = [migrations.RunPython(forwards, backwards)]
```

- [ ] **Step 3: Run migration**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python manage.py migrate authentication`
Expected: applies cleanly; spot-check with `python manage.py shell`:

```python
from authentication.models import CustomUser
CustomUser.objects.filter(planning_preferences__show_galeno=True).count()  # 0
CustomUser.objects.filter(planning_preferences__selected_method="galeno").count()  # > 0 if any users had the toggle on
```

- [ ] **Step 4: Commit**

```bash
git add django/authentication/migrations/00XX_migrate_show_galeno_to_selected_method.py
git commit -m "chore(planning): migrate show_galeno=True users to selected_method='galeno'"
```

---

## Chunk 2: Bootstrap with dynamic withdrawal

### Task 3: Add `runBootstrapWithDynamicWithdrawal` to fireBootstrap.ts

**Files:**
- Modify: `react/src/pages/private/Home/fireBootstrap.ts` (add new export at end)

The existing `runBootstrap` and `runBootstrapWithVaryingWeights` both withdraw a *fixed* `annualWithdrawal` each year. Galeno needs the withdrawal amount to be a function of the simulated bond bucket. Add a third variant.

- [ ] **Step 1: Write a failing unit test**

Vitest is set up in the repo. If a `fireBootstrap.test.ts` doesn't exist, create:

`react/src/pages/private/Home/fireBootstrap.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { runBootstrapWithDynamicWithdrawal } from "./fireBootstrap";

describe("runBootstrapWithDynamicWithdrawal", () => {
  it("returns success=1 and non-empty bands for a trivially solvent portfolio", () => {
    const result = runBootstrapWithDynamicWithdrawal({
      startingStock: 1_000_000,
      startingBond: 300_000,
      horizon: 30,
      transferRate: 0.06,
      bufferYears: 7.5,
      stockWeights: { equity: 1, ifix: 0, fixedIncome: 0 },
      // Pin withdrawals to zero so the simulation can never deplete.
      withdrawalAt: () => 0,
    });
    expect(result.successRate).toBe(1);
    expect(result.bands.length).toBe(31);
  });

  it("computes withdrawal from the simulated bond bucket each year", () => {
    let firstYearWithdrawalSeen: number | null = null;
    runBootstrapWithDynamicWithdrawal({
      startingStock: 700_000,
      startingBond: 300_000,
      horizon: 1,
      transferRate: 0,
      bufferYears: 7.5,
      stockWeights: { equity: 1, ifix: 0, fixedIncome: 0 },
      withdrawalAt: ({ bondBalance }) => {
        if (firstYearWithdrawalSeen === null) firstYearWithdrawalSeen = bondBalance / 7.5;
        return bondBalance / 7.5;
      },
      numTrials: 10,
    });
    expect(firstYearWithdrawalSeen).toBeCloseTo(40_000, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx vitest run src/pages/private/Home/fireBootstrap.test.ts`
Expected: FAIL — `runBootstrapWithDynamicWithdrawal` is not exported.

- [ ] **Step 3: Implement the variant**

Append to `react/src/pages/private/Home/fireBootstrap.ts`:

```typescript
export type DynamicWithdrawalParams = {
  startingStock: number;
  startingBond: number;
  horizon: number;
  transferRate: number; // fraction, e.g. 0.06 for 6%
  bufferYears: number; // N in the bond_total / N rule
  stockWeights: AllocationWeights; // how the stock bucket is composed (equity:ifix split)
  withdrawalAt: (ctx: {
    yearIndex: number;
    bondBalance: number;
    stockBalance: number;
  }) => number;
  numTrials?: number;
};

const runDynamicTrial = (
  params: DynamicWithdrawalParams,
  rng: () => number,
): { depletionYear: number | null; balances: number[]; bondBalances: number[] } => {
  const { startingStock, startingBond, horizon, transferRate, stockWeights, withdrawalAt } = params;
  let stock = startingStock;
  let bond = startingBond;
  const balances = [stock + bond];
  const bondBalances = [bond];
  let depletionYear: number | null = null;

  for (let y = 1; y <= horizon; y++) {
    if (stock + bond <= 0) {
      balances.push(0);
      bondBalances.push(0);
      continue;
    }
    // 1. Apply real returns to each bucket independently.
    const stockReturn = drawBlendedReturn(stockWeights, rng);
    const bondReturn = pickRandom(FIXED_INCOME_REAL_RETURNS, rng);
    stock = stock * (1 + stockReturn);
    bond = bond * (1 + bondReturn);

    // 2. Transfer transferRate of stock into bond.
    const transfer = stock * transferRate;
    stock -= transfer;
    bond += transfer;

    // 3. Withdraw from bond. Withdrawal rule provided by caller.
    const withdrawal = withdrawalAt({ yearIndex: y - 1, bondBalance: bond, stockBalance: stock });
    bond -= withdrawal;

    // 4. If bond went negative, draw the shortfall from stocks; if both empty, mark depletion.
    if (bond < 0) {
      stock += bond;
      bond = 0;
    }
    if (stock < 0) {
      stock = 0;
    }
    if (stock + bond <= 0 && depletionYear === null) {
      depletionYear = y;
    }
    balances.push(stock + bond);
    bondBalances.push(bond);
  }

  return { depletionYear, balances, bondBalances };
};

export type DynamicBootstrapResult = BootstrapResult & {
  bondBands: BootstrapBand[];
  withdrawalBands: BootstrapBand[];
};

export const runBootstrapWithDynamicWithdrawal = (
  params: DynamicWithdrawalParams,
): DynamicBootstrapResult => {
  const numTrials = params.numTrials ?? 2000;
  if (params.horizon <= 0 || params.startingStock + params.startingBond <= 0) {
    return {
      successRate: 0,
      bands: [],
      bondBands: [],
      withdrawalBands: [],
      medianDepletionYear: null,
      p10DepletionYear: null,
    };
  }

  const rng = mulberry32(FIXED_SEED);
  const trials = Array.from({ length: numTrials }, () => runDynamicTrial(params, rng));
  const successRate = trials.filter((t) => t.depletionYear === null).length / numTrials;

  const buildBands = (key: "balances" | "bondBalances"): BootstrapBand[] => {
    const bands: BootstrapBand[] = [];
    for (let y = 0; y <= params.horizon; y++) {
      const sorted = trials.map((t) => t[key][y]).sort((a, b) => a - b);
      bands.push({
        year: y,
        p10: sorted[Math.floor(numTrials * 0.1)],
        p50: sorted[Math.floor(numTrials * 0.5)],
        p90: sorted[Math.floor(numTrials * 0.9)],
      });
    }
    return bands;
  };

  // Reconstruct withdrawals per year by re-running withdrawalAt over each
  // trial's bondBalance trajectory. We don't store withdrawals during the
  // trial loop because doing so would either require duplicating the trial
  // closure or mutating an external array (both worse than recomputing).
  const withdrawalBands: BootstrapBand[] = [];
  for (let y = 1; y <= params.horizon; y++) {
    const sorted = trials
      .map((t) =>
        params.withdrawalAt({
          yearIndex: y - 1,
          bondBalance: t.bondBalances[y],
          stockBalance: Math.max(t.balances[y] - t.bondBalances[y], 0),
        }),
      )
      .sort((a, b) => a - b);
    withdrawalBands.push({
      year: y,
      p10: sorted[Math.floor(numTrials * 0.1)],
      p50: sorted[Math.floor(numTrials * 0.5)],
      p90: sorted[Math.floor(numTrials * 0.9)],
    });
  }

  const depletionYears = trials
    .map((t) => t.depletionYear)
    .filter((y): y is number => y !== null)
    .sort((a, b) => a - b);
  const medianDepletionYear =
    depletionYears.length > 0 ? depletionYears[Math.floor(depletionYears.length / 2)] : null;
  const p10DepletionYear =
    depletionYears.length >= numTrials * 0.1 ? depletionYears[Math.floor(numTrials * 0.1)] : null;

  return {
    successRate,
    bands: buildBands("balances"),
    bondBands: buildBands("bondBalances"),
    withdrawalBands,
    medianDepletionYear,
    p10DepletionYear,
  };
};
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx vitest run src/pages/private/Home/fireBootstrap.test.ts`
Expected: PASS, both cases.

- [ ] **Step 5: Commit**

```bash
git add react/src/pages/private/Home/fireBootstrap.ts react/src/pages/private/Home/fireBootstrap.test.ts
git commit -m "feat(planning): add dynamic-withdrawal bootstrap variant for Galeno strategy"
```

### Task 4: Update fire-bootstrap-methodology skill

**Files:**
- Modify: `.claude/skills/fire-bootstrap-methodology/SKILL.md` (after the time-varying-weights variant section)

- [ ] **Step 1: Add a "Dynamic-withdrawal variant (Galeno)" section** explaining:
  - The trial loop now tracks two buckets (stock, bond) separately rather than one balance.
  - Each year: apply real returns to each bucket, transfer `transferRate` of stocks → bonds, then withdraw from bonds via `withdrawalAt({yearIndex, bondBalance, stockBalance}) → number`.
  - Why bucketed simulation is necessary: under Galeno the withdrawal amount each year *is* a function of the simulated bond bucket. A single-balance simulation can't express that.
  - How depletion is handled: bond shortfall first dips into stock, then both go to zero — matches the strategy as actually practiced (when bonds run dry, you sell stocks for living expenses rather than starve).
  - The result type adds `bondBands` and `withdrawalBands` so the indicator can plot bond-bucket trajectory and the year-over-year withdrawal envelope.

- [ ] **Step 2: Add to the "Things to preserve" list:**
  > 8. **The three bootstrap variants are not interchangeable.** Static (`runBootstrap`), time-varying-weights (`runBootstrapWithVaryingWeights`), and dynamic-withdrawal (`runBootstrapWithDynamicWithdrawal`) each model a different strategy property. Pick the one that matches what the strategy actually does — don't try to fake Galeno with a fixed withdrawal, or fake age-in-bonds with averaged static weights.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/fire-bootstrap-methodology/SKILL.md
git commit -m "docs(skill): document dynamic-withdrawal variant for Galeno strategy"
```

---

## Chunk 3: GalenoStrategyIndicator component

### Task 5: Build the indicator skeleton

**Files:**
- Create: `react/src/pages/private/Home/GalenoStrategyIndicator.tsx`

This indicator follows the structural pattern of `ConstantDollarIndicator.tsx` but with Galeno-specific framing.

- [ ] **Step 1: Define the props and skeleton render**

Create `react/src/pages/private/Home/GalenoStrategyIndicator.tsx`:

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
  runBootstrapWithDynamicWithdrawal,
  type AllocationWeights,
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

type Props = {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  bondsTotal: number;       // current RF (no bank)
  bankAmount: number;       // counted into bond bucket as starting cash
  equityTotal: number;
  ifixTotal: number;
  bufferYears: number;      // N — slider 5..10 default 7.5
  onBufferYearsChange: (v: number) => void;
  transferRate: number;     // % per year — slider 3..15 default 6
  onTransferRateChange: (v: number) => void;
  targetYears: number;      // simulation horizon — slider 20..80 default 30
  onTargetYearsChange: (v: number) => void;
  compact?: boolean;
  hideLabel?: boolean;
};

const GalenoStrategyIndicator = (_props: Props) => {
  return null; // implemented in Step 3
};

export default GalenoStrategyIndicator;
```

- [ ] **Step 2: Implement the math layer**

Replace the `null` body with:

```typescript
const GalenoStrategyIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  bondsTotal,
  bankAmount,
  equityTotal,
  ifixTotal,
  bufferYears,
  onBufferYearsChange,
  transferRate,
  onTransferRateChange,
  targetYears,
  onTargetYearsChange,
  compact = false,
  hideLabel = false,
}: Props) => {
  const { hideValues } = useHideValues();
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);

  const annualExpenses = avgExpenses * 12;
  const startingBond = bondsTotal + bankAmount;
  const startingStock = equityTotal + ifixTotal;
  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;
  // When the user simulates a different patrimony, scale stock and bond
  // proportionally so the bucket split stays meaningful.
  const scale = patrimonyTotal > 0 ? effectivePatrimony / patrimonyTotal : 1;
  const simStock = startingStock * scale;
  const simBond = startingBond * scale;

  // The Galeno withdrawal rule: bond_total / bufferYears.
  const currentWithdrawal = simBond / bufferYears;
  const monthlyWithdrawal = currentWithdrawal / 12;

  // Bar = currentWithdrawal vs annualExpenses. ≥ 100% means today's bond
  // bucket alone supports the user's lifestyle at the chosen N — i.e. the
  // strategy is already producing enough income.
  const coverage = annualExpenses > 0 ? (currentWithdrawal / annualExpenses) * 100 : 0;

  // Stock bucket weights for return draws (preserve current equity:ifix).
  const stockWeights: AllocationWeights = useMemo(() => {
    const total = equityTotal + ifixTotal;
    if (total <= 0) return { equity: 1, ifix: 0, fixedIncome: 0 };
    return {
      equity: equityTotal / total,
      ifix: ifixTotal / total,
      fixedIncome: 0,
    };
  }, [equityTotal, ifixTotal]);

  const bootstrap = useMemo(
    () =>
      runBootstrapWithDynamicWithdrawal({
        startingStock: simStock,
        startingBond: simBond,
        horizon: targetYears,
        transferRate: transferRate / 100,
        bufferYears,
        stockWeights,
        withdrawalAt: ({ bondBalance }) => bondBalance / bufferYears,
      }),
    [simStock, simBond, targetYears, transferRate, bufferYears, stockWeights],
  );
```

- [ ] **Step 3: Implement the render**

Append to the component body before the final `};`:

```typescript
  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const tooltipTitle =
    `Galeno (combinação): retire ${bufferYears.toFixed(1)}× ano de bônus em renda fixa. ` +
    `Cada ano, transfira ${transferRate}% da bolsa para RF; a retirada anual é ` +
    `bônus_RF ÷ ${bufferYears.toFixed(1)}. Sucesso histórico em ${targetYears} anos: ` +
    `${(bootstrap.successRate * 100).toFixed(0)}%.`;

  const monthlyWithdrawalLabel = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const monthlyExpensesLabel = hideValues ? "***" : formatCurrency(avgExpenses);

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
                Galeno (combinação)
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
          Retirada hoje: {monthlyWithdrawalLabel}/mês · Despesas: {monthlyExpensesLabel}/mês
          {coverage >= 100 ? " — cobertura completa" : " — colchão ainda em formação"}
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Colchão: {bufferYears.toFixed(1)} anos
        </Text>
        <Slider
          value={bufferYears}
          onChange={(_, v) => onBufferYearsChange(v as number)}
          min={5}
          max={10}
          step={0.5}
          size="medium"
          sx={sliderSx}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Transf. {transferRate}%/ano
        </Text>
        <Slider
          value={transferRate}
          onChange={(_, v) => onTransferRateChange(v as number)}
          min={3}
          max={15}
          step={1}
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
      {!compact && coverage >= 100 && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Sucesso em {targetYears}a: {(bootstrap.successRate * 100).toFixed(0)}% · Depleção p10:{" "}
            {bootstrap.p10DepletionYear ?? `${targetYears}+`} anos · Mediana:{" "}
            {bootstrap.medianDepletionYear ?? `${targetYears}+`} anos
          </Text>
        </Stack>
      )}
      {!compact && bootstrap.withdrawalBands.length > 1 && (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={bootstrap.withdrawalBands} margin={{ top: 10, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="5" vertical={false} />
            <XAxis dataKey="year" stroke={getColor(Colors.neutral0)} tickLine={false} />
            <YAxis stroke={getColor(Colors.brand400)} tickLine={false} axisLine={false} />
            <RechartsTooltip cursor={false} />
            <Line type="monotone" dataKey="p10" stroke={getColor(Colors.danger200)} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="p10 retirada" />
            <Line type="monotone" dataKey="p50" stroke={getColor(Colors.brand200)} strokeWidth={2} dot={false} name="Mediana retirada" />
            <Line type="monotone" dataKey="p90" stroke={getColor(Colors.brand)} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="p90 retirada" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Stack>
  );
};
```

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add react/src/pages/private/Home/GalenoStrategyIndicator.tsx
git commit -m "feat(planning): add GalenoStrategyIndicator with dynamic withdrawal bootstrap"
```

---

## Chunk 4: Frontend Plumbing

### Task 6: Add `"galeno"` to ActiveMethodKey and PlanningHub card

**Files:**
- Modify: `react/src/pages/private/Planning/api.ts:4` (ActiveMethodKey)
- Modify: `react/src/pages/private/Planning/PlanningHub.tsx` (add card)
- Modify: `react/src/pages/private/Planning/strategyContent.tsx` (add `galeno` entry to STRATEGY_CONTENT)
- Modify: `react/src/pages/private/Planning/consts.ts` (delete the deprecated `GALENO_RATIONALE` / `GALENO_PROS` / `GALENO_CONS` add-on exports)

- [ ] **Step 1: Extend the type**

In `react/src/pages/private/Planning/api.ts:4`:

```typescript
export type ActiveMethodKey = "fire" | "dividends_only" | "one_over_n" | "vpw" | "galeno";
```

`WithdrawalMethodKey` already includes `"constant_withdrawal"` — leave it. Just add `"galeno"`.

```typescript
export type WithdrawalMethodKey = "fire" | "dividends_only" | "constant_withdrawal" | "one_over_n" | "vpw" | "galeno";
```

- [ ] **Step 2: Add the strategy content entry**

In `react/src/pages/private/Planning/strategyContent.tsx`, add inside `STRATEGY_CONTENT` (the `vpw:` entry is the closest structural twin). Use the existing `GALENO_RATIONALE` body as a starting point but rewrite for the strategy framing — no longer a "buffer add-on", now a primary withdrawal rule. Pros/cons should reflect that withdrawals fluctuate with portfolio value (a feature here, not a bug — the trade-off vs constant-dollar).

Concrete text to use:

```typescript
galeno: {
  title: "Galeno (combinação)",
  subtitle:
    "Combine bônus de renda fixa com transferência anual de ações; sua retirada acompanha o mercado e é suavizada por uma média de N anos.",
  rationale: (
    <>
      <p>
        O método Galeno é um híbrido entre retirada constante e percentual variável.
        Seu portfólio mantém um colchão em renda fixa equivalente a N anos de
        retiradas (canonicamente N = 7,5). A cada ano, uma fração fixa da carteira
        de ações é vendida e movida para o colchão; a retirada anual é então
        calculada como bônus_RF ÷ N.
      </p>
      <p>
        Como o tamanho do colchão depende das transferências (e portanto do
        valor das ações), suas retiradas sobem em mercados de alta e descem em
        baixa — mas a divisão por N suaviza as flutuações, evitando os saltos
        bruscos da retirada percentual.
      </p>
      <p>
        Você pode preferir esse método se quer um meio-termo entre a
        previsibilidade do constante-dólar e a sensibilidade ao mercado da
        retirada percentual variável.
      </p>
    </>
  ),
  defaultsExplained: [
    {
      label: "Tamanho do colchão (N anos)",
      explanation:
        "A literatura usa N = 7,5 como ponto de partida. Valores menores (5–6) " +
        "deixam mais capital trabalhando em ações mas suavizam menos as flutuações; " +
        "valores maiores (8–10) protegem mais contra sequências ruins mas reduzem " +
        "o crescimento esperado.",
    },
    {
      label: "Taxa de transferência",
      explanation:
        "A literatura usa 6% ao ano como referência. Taxas maiores reabastecem o " +
        "colchão mais rápido em mercados altos mas podem esgotá-lo se você precisa " +
        "vender ações em baixa.",
    },
    {
      label: "Horizonte de simulação",
      explanation:
        "O bootstrap simula `horizon` anos de aposentadoria com retorno real " +
        "histórico (NEFIN/IFIX/risk-free) para os dois bucks. A taxa de sucesso " +
        "é a fração de cenários em que o portfólio nunca chegou a zero no horizonte.",
    },
  ],
  pros: [
    { text: "Retirada acompanha o portfólio — mais em alta, menos em baixa" },
    { text: "Suaviza flutuações via a média de N anos no colchão" },
    { text: "Não depende de premissas inflacionárias rígidas" },
    { text: "Combina virtudes do constante-dólar e do percentual variável" },
  ],
  cons: [
    { text: "Renda varia ano a ano — exige flexibilidade no estilo de vida" },
    { text: "Exige rebalanceamento anual disciplinado" },
    { text: "Em quedas profundas, o colchão pode reduzir significativamente as retiradas" },
    { text: "Mais complexo de operar do que retirada constante simples" },
  ],
},
```

Then **delete** the legacy add-on exports `GALENO_RATIONALE`, `GALENO_PROS`, `GALENO_CONS` from `consts.ts`, and the corresponding `import { GALENO_RATIONALE, GALENO_PROS, GALENO_CONS } from "./consts"` re-export at the bottom of `strategyContent.tsx`.

- [ ] **Step 3: Add the Planning Hub card**

Read `react/src/pages/private/Planning/PlanningHub.tsx` and find the array of strategy cards. Add a card for `galeno` with the same structure as `vpw`. Keep the order: `fire`, `dividends_only`, `one_over_n`, `vpw`, `galeno`.

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add react/src/pages/private/Planning/
git commit -m "feat(planning): add Galeno strategy to ActiveMethodKey and Planning Hub"
```

### Task 7: Wire GalenoStrategyIndicator into StrategyDetailPage

**Files:**
- Modify: `react/src/pages/private/Planning/StrategyDetailPage.tsx`
  - Remove `GALENO_METHODS = []` and the `// Galeno parked` comment block.
  - Remove `localGaleno` state, `handleGalenoChange`, `hasGalenoToggle`, and the FormControlLabel that rendered the deprecated toggle.
  - Remove the `GALENO_RATIONALE`/`GALENO_PROS`/`GALENO_CONS` import (was already deleted in Task 6 from `consts.ts`).
  - Remove `showGaleno` derivation entirely (not used anymore — Galeno is now a `selectedMethod`, not a side toggle).
  - Remove `pros` / `cons` / `rationaleExtra` Galeno-specific spreads.
  - Add a new `case "galeno":` to the `indicator` switch returning `<GalenoStrategyIndicator>` with new state hooks (`galenoBufferYears` default 7.5, `galenoTransferRate` default 6, `galenoTargetYears` default 30).
  - Drop the unused `galenoTransferRate`/`galenoTargetBufferYears` state that was for the legacy toggle, OR rename/repurpose it for the new indicator — depending on which gives a cleaner diff.

- [ ] **Step 1: Apply the deletions**

Walk through the file top-to-bottom and remove every reference to the legacy Galeno add-on. The signal that you got it right: searching the file for `galeno` (case-insensitive) only matches the new `case "galeno":` block and the `<GalenoStrategyIndicator>` render.

- [ ] **Step 2: Add the case branch**

```typescript
case "galeno":
  return (
    <GalenoStrategyIndicator
      patrimonyTotal={patrimonyTotal}
      avgExpenses={avgExpenses}
      isLoading={isDataLoading || isReportsLoading}
      bondsTotal={fixedIncomeTotal}
      bankAmount={bankAmount}
      equityTotal={equityTotal}
      ifixTotal={ifixTotal}
      bufferYears={galenoBufferYears}
      onBufferYearsChange={setGalenoBufferYears}
      transferRate={galenoTransferRate}
      onTransferRateChange={setGalenoTransferRate}
      targetYears={galenoTargetYears}
      onTargetYearsChange={setGalenoTargetYears}
    />
  );
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add react/src/pages/private/Planning/StrategyDetailPage.tsx
git commit -m "feat(planning): render GalenoStrategyIndicator from StrategyDetailPage"
```

### Task 8: Wire GalenoStrategyIndicator into the home Indicators panel

**Files:**
- Modify: `react/src/pages/private/Home/Indicators.tsx`
  - Remove the `// Galeno parked` block and revert `showGaleno = false`.
  - Remove the legacy `<GalenoIndicator>` renders inside the `fire`, `one_over_n`, `vpw` branches (those were add-on renders for the deprecated toggle).
  - Add a `galeno:` branch to the `selectedMethod` switch that renders `<GalenoStrategyIndicator>` in `compact` mode.
  - Add `galenoBufferYears`, `galenoTransferRate`, `galenoTargetYears` state.
  - Drop the legacy `galenoTransferRate` / `galenoTargetBufferYears` state if the names collide; rename to `galenoLegacyTransferRate` first if you need temporary disambiguation, then delete.

- [ ] **Step 1: Apply the changes**

Same pattern as Task 7. Verification: search `Indicators.tsx` for `Galeno` (case-insensitive) — only the new render and import should match.

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add react/src/pages/private/Home/Indicators.tsx
git commit -m "feat(planning): render GalenoStrategyIndicator on home page when selected"
```

---

## Chunk 5: Verification

### Task 9: Manual smoke test

- [ ] **Step 1: Start dev servers**

```bash
cd django && python manage.py runserver 8000 &
cd react && npm run dev &
```

- [ ] **Step 2: Walk the user flows**

Open the app in a browser and verify, recording observations:

1. **Planning Hub** shows a Galeno card alongside FIRE, Dividends-only, 1/N, VPW. Clicking opens the detail page.
2. **Galeno detail page** renders the new indicator. Sliders move the bar, the bootstrap success rate, and the chart. Setting `bufferYears = 7.5`, `transferRate = 6%`, `targetYears = 30` with a realistic patrimony produces a coverage % and a non-trivial success rate.
3. **Selecting Galeno as active strategy** from its detail page persists across reload.
4. **Home page** with `selectedMethod = "galeno"` shows the compact `GalenoStrategyIndicator` and *not* the old add-on `GalenoIndicator`.
5. **Other methods** (`fire`, `one_over_n`, `vpw`) no longer have an "Incluir colchão de renda fixa (Galeno)" toggle.
6. **Backend regression:** with `selectedMethod = "fire"` and an old client sending `show_galeno: true`, the API returns 400 with the deprecation message.

- [ ] **Step 3: Commit any small fixes uncovered**

If smoke testing surfaces issues, fix them and commit. If everything works, no commit needed.

### Task 10: Run the full test suite

- [ ] **Step 1: Backend tests**

Run: `cd /Users/murilo/github/multi-sources-financial-control/django && python -m pytest -x`
Expected: all pass.

- [ ] **Step 2: Frontend typecheck and unit tests**

Run: `cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit && npx vitest run`
Expected: tsc exits 0, vitest reports all green.

- [ ] **Step 3: Commit if anything was fixed**

If fixes were needed, commit them with `chore: address galeno strategy test/typecheck regressions`.

---

## Open questions to resolve before starting

1. **Bond bucket return source.** This plan assumes the bond bucket draws from `FIXED_INCOME_REAL_RETURNS`. If the user wants to model RF bonds vs. cash-yielding-savings differently, that's a deeper data-source change (would require generating a separate cash series in `generate_fire_returns_ts`). Default to the existing series.
2. **Initial bond size when patrimony is unknown / portfolio not yet rebalanced.** The Galeno strategy *prescribes* an initial split (`bond = N × annual_withdrawal`). The current user might not be there yet. Decision needed: (a) simulate from current actual split (honest about user's state, but the strategy-as-described isn't being run); (b) simulate from the prescribed split (shows what Galeno would do *if* you rebalanced today). Option (a) is the consistent choice with how `ConstantDollarIndicator` treats current allocation. The plan above implicitly chose (a). Worth confirming.
3. **Where the legacy `GalenoIndicator.tsx` lives.** Delete it once `GalenoStrategyIndicator` is wired in. The accumulation-runway view it provided could be folded into the new indicator as a secondary display when `coverage < 100`, or dropped — most users running Galeno will already be at or near the prescribed split.
4. **`AGE_IN_BONDS_PROS` etc. unaffected** — Idade-em-RF is independent and stays exactly as-is. The redesign here is scoped strictly to Galeno.
