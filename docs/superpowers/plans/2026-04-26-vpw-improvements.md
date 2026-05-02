# VPW Strategy Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix correctness gaps and UX disconnects on the `/planning/vpw` page identified in a critical review (2026-04-26). Replace the deterministic projection with a historical bootstrap, surface the portfolio-balance trajectory on the chart, expose allocation as a user-tunable slider, exclude bank cash from the withdrawal computation, and tighten the bar/chart/copy alignment.

**Architecture:** The work is layered. (1) Add a fourth bootstrap variant to `fireBootstrap.ts` that supports per-year, balance-dependent withdrawals — the missing primitive for VPW. (2) Refactor `VPWIndicator.tsx`'s prop surface to take `equityTotal/ifixTotal/fixedIncomeTotal/bankAmount` separately (instead of a pre-aggregated `patrimonyTotal`), so the indicator can apply the rate to investments only and surface bank cash distinctly. (3) Replace the in-component deterministic `computeProjection` with a call into the new bootstrap, charting p10/p50/p90 bands for both withdrawal and balance on a dual-axis Recharts `ComposedChart` (left: monthly withdrawal in R$/mês; right: portfolio balance in R$). (4) Add an allocation override slider mirroring the `PatrimonySimulator` pattern (override + reset). (5) Copy fixes in `strategyContent.tsx` and inline labels.

**Tech Stack:** React 18, TypeScript, MUI, Recharts, Vitest (added in this plan if not yet present), TanStack Query.

---

## Scope: all 22 review findings

The plan implements **NOW** items in groups A+B+C with the user-approved adjustments. **LATER** items (groups D, E, F) are listed for traceability but are out of scope for this plan. **DROPPED** items are explicitly not pursued.

### NOW — implemented in this plan

| # | Item | Resolution in this plan |
|---|---|---|
| A#1 | Allocation slider missing | New RV/RF override slider with "Resetar" — Task 5 |
| A#4 | Default-return justification fragile | Subsumed by C#8 — bootstrap chart shows variance directly, removing the "deterministic curve looks authoritative" problem (no explicit copy fix needed) |
| A#9 | Cons claim variability but chart is smooth | Subsumed by C#8 — bands show real variance |
| B#2 | Bank cash incorrectly weighted into VPW | Excluded from rate computation — Task 3 (no visible "bank cash" line per user direction) |
| B#3a | Inert return slider when allocation extreme | Gray-out + helper text — Task 9 |
| B#3b | RF > RV economically nonsensical | Soft warning chip — Task 9 |
| B#7 | PatrimonySimulator allocation drift | Resolved by A#1 — allocation now independent — Task 4 |
| C#5 | Bar = today, chart = lifetime, no bridge | Tooltip + sublabel — Task 8 |
| C#6 | "Saque atual" lies during simulation | Simulator-aware label — Task 8 |
| C#8 | Chart hides portfolio depletion | Dual-axis + bootstrap bands — Tasks 3, 5, 6 |
| C#10 | Withdrawal non-monotonic with no explanation | Subsumed by C#8 — variance bands and visible balance trajectory make the shape self-evident |
| C#21 | Coverage% vs VPW rate% indistinguishable | Visual differentiation — Task 10 |

### LATER — out of scope, document as follow-up

| # | Item | Why deferred |
|---|---|---|
| D#11 | Slider row layout / no wrap | Cosmetic; hits only narrow viewports |
| D#12 | No `valueLabelDisplay` thumb tooltips | Cosmetic; affects all strategies, do as one pass |
| D#13 | No keyboard / numeric input on sliders | Cross-cutting (all strategies); separate concern |
| D#15 | PatrimonySimulator R$50k step coarse for low patrimony | Affects all strategies; do as one pass |
| D#16 | Patrimony=0 silent zero state | Edge case, low impact |
| D#17 | Step granularity invisible | Cosmetic |
| E#3c | RV slider 3–15% upper bound unrealistic | Easy to do but contentious — defer until consensus |
| E#14 | Target age slider doesn't adapt to current age | Real edge case but rare in user base |
| F#18 | Locale `.` instead of `,` in toFixed | Cross-cutting cosmetic; whole-app pass |
| F#19 | "Entenda esses valores" collapsed by default | Affects all strategies |
| F#20 | `tickCount={0}` may not hide ticks reliably | Already mostly working; verify in QA |

### DROPPED

| # | Item | Reason |
|---|---|---|
| A#22 | No 1/N comparison overlay | User: "two tabs is fine" (2026-04-26) |

---

## File structure

**Modified:**
- `react/src/pages/private/Home/fireBootstrap.ts` — add `runBootstrapWithVaryingWithdrawal` and supporting types
- `react/src/pages/private/Home/VPWIndicator.tsx` — major rewrite (props, allocation state, chart, copy)
- `react/src/pages/private/Planning/StrategyDetailPage.tsx` — pass `equityTotal/ifixTotal/fixedIncomeTotal/bankAmount` separately to VPW
- `react/src/pages/private/Planning/PlanningHub.tsx` — same prop wiring for the compact VPW card
- `react/src/pages/private/Home/Indicators.tsx` — same prop wiring for the home dashboard
- `react/src/pages/private/Planning/strategyContent.tsx` — update VPW `defaultsExplained` (allocation slider explanation, bank exclusion note); reword cons that claimed variability
- `react/package.json` — add `vitest` to devDeps and a `test` script (only if not already present from sister plans)

**Created:**
- `react/src/pages/private/Home/fireBootstrap.test.ts` — vitest tests for the new bootstrap variant (only if file doesn't exist; otherwise extend)
- `react/vitest.config.ts` — vitest config (only if not present)

**Pre-reads for the implementer:**
- `react/src/pages/private/Home/fireBootstrap.ts` — existing primitives (`runBootstrap`, `runBootstrapWithVaryingWeights`, `mulberry32`, `drawBlendedReturn`)
- `react/src/pages/private/Home/ConstantDollarIndicator.tsx` lines 335-385 — reference Recharts pattern for p10/p50/p90 lines
- `react/src/pages/private/Home/PatrimonySimulator.tsx` — reference pattern for "override + reset" sliders (mirrored for the allocation slider)
- `.claude/skills/fire-bootstrap-methodology/SKILL.md` — bootstrap framing, percentile bands

---

## Chunk 1: Bootstrap math (testable; no UI)

### Task 1: Ensure vitest is installed

If a sister plan has already added vitest, skip the install steps and only verify the test command runs.

**Files:**
- Modify: `react/package.json`
- Create (if missing): `react/vitest.config.ts`

- [ ] **Step 1: Check if vitest is already installed**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && grep -q '"vitest"' package.json && echo "INSTALLED" || echo "MISSING"
```

If `INSTALLED`, skip to Step 4.

- [ ] **Step 2: Install vitest**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npm install --save-dev vitest @vitest/ui
```

- [ ] **Step 3: Add test script and create vitest config**

In `react/package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `react/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 4: Verify the test runner works (with no tests yet, vitest exits cleanly)**

Run:
```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx vitest run --reporter=basic
```
Expected: exits 0; if no test files yet, message "No test files found" is acceptable (continue).

- [ ] **Step 5: Commit**

```bash
git add react/package.json react/package-lock.json react/vitest.config.ts
git commit -m "chore: add vitest test runner for pure-math modules"
```

(Skip Step 5 if nothing changed.)

---

### Task 2: Add `runBootstrapWithVaryingWithdrawal` to `fireBootstrap.ts`

The new variant simulates trajectories where the per-year withdrawal is a function of `(yearIndex, currentBalance)` — the primitive VPW needs. Output is two sets of percentile bands: `withdrawalBands` (in nominal currency per year) and `balanceBands` (end-of-year balance).

**Mathematical convention** (matches existing `runTrial`):
- Year `y` runs from `y=0` to `y=horizon-1`.
- At start of year `y`: balance is `balances[y]` (with `balances[0] = startingBalance`).
- Withdrawal for year `y`: `w_y = withdrawalAt(y, balances[y])`.
- End of year `y`: `balances[y+1] = (balances[y] - w_y) * (1 + drawBlendedReturn(weights))`. (Withdrawal first, then growth — matches `runTrial`.)
- If `balances[y+1] < 0`, clamp to 0.

**Files:**
- Modify: `react/src/pages/private/Home/fireBootstrap.ts`
- Create (or modify if it exists from sister plan): `react/src/pages/private/Home/fireBootstrap.test.ts`

- [ ] **Step 1: Write failing tests in `fireBootstrap.test.ts`**

If the file does not exist, create it:
```typescript
// react/src/pages/private/Home/fireBootstrap.test.ts
import { describe, it, expect } from "vitest";
import {
  runBootstrapWithVaryingWithdrawal,
  computeWeights,
} from "./fireBootstrap";

describe("runBootstrapWithVaryingWithdrawal", () => {
  const allEquity = computeWeights(1, 0, 0);

  it("returns empty bands when starting balance is zero", () => {
    const result = runBootstrapWithVaryingWithdrawal(
      0,
      allEquity,
      10,
      () => 0,
      100,
    );
    expect(result.withdrawalBands).toHaveLength(0);
    expect(result.balanceBands).toHaveLength(0);
  });

  it("returns empty bands when horizon is zero", () => {
    const result = runBootstrapWithVaryingWithdrawal(
      1_000_000,
      allEquity,
      0,
      () => 40_000,
      100,
    );
    expect(result.withdrawalBands).toHaveLength(0);
    expect(result.balanceBands).toHaveLength(0);
  });

  it("produces horizon bands for both withdrawal and balance", () => {
    const result = runBootstrapWithVaryingWithdrawal(
      1_000_000,
      allEquity,
      30,
      (_year, balance) => balance * 0.04,
      500,
    );
    // withdrawal bands cover years 0..horizon-1 (one withdrawal per active year)
    expect(result.withdrawalBands).toHaveLength(30);
    expect(result.withdrawalBands[0].year).toBe(0);
    expect(result.withdrawalBands[29].year).toBe(29);
    // balance bands cover years 0..horizon (start-of-year, plus end-of-year-horizon)
    expect(result.balanceBands).toHaveLength(31);
    expect(result.balanceBands[0].year).toBe(0);
    expect(result.balanceBands[30].year).toBe(30);
  });

  it("balance band p50 at year 0 equals starting balance (deterministic boundary)", () => {
    const result = runBootstrapWithVaryingWithdrawal(
      1_000_000,
      allEquity,
      10,
      (_y, b) => b * 0.04,
      500,
    );
    expect(result.balanceBands[0].p10).toBe(1_000_000);
    expect(result.balanceBands[0].p50).toBe(1_000_000);
    expect(result.balanceBands[0].p90).toBe(1_000_000);
  });

  it("p10 ≤ p50 ≤ p90 for every band", () => {
    const result = runBootstrapWithVaryingWithdrawal(
      1_000_000,
      allEquity,
      30,
      (_y, b) => b * 0.05,
      500,
    );
    for (const band of result.withdrawalBands) {
      expect(band.p10).toBeLessThanOrEqual(band.p50);
      expect(band.p50).toBeLessThanOrEqual(band.p90);
    }
    for (const band of result.balanceBands) {
      expect(band.p10).toBeLessThanOrEqual(band.p50);
      expect(band.p50).toBeLessThanOrEqual(band.p90);
    }
  });

  it("is deterministic across runs (fixed seed)", () => {
    const a = runBootstrapWithVaryingWithdrawal(
      1_000_000, allEquity, 30, (_y, b) => b * 0.04, 500,
    );
    const b = runBootstrapWithVaryingWithdrawal(
      1_000_000, allEquity, 30, (_y, b) => b * 0.04, 500,
    );
    expect(a.withdrawalBands).toEqual(b.withdrawalBands);
    expect(a.balanceBands).toEqual(b.balanceBands);
  });

  it("balance reaches zero at horizon when withdrawal grows to consume it (VPW-like)", () => {
    // Crude VPW: rate = 1/yearsLeft, ignoring returns. Forces depletion at horizon.
    const result = runBootstrapWithVaryingWithdrawal(
      1_000_000,
      computeWeights(0, 0, 1), // all fixed income to stabilize
      30,
      (yearIndex, balance) => balance * (1 / (30 - yearIndex)),
      300,
    );
    // p50 final balance should be very small (within 1% of zero)
    const finalP50 = result.balanceBands[result.balanceBands.length - 1].p50;
    expect(Math.abs(finalP50)).toBeLessThan(10_000);
  });
});
```

If the file already exists (e.g. from the constant-percentage plan), append the new `describe` block instead of overwriting.

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx vitest run src/pages/private/Home/fireBootstrap.test.ts
```
Expected: tests fail with `runBootstrapWithVaryingWithdrawal is not exported` (or similar).

- [ ] **Step 3: Implement the new variant**

Append to `react/src/pages/private/Home/fireBootstrap.ts`:

```typescript
// Per-year, balance-dependent withdrawal callback.
// `yearIndex` runs from 0 to horizon-1; `currentBalance` is the start-of-year
// balance. Return the nominal withdrawal amount in currency units.
export type WithdrawalAtFn = (yearIndex: number, currentBalance: number) => number;

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
    balance = (balance - w) * (1 + drawBlendedReturn(weights, rng));
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
  const trials = Array.from({ length: numTrials }, () =>
    runTrialVaryingWithdrawal(startingBalance, weights, horizon, withdrawalAt, rng),
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
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx vitest run src/pages/private/Home/fireBootstrap.test.ts
```
Expected: all 7 tests pass.

- [ ] **Step 5: Run typecheck**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add react/src/pages/private/Home/fireBootstrap.ts react/src/pages/private/Home/fireBootstrap.test.ts
git commit -m "feat(planning/vpw): add bootstrap variant for varying withdrawals

Adds runBootstrapWithVaryingWithdrawal — the missing primitive for
strategies where the per-year withdrawal depends on the current balance
(VPW: balance × pmt(realReturn, yearsLeft)). Returns p10/p50/p90 bands
for both the withdrawal stream and the balance trajectory.

Refs review 2026-04-26 finding C#8."
```

---

## Chunk 2: Indicator props refactor (correctness fix without behavior change)

### Task 3: Refactor `VPWIndicator` props to take per-bucket totals + bank separately

The indicator currently receives a pre-aggregated `patrimonyTotal = invest + bank` and pre-aggregated `variableIncomeTotal = equity + ifix`. To compute the right thing (B#2) and to feed the bootstrap (which wants 3 buckets for return draws), we expand the prop surface. **No behavior change yet** — the new props just thread through; we still call the deterministic `computeProjection` until Task 6.

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`
- Modify: `react/src/pages/private/Planning/StrategyDetailPage.tsx`
- Modify: `react/src/pages/private/Planning/PlanningHub.tsx`
- Modify: `react/src/pages/private/Home/Indicators.tsx`

- [ ] **Step 1: Change `VPWIndicator` prop signature**

In `react/src/pages/private/Home/VPWIndicator.tsx`, replace the props block (around lines 159-189):

```typescript
const VPWIndicator = ({
  equityTotal,
  ifixTotal,
  fixedIncomeTotal,
  bankAmount,
  avgExpenses,
  isLoading,
  dateOfBirth,
  targetAge,
  onTargetAgeChange,
  stockReturn,
  onStockReturnChange,
  bondReturn,
  onBondReturnChange,
  compact = false,
  hideLabel = false,
}: {
  equityTotal: number;
  ifixTotal: number;
  fixedIncomeTotal: number;
  bankAmount: number;
  avgExpenses: number;
  isLoading: boolean;
  dateOfBirth: string | null;
  targetAge: number;
  onTargetAgeChange: (value: number) => void;
  stockReturn: number;
  onStockReturnChange: (value: number) => void;
  bondReturn: number;
  onBondReturnChange: (value: number) => void;
  compact?: boolean;
  hideLabel?: boolean;
}) => {
```

Then derive both totals at the top of the component body (replace the `investmentTotal` line at ~196):

```typescript
const investmentTotal = equityTotal + ifixTotal + fixedIncomeTotal;
const patrimonyTotal = investmentTotal + bankAmount;
const variableIncomeTotal = equityTotal + ifixTotal;
const stockPct = investmentTotal > 0 ? (variableIncomeTotal / investmentTotal) * 100 : 60;
const bondPct = 100 - stockPct;
```

Replace `effectivePatrimony = simulatedPatrimony ?? patrimonyTotal` (~line 193) with:

```typescript
const effectiveInvestment = simulatedPatrimony ?? investmentTotal;
```

…and use `effectiveInvestment` everywhere `effectivePatrimony` was referenced (annual withdrawal calc, `computeProjection`, `<PatrimonySimulator value={...}>`). The `PatrimonySimulator`'s `patrimonyTotal` prop should also be `investmentTotal`, not `patrimonyTotal`.

This implements **B#2**: the rate now applies to investments only.

- [ ] **Step 2: Update call site — `StrategyDetailPage.tsx`**

In `react/src/pages/private/Planning/StrategyDetailPage.tsx`, replace the `case "vpw":` block (~lines 260-276):

```typescript
case "vpw":
  return (
    <VPWIndicator
      equityTotal={equityTotal}
      ifixTotal={ifixTotal}
      fixedIncomeTotal={fixedIncomeTotal}
      bankAmount={bankAmount}
      avgExpenses={avgExpenses}
      isLoading={isDataLoading || isReportsLoading}
      dateOfBirth={dateOfBirth}
      targetAge={vpwTargetAge}
      onTargetAgeChange={setVpwTargetAge}
      stockReturn={vpwStockReturn}
      onStockReturnChange={setVpwStockReturn}
      bondReturn={vpwBondReturn}
      onBondReturnChange={setVpwBondReturn}
    />
  );
```

(Removes `patrimonyTotal` and `variableIncomeTotal` props; adds `equityTotal`, `ifixTotal`, `bankAmount`. `equityTotal` and `ifixTotal` already exist on this page from the `useMemo` block at line 129.)

- [ ] **Step 3: Update call site — `PlanningHub.tsx`**

In `react/src/pages/private/Planning/PlanningHub.tsx`, replace the `vpw:` entry in `compactIndicators` (~lines 131-148):

```typescript
vpw: (
  <VPWIndicator
    equityTotal={equityTotal}
    ifixTotal={ifixTotal}
    fixedIncomeTotal={fixedIncomeTotal}
    bankAmount={bankAmount}
    avgExpenses={avgExpenses}
    isLoading={isDataLoading || isReportsLoading}
    dateOfBirth={dateOfBirth}
    targetAge={99}
    onTargetAgeChange={() => {}}
    stockReturn={5}
    onStockReturnChange={() => {}}
    bondReturn={3}
    onBondReturnChange={() => {}}
    compact
    hideLabel
  />
),
```

- [ ] **Step 4: Update call site — `Indicators.tsx`**

In `react/src/pages/private/Home/Indicators.tsx`, replace the VPW invocation (around line 275):

```typescript
<VPWIndicator
  equityTotal={equityTotal}
  ifixTotal={ifixTotal}
  fixedIncomeTotal={fixedIncomeTotal}
  bankAmount={bankAmount}
  avgExpenses={expensesIndicators?.fire_avg ?? 0}
  isLoading={isLoading || isExpensesIndicatorsLoading || isReportsLoading}
  dateOfBirth={dateOfBirth}
  targetAge={vpwTargetAge}
  onTargetAgeChange={setVpwTargetAge}
  stockReturn={vpwStockReturn}
  onStockReturnChange={setVpwStockReturn}
  bondReturn={vpwBondReturn}
  onBondReturnChange={setVpwBondReturn}
  compact
/>
```

(Removes `patrimonyTotal` and `variableIncomeTotal`.)

- [ ] **Step 5: Run typecheck**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 6: Manual verification — VPW page renders without crash**

Start the dev server:
```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npm run dev
```
Open `/planning/vpw`. Confirm:
- Bar renders (some coverage value visible).
- Chart renders the deterministic projection (still — full bootstrap chart comes in Task 6).
- No console errors.
- The `coverage` value should now be slightly lower than before for users with bank cash (because the rate is applied to investments only). This is the B#2 fix taking effect.

- [ ] **Step 7: Commit**

```bash
git add react/src/pages/private/Home/VPWIndicator.tsx \
        react/src/pages/private/Planning/StrategyDetailPage.tsx \
        react/src/pages/private/Planning/PlanningHub.tsx \
        react/src/pages/private/Home/Indicators.tsx
git commit -m "fix(planning/vpw): exclude bank cash from withdrawal computation

VPWIndicator now takes equityTotal/ifixTotal/fixedIncomeTotal/bankAmount
separately and applies the VPW rate to investment total only. Bank cash
is treated as untouched buffer (consistent with FIRE+age-in-bonds and
FinancialHealthSummary's emergency-fund framing).

Refs review 2026-04-26 finding B#2."
```

---

## Chunk 3: Allocation override slider

### Task 4: Add allocation override slider with reset (mirrors `PatrimonySimulator`)

Default allocation comes from the actual portfolio. User can override; "Resetar alocação" button reverts. The override changes both the PMT rate AND (in Task 6) the bootstrap weights.

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`

- [ ] **Step 1: Add override state and derived values**

In `VPWIndicator.tsx`, near the top of the component body (after the existing `useState` for `simulatedPatrimony`), add:

```typescript
const [overrideStockPct, setOverrideStockPct] = useState<number | null>(null);

const derivedStockPct = investmentTotal > 0 ? (variableIncomeTotal / investmentTotal) * 100 : 60;
const effectiveStockPct = overrideStockPct ?? derivedStockPct;
const effectiveBondPct = 100 - effectiveStockPct;
```

Then **replace** the existing `stockPct` / `bondPct` derivations with `effectiveStockPct` / `effectiveBondPct` everywhere in the component (the PMT call, the chart projection, the bar tooltip string, the "RV: X% / RF: Y%" label).

- [ ] **Step 2: Add the slider UI**

Insert a new row above the existing `targetAge / stockReturn / bondReturn` slider row (~line 335). Render only in non-compact mode:

```tsx
{!compact && (
  <Stack direction="row" alignItems="center" gap={2}>
    <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
      Alocação RV: {effectiveStockPct.toFixed(0)}% / RF: {effectiveBondPct.toFixed(0)}%
    </Text>
    <Slider
      value={effectiveStockPct}
      onChange={(_, value) => setOverrideStockPct(value as number)}
      min={0}
      max={100}
      step={5}
      size="medium"
      sx={sliderSx}
    />
    {overrideStockPct !== null && (
      <Button
        variant="brand-text"
        size="small"
        onClick={() => setOverrideStockPct(null)}
      >
        Resetar
      </Button>
    )}
  </Stack>
)}
```

(Add `import Button from "@mui/material/Button";` to the imports.)

- [ ] **Step 3: Update the duplicated "RV: X% / RF: Y%" label below the bar to read from `effectiveStockPct`**

The existing line `RV: {stockPct.toFixed(0)}% / RF: {bondPct.toFixed(0)}%` (~line 332) — replace `stockPct` and `bondPct` with `effectiveStockPct` / `effectiveBondPct`. Also wrap it: when `overrideStockPct !== null`, prefix the line with a faint "(simulado) " marker so the user can see they're not looking at their real composition:

```tsx
<Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
  Saque: {vpwRate.toFixed(1)}% a.a. · {hideValues ? "***" : formatCurrency(monthlyWithdrawal)}/mês
  {" · "}
  {overrideStockPct !== null && <span style={{ fontStyle: "italic" }}>(simulado) </span>}
  RV: {effectiveStockPct.toFixed(0)}% / RF: {effectiveBondPct.toFixed(0)}%
</Text>
```

- [ ] **Step 4: Manual verification**

Reload `/planning/vpw`:
- New row appears between bar and target-age row, showing the slider with current allocation value.
- Drag the slider — VPW rate, monthly withdrawal, and bar coverage update live.
- "Resetar" button appears once you've moved the slider; clicking it removes the button and snaps back to the derived value.
- The "RV: X% / RF: Y%" label below the bar mirrors the slider value and shows "(simulado)" while overridden.
- In hub compact mode, the slider does NOT appear.

- [ ] **Step 5: Run typecheck**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add react/src/pages/private/Home/VPWIndicator.tsx
git commit -m "feat(planning/vpw): allocation override slider with reset

Allocation is derived from portfolio composition by default. The new
slider lets the user override (mirroring PatrimonySimulator pattern)
and 'Resetar' reverts. The override drives the PMT rate; bootstrap
return-draws remain anchored to the actual portfolio in this commit
and switch to override-aware in the chart redesign.

Refs review 2026-04-26 finding A#1."
```

---

## Chunk 4: Bootstrap chart with dual Y-axis

### Task 5: Replace deterministic projection with bootstrap call; render dual-axis bands

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`

- [ ] **Step 1: Replace `computeProjection` with bootstrap call**

In `VPWIndicator.tsx`:

1. Remove the existing `computeProjection` function and its call inside the `projection` `useMemo` (around lines 83-113 and 209-221).
2. Remove the `ProjectionPoint` type.
3. Add the new bootstrap-driven projection. Add imports at the top:

```typescript
import {
  runBootstrapWithVaryingWithdrawal,
  computeWeights,
  type AllocationWeights,
  type WithdrawalAtFn,
} from "./fireBootstrap";
```

4. Replace the `useMemo` block with:

```typescript
type ChartPoint = {
  age: number;
  withdrawalP10: number;
  withdrawalP50: number;
  withdrawalP90: number;
  balanceP10: number;
  balanceP50: number;
  balanceP90: number;
  expenses: number;
};

const projection = useMemo<ChartPoint[]>(() => {
  if (currentAge === null || yearsRemaining === null || yearsRemaining <= 0) {
    return [];
  }

  // Bootstrap weights: rebalance to the user's effective allocation, preserving
  // the actual equity:ifix split inside the RV bucket. If the user has no RV
  // assets at all, default to 100% equity within RV (no IFIX history to draw
  // from in that scenario). RF maps directly to fixedIncome.
  const rvTotal = equityTotal + ifixTotal;
  const equityShareOfRv = rvTotal > 0 ? equityTotal / rvTotal : 1;
  const weights: AllocationWeights = {
    equity: (effectiveStockPct / 100) * equityShareOfRv,
    ifix: (effectiveStockPct / 100) * (1 - equityShareOfRv),
    fixedIncome: effectiveBondPct / 100,
  };

  const withdrawalAt: WithdrawalAtFn = (yearIndex, balance) => {
    const yearsLeft = yearsRemaining - yearIndex;
    if (yearsLeft <= 0) return balance; // final-year sweep
    const rate = computeVPWRate(
      effectiveStockPct,
      effectiveBondPct,
      yearsLeft,
      stockReturn,
      bondReturn,
    );
    return balance * (rate / 100);
  };

  const result = runBootstrapWithVaryingWithdrawal(
    effectiveInvestment,
    weights,
    yearsRemaining,
    withdrawalAt,
    1500,
  );

  // Map year-indexed bands to age-indexed chart points. Withdrawal bands have
  // length yearsRemaining; balance bands have length yearsRemaining + 1. Use
  // start-of-year balance and the in-year withdrawal at each age.
  return result.withdrawalBands.map((wBand, i) => {
    const balanceBand = result.balanceBands[i];
    return {
      age: currentAge + i,
      withdrawalP10: wBand.p10 / 12,
      withdrawalP50: wBand.p50 / 12,
      withdrawalP90: wBand.p90 / 12,
      balanceP10: balanceBand.p10,
      balanceP50: balanceBand.p50,
      balanceP90: balanceBand.p90,
      expenses: avgExpenses,
    };
  });
}, [
  effectiveInvestment,
  avgExpenses,
  currentAge,
  yearsRemaining,
  effectiveStockPct,
  effectiveBondPct,
  stockReturn,
  bondReturn,
  equityTotal,
  ifixTotal,
]);
```

- [ ] **Step 2: Replace the chart's data and series**

Replace the entire `<ResponsiveContainer>` block at the bottom of the component (~lines 386-430) with a dual-axis composed chart:

```tsx
{!compact && projection.length > 0 && (
  <ResponsiveContainer width="100%" height={240}>
    <ComposedChart
      data={projection}
      margin={{ top: 10, right: 10, left: 5, bottom: 0 }}
    >
      <CartesianGrid strokeDasharray="5" vertical={false} />
      <XAxis
        dataKey="age"
        stroke={getColor(Colors.neutral0)}
        tickLine={false}
        tickFormatter={(v) => `${v}`}
      />
      {/* LEFT axis: monthly cash flow (R$/mês) */}
      <YAxis
        yAxisId="cash"
        orientation="left"
        stroke={getColor(Colors.brand400)}
        tickLine={false}
        axisLine={false}
        tickFormatter={numberTickFormatter}
        tickCount={hideValues ? 0 : undefined}
      />
      {/* RIGHT axis: portfolio balance (R$) */}
      <YAxis
        yAxisId="balance"
        orientation="right"
        stroke={getColor(Colors.neutral400)}
        tickLine={false}
        axisLine={false}
        tickFormatter={numberTickFormatter}
        tickCount={hideValues ? 0 : undefined}
      />
      <RechartsTooltip
        cursor={false}
        content={<ChartTooltipContent hideValues={hideValues} />}
      />

      {/* Balance bands (right axis) — drawn first so they sit behind the cash bands */}
      <Line
        yAxisId="balance" type="monotone" dataKey="balanceP10"
        stroke={getColor(Colors.neutral500)} strokeWidth={1} strokeDasharray="3 3"
        dot={false} name="Patrimônio p10"
      />
      <Line
        yAxisId="balance" type="monotone" dataKey="balanceP50"
        stroke={getColor(Colors.neutral400)} strokeWidth={1.5}
        dot={false} name="Patrimônio mediana"
      />
      <Line
        yAxisId="balance" type="monotone" dataKey="balanceP90"
        stroke={getColor(Colors.neutral500)} strokeWidth={1} strokeDasharray="3 3"
        dot={false} name="Patrimônio p90"
      />

      {/* Withdrawal bands (left axis) */}
      <Line
        yAxisId="cash" type="monotone" dataKey="withdrawalP10"
        stroke={getColor(Colors.danger200)} strokeWidth={1.5} strokeDasharray="4 3"
        dot={false} name="Retirada p10"
      />
      <Line
        yAxisId="cash" type="monotone" dataKey="withdrawalP50"
        stroke={getColor(Colors.brand200)} strokeWidth={2}
        dot={false} name="Retirada mediana"
      />
      <Line
        yAxisId="cash" type="monotone" dataKey="withdrawalP90"
        stroke={getColor(Colors.brand)} strokeWidth={1.5} strokeDasharray="4 3"
        dot={false} name="Retirada p90"
      />

      {/* Expense reference (left axis) */}
      <Line
        yAxisId="cash" type="monotone" dataKey="expenses"
        stroke={getColor(Colors.danger200)} strokeWidth={2} strokeDasharray="5 5"
        dot={false} name="Despesas"
      />
    </ComposedChart>
  </ResponsiveContainer>
)}
```

- [ ] **Step 3: Rewrite `ChartTooltipContent` to handle the new shape**

Replace the existing `ChartTooltipContent` (~lines 115-151) with:

```typescript
const ChartTooltipContent = ({
  active,
  payload,
  hideValues,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  hideValues?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const fmt = (v: number) => (hideValues ? "***" : formatCurrency(v));
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
      <p style={{ color: getColor(Colors.neutral300) }}>Idade: {data.age}</p>
      <p style={{ color: getColor(Colors.brand400) }}>
        Retirada (mediana): {fmt(data.withdrawalP50)}/mês
      </p>
      <p style={{ color: getColor(Colors.neutral400), fontSize: "0.85em" }}>
        Faixa: {fmt(data.withdrawalP10)} – {fmt(data.withdrawalP90)}/mês
      </p>
      <p style={{ color: getColor(Colors.danger200) }}>
        Despesas: {fmt(data.expenses)}/mês
      </p>
      <p style={{ color: getColor(Colors.neutral400) }}>
        Patrimônio (mediana): {fmt(data.balanceP50)}
      </p>
      <p style={{ color: getColor(Colors.neutral500), fontSize: "0.85em" }}>
        Faixa: {fmt(data.balanceP10)} – {fmt(data.balanceP90)}
      </p>
    </Stack>
  );
};
```

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 5: Manual verification — chart**

Reload `/planning/vpw`. Confirm:
- Chart renders three withdrawal lines (p10 dashed red, p50 solid brand, p90 dashed brand) and three balance lines (p10 dashed gray, p50 solid gray, p90 dashed gray).
- Left Y-axis shows monthly currency in R$/mês scale.
- Right Y-axis shows balance in R$ scale.
- Expense dashed line is at flat avgExpenses.
- Hovering shows the tooltip with all 6 series + expenses.
- Balance lines visibly trend down to ~zero by target age.
- Dragging target age slider, return sliders, allocation slider, or patrimony simulator updates the chart smoothly.
- In `hideValues` mode, all currency strings show `***`.

- [ ] **Step 6: Commit**

```bash
git add react/src/pages/private/Home/VPWIndicator.tsx
git commit -m "feat(planning/vpw): bootstrap-based dual-axis chart

Replaces the deterministic projection with a 1500-trial bootstrap of
historical NEFIN/B3/IPCA returns, charting p10/p50/p90 bands for both
withdrawal stream (left axis, R\$/mês) and balance trajectory (right
axis, R\$). Bootstrap weights respect the user's allocation override
(Task 4) by preserving the actual equity:ifix split within the RV
bucket. Final-year balance sweep is handled in the withdrawal callback.

Closes review findings A#4, A#9, C#8, C#10."
```

---

## Chunk 5: Bar, label, and copy fixes

### Task 6: Update `strategyContent.tsx` for VPW

**Files:**
- Modify: `react/src/pages/private/Planning/strategyContent.tsx`

- [ ] **Step 1: Rewrite the `vpw.defaultsExplained` array**

In `strategyContent.tsx`, replace the existing `defaultsExplained` block for the `vpw` key (~lines 532-601) with:

```typescript
defaultsExplained: [
  {
    label: "O que significa a porcentagem na barra de progresso",
    explanation:
      "A barra mostra retirada mensal VPW ÷ despesas, calculada com a " +
      "taxa do ano atual. Atingir 100% significa que o saque cobre suas " +
      "despesas hoje — o saque cresce ao longo do tempo, então o gráfico " +
      "mostra a trajetória completa.",
  },
  {
    label: "Como a alocação RV/RF é determinada",
    explanation:
      "Por padrão, a alocação RV/RF é derivada do seu portfólio investido " +
      "(ações + FIIs como RV; renda fixa como RF). O dinheiro em conta é " +
      "tratado como reserva e não entra no cálculo do saque. Você pode " +
      "sobrescrever a alocação no slider para simular cenários — clique em " +
      "'Resetar' para voltar à alocação real.",
  },
  {
    label: "O que o gráfico mostra",
    explanation:
      "O gráfico simula 1500 trajetórias usando retornos históricos brasileiros " +
      "(NEFIN/B3/IPCA, 2001–2025) e mostra três bandas: p10 (10% piores), p50 " +
      "(mediana) e p90 (10% melhores). A retirada (eixo da esquerda, R$/mês) " +
      "varia trial a trial conforme os retornos sorteados; o patrimônio (eixo " +
      "da direita, R$) mostra a trajetória de consumo do portfólio. A linha " +
      "tracejada vermelha são suas despesas atuais.",
  },
  {
    label: "Por que o saque pode subir e depois cair",
    explanation:
      "O VPW aumenta a porcentagem de saque a cada ano (1/anos restantes via " +
      "fórmula PMT). Mas a porcentagem é aplicada ao saldo restante, que vai " +
      "encolhendo. Em retornos médios, o valor em reais sobe nas primeiras " +
      "décadas e cai nas últimas conforme o patrimônio se esgota. A queda " +
      "tardia é matematicamente inerente à estratégia, não um erro.",
  },
  {
    label: "O que significa o R$/mês ao lado da taxa de saque",
    explanation:
      "Na linha 'Saque: X% a.a. · R$ Y/mês', o R$/mês é o seu patrimônio " +
      "investido (sem o saldo em conta) multiplicado pela taxa VPW do ano " +
      "atual e dividido por 12. A taxa VPW é calculada via fórmula " +
      "financeira (PMT) considerando sua idade, idade alvo, alocação RV/RF " +
      "(efetiva, com override aplicado) e retornos esperados de cada classe.",
  },
  {
    label: "Idade alvo padrão: 99 anos",
    explanation:
      <>
        A{" "}
        <Link href="https://www.bogleheads.org/wiki/Variable_percentage_withdrawal" target="_blank" rel="noopener noreferrer">
          planilha oficial do VPW
        </Link>
        {" "}usa 'last withdrawal age of 99' e limita o saque a 10%
        do portfólio como segurança.
      </>,
  },
  {
    label: "Retorno real RV: 5% a.a.",
    explanation:
      <>
        O{" "}
        <Link href="https://insight.economatica.com/desempenho-do-ibovespa-50-anos-de-historia/" target="_blank" rel="noopener noreferrer">
          Ibovespa
        </Link>
        {" "}rendeu ~2% real a.a. (2000-2024) ou ~6% desde sua criação.
        5% é um meio-termo entre essas duas janelas. Esse parâmetro só
        afeta a fórmula PMT (taxa de saque agendada); o gráfico usa
        retornos históricos sorteados, não esse valor.
      </>,
  },
  {
    label: "Retorno real RF: 4% a.a.",
    explanation:
      <>
        O{" "}
        <Link href="https://borainvestir.b3.com.br/noticias/mercado/cdi-ibovespa-inflacao-veja-quanto-o-premio-do-primeiro-bbb-teria-rendido-de-2002-ate-hoje/" target="_blank" rel="noopener noreferrer">
          CDI
        </Link>
        {" "}real ficou em ~5,5% a.a. (2000-2024). 4% é um desconto
        conservador sobre a média histórica brasileira. Como acima, esse
        valor só afeta a fórmula PMT; o gráfico usa retornos históricos.
      </>,
  },
],
```

- [ ] **Step 2: Update the `vpw.cons` array**

Replace the `cons` array for the `vpw` key (~lines 619-631) with:

```typescript
cons: [
  {
    text:
      "Renda real varia ano a ano conforme os retornos do portfólio — " +
      "veja a faixa p10–p90 no gráfico.",
  },
  {
    text:
      "Patrimônio chega próximo de zero por construção — não sobra " +
      "herança significativa.",
  },
  {
    text: "Risco de longevidade se viver além da idade alvo.",
  },
],
```

- [ ] **Step 3: Manual verification**

Reload `/planning/vpw`. Click "Entenda esses valores":
- 8 items now visible (was 6).
- New "Como a alocação RV/RF é determinada" item explains derivation, override, bank exclusion.
- New "Por que o saque pode subir e depois cair" item explains the non-monotonic shape.
- "O que o gráfico mostra" now references the bootstrap, not the deterministic projection.
- Cons section's first item now references "p10–p90" range.

- [ ] **Step 4: Commit**

```bash
git add react/src/pages/private/Planning/strategyContent.tsx
git commit -m "docs(planning/vpw): update copy to match bootstrap chart and bank exclusion

- New 'allocation derivation' item explains the slider, override, reset,
  and bank-cash exclusion.
- New 'why withdrawal rises then falls' item explains the non-monotonic
  shape that emerges from VPW math.
- Chart-explanation item now references the historical bootstrap rather
  than the removed deterministic projection.
- Cons reworded to reference p10–p90 bands instead of asserting variance
  the chart didn't show.

Refs review 2026-04-26 findings A#4, A#9, C#8, C#10."
```

---

### Task 7: Bar tooltip + simulator-aware "Saque atual" label

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`

- [ ] **Step 1: Rewrite `tooltipTitle`**

In `VPWIndicator.tsx`, replace the `tooltipTitle` definition (~lines 272-276):

```typescript
const isSimulating = simulatedPatrimony !== null || overrideStockPct !== null;
const baseLabel = isSimulating ? "Saque simulado" : "Saque atual";
const tooltipTitle =
  `VPW: 100% = saque cobre despesas hoje. O saque cresce conforme você ` +
  `envelhece — veja o gráfico para a trajetória completa. ` +
  `Idade: ${currentAge}, meta: ${targetAge}, anos restantes: ${yearsRemaining}. ` +
  `Alocação efetiva: ${effectiveStockPct.toFixed(0)}% RV / ${effectiveBondPct.toFixed(0)}% RF` +
  `${overrideStockPct !== null ? " (override)" : ""}. ` +
  `${baseLabel}: ${vpwRate.toFixed(1)}% a.a. (${monthlyFormatted}/mês).`;
```

(Replaces the existing 3-line tooltip string. Adds `isSimulating` / `baseLabel` lines just before.)

- [ ] **Step 2: Manual verification**

- Hover over the bar with no overrides: tooltip starts with "VPW: 100% = saque cobre despesas hoje. …" and ends with "Saque atual: …".
- Drag the patrimony simulator: tooltip changes to "Saque simulado: …".
- Drag the allocation slider: tooltip shows "Alocação efetiva: X% RV / Y% RF (override). … Saque simulado: …".

- [ ] **Step 3: Commit**

```bash
git add react/src/pages/private/Home/VPWIndicator.tsx
git commit -m "fix(planning/vpw): bar tooltip explains VPW-specific bar semantics

Tooltip now leads with '100% = saque cobre despesas hoje' (not 'já está
financeiramente independente'). Label switches from 'Saque atual' to
'Saque simulado' whenever the patrimony simulator or allocation override
is active. Override allocation is flagged as such.

Refs review 2026-04-26 findings C#5, C#6."
```

---

### Task 8: Inert return slider gray-out + RF > RV warning

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`

- [ ] **Step 1: Compute slider-disabled state and warning state**

Near the top of the component body (after `effectiveBondPct` is defined), add:

```typescript
const stockReturnInert = effectiveStockPct < 0.01;
const bondReturnInert = effectiveBondPct < 0.01;
const returnsInverted = stockReturn < bondReturn;
```

- [ ] **Step 2: Wrap each return slider with disabled styling and helper text**

In the `targetAge / stockReturn / bondReturn` row, replace the stock-return slider section with:

```tsx
<Tooltip
  title={stockReturnInert ? "Sem efeito: alocação RV é 0%" : ""}
  arrow
  placement="top"
>
  <Stack direction="row" alignItems="center" gap={1} sx={{ opacity: stockReturnInert ? 0.4 : 1 }}>
    <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
      Retorno RV: {stockReturn}%
    </Text>
    <Slider
      value={stockReturn}
      onChange={(_, value) => onStockReturnChange(value as number)}
      min={3}
      max={15}
      step={0.5}
      size="medium"
      sx={sliderSx}
      disabled={stockReturnInert}
    />
  </Stack>
</Tooltip>
```

…and the bond-return slider section similarly:

```tsx
<Tooltip
  title={bondReturnInert ? "Sem efeito: alocação RF é 0%" : ""}
  arrow
  placement="top"
>
  <Stack direction="row" alignItems="center" gap={1} sx={{ opacity: bondReturnInert ? 0.4 : 1 }}>
    <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
      Retorno RF: {bondReturn}%
    </Text>
    <Slider
      value={bondReturn}
      onChange={(_, value) => onBondReturnChange(value as number)}
      min={1}
      max={8}
      step={0.5}
      size="medium"
      sx={sliderSx}
      disabled={bondReturnInert}
    />
  </Stack>
</Tooltip>
```

- [ ] **Step 3: Add RF > RV warning chip below the slider row**

After the slider row (and before `PatrimonySimulator`), add:

```tsx
{!compact && returnsInverted && (
  <Stack direction="row" alignItems="center" gap={1}>
    <Text size={FontSizes.EXTRA_SMALL} color={Colors.danger200}>
      ⚠ Retorno RF ({bondReturn}%) acima do RV ({stockReturn}%) — pouco usual
      historicamente; cheque os parâmetros.
    </Text>
  </Stack>
)}
```

(`Tooltip` is already imported.)

- [ ] **Step 4: Manual verification**

- Move the allocation slider to 0% RV: the "Retorno RV" slider becomes faded and disabled; hovering shows "Sem efeito: alocação RV é 0%".
- Move it to 100% RV: the "Retorno RF" slider becomes faded and disabled.
- Set RV return = 4, RF return = 5: warning row appears below sliders.
- Set RV return = 5, RF return = 4: warning disappears.

- [ ] **Step 5: Commit**

```bash
git add react/src/pages/private/Home/VPWIndicator.tsx
git commit -m "feat(planning/vpw): gray out inert return sliders + warn on RF>RV

Return sliders dim and disable when their bucket weight is 0% (with a
tooltip explaining why). A soft warning surfaces when bond return is
set above stock return, since that's economically unusual long-term.

Refs review 2026-04-26 findings B#3a, B#3b."
```

---

### Task 9: Visual differentiation between coverage% and VPW rate%

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`

- [ ] **Step 1: Label the bar's percentage explicitly**

In `VPWIndicator.tsx`, the bar's coverage display (~lines 309-325) currently shows just "65.4%". Change the bar overlay to render `Cobertura: 65.4%` (or `Cobertura: ***`) while keeping the same styling:

Find:
```tsx
<Text
  color={Colors.neutral0}
  weight={FontWeights.SEMI_BOLD}
  size={FontSizes.SEMI_SMALL}
>
  {coverage.toFixed(1)}%
</Text>
```

Replace with:
```tsx
<Text
  color={Colors.neutral0}
  weight={FontWeights.SEMI_BOLD}
  size={FontSizes.SEMI_SMALL}
>
  Cobertura: {coverage.toFixed(1)}%
</Text>
```

(Hidden-values branch unchanged.)

- [ ] **Step 2: Label the rate explicitly in the sublabel**

The line `Saque: {vpwRate.toFixed(1)}% a.a. · ...` already says "Saque" so it's fine — confirm it reads `Saque: 4.7% a.a.` in non-hidden mode, distinguishable from `Cobertura: 65.4%`.

- [ ] **Step 3: Manual verification**

- Bar reads `Cobertura: 65.4%` (or `Cobertura: ***`).
- Sublabel directly below reads `Saque: 4.7% a.a. · R$X/mês …`.
- Both percentages now have distinct semantic prefixes.

- [ ] **Step 4: Commit**

```bash
git add react/src/pages/private/Home/VPWIndicator.tsx
git commit -m "fix(planning/vpw): distinguish coverage% from VPW rate% visually

Bar's number now reads 'Cobertura: 65.4%' instead of just '65.4%', so
it can't be confused with the 'Saque: 4.7% a.a.' rate immediately
below. Both numbers used identical formatting, leading users to
conflate them.

Refs review 2026-04-26 finding C#21."
```

---

## Chunk 6: Final QA

### Task 10: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run lint and typecheck**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit && npm run lint
```
Expected: both exit 0. Fix any issues before continuing.

- [ ] **Step 2: Run tests**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx vitest run
```
Expected: all pass.

- [ ] **Step 3: Browser checklist on `/planning/vpw`**

Start dev server: `cd react && npm run dev`. Open `/planning/vpw` and verify each:

- [ ] Bar renders "Cobertura: X%" (not just X%).
- [ ] "Saque: Y% a.a. · R$Z/mês · RV: A% / RF: B%" sublabel appears.
- [ ] Allocation slider row appears with "Alocação RV: A% / RF: B%". Dragging updates RV/RF live.
- [ ] "Resetar" button appears after dragging allocation; clicking removes button and reverts.
- [ ] Target age + return sliders row works as before.
- [ ] Drag allocation to 0% RV: "Retorno RV" slider fades and disables.
- [ ] Drag allocation to 100% RV: "Retorno RF" slider fades and disables.
- [ ] Set RF return > RV return: warning row appears.
- [ ] Patrimony simulator slider works; "Resetar" button reverts.
- [ ] Chart shows three withdrawal bands (red dashed, brand solid, brand dashed) and three balance bands (gray) with dual axes.
- [ ] Hovering the chart shows the new tooltip with all 6 percentile values + expenses.
- [ ] Bar tooltip text reads "VPW: 100% = saque cobre despesas hoje. …".
- [ ] Toggle hide-values mode (eye icon): all currency values show `***`; chart renders without numeric axis ticks.
- [ ] Click "Entenda esses valores": 8 items appear; allocation explanation and "saque sobe e cai" explanation are present.
- [ ] Cons section's first item references "p10–p90".

- [ ] **Step 4: Browser checklist on `/planning` (hub)**

- [ ] VPW row's compact card renders without errors.
- [ ] No allocation slider, return sliders, or patrimony simulator in the compact card.
- [ ] Hub card click still navigates to `/planning/vpw`.

- [ ] **Step 5: Browser checklist on `/` (home)**

- [ ] If VPW is the active strategy, the home dashboard renders the VPW indicator without errors.
- [ ] Compact rendering omits the new sliders and chart.

- [ ] **Step 6: Commit any QA fixes**

If anything failed, fix it and commit per fix. If everything passed, no commit needed.

---

## Self-review notes

- All 22 review findings are accounted for in the Scope section (NOW / LATER / DROPPED).
- Every NOW item has a specific task that touches it.
- Type signatures are consistent: `WithdrawalAtFn`, `VaryingWithdrawalResult`, `BootstrapBand`, `AllocationWeights` are defined once in `fireBootstrap.ts` and imported elsewhere.
- The new `runBootstrapWithVaryingWithdrawal` returns `withdrawalBands` (length `horizon`) and `balanceBands` (length `horizon + 1`), and the chart consumer maps both into a single `ChartPoint[]` of length `horizon` indexed by age.
- Bank cash exclusion is enforced inside `VPWIndicator` (single source of truth) by computing the rate against `investmentTotal` only; no user-visible "bank cash" line per user direction.
- Allocation override applies to both PMT rate and bootstrap weights, with the equity:ifix split inside RV preserved from the actual portfolio.
- Final-year sweep in the withdrawal callback (`yearsLeft <= 0` returns the full balance) ensures bands terminate at zero.
- Tests cover: empty inputs, monotonicity (p10≤p50≤p90), determinism, full-depletion edge case.
