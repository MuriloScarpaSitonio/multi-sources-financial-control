# VPW Accumulation Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Answer "how much more money do I need to gather, and how long until I get there?" on `/planning/vpw`. Add a deterministic accumulation-phase chart above the existing bootstrap withdrawal chart, plus gap and time-to-reach sublabels next to the bar. Mirror the pattern already in place on `OneOverNIndicator`.

**Architecture:** The existing withdrawal-phase visualizer stays unchanged ("if I retire today, here's the rest"). Add a SECOND chart above it for the accumulation phase ("here's how long it takes to get there"). Two charts, separated visually because one is deterministic (single line for patrimony, single line for shrinking VPW target) and the other is stochastic (six bootstrap bands on dual Y-axis); merging would overload the visual budget.

**Key VPW-specific subtlety:** Unlike OneOverN whose target is fixed at `yearsRemaining × 12 × monthlyExpenses`, VPW's target **shrinks each year you delay** retirement. If you retire at `currentAge + k`, then `yearsAtRetirement = targetAge − (currentAge + k)` is smaller, the VPW rate (PMT formula) is higher, and the patrimony required to cover today's expenses is lower. Both forces work in the user's favor: rising patrimony meets a falling target. The chart shows both curves and the crossover year.

**Tech Stack:** React, TypeScript, MUI, Recharts.

**Pre-reads for the implementer:**
- `react/src/pages/private/Home/OneOverNIndicator.tsx` — full reference pattern (computeProjection two-phase, SavingsSimulator wiring, gap+time labels, ReferenceLine at crossover)
- `react/src/pages/private/Home/SavingsSimulator.tsx` — already-built input component to reuse
- `react/src/pages/private/Home/VPWIndicator.tsx` — current state post the previous plan; the file we're modifying
- `react/src/pages/private/Home/fireBootstrap.ts` — bootstrap helpers (we don't need to add new ones, just reference the math conventions)

---

## Scope

**Implemented in this plan:**
- New deterministic accumulation projection (`computeAccumulation`) that simulates patrimony growth via savings + return until it crosses the (shrinking) VPW target.
- New accumulation chart rendered above the existing bootstrap chart on `/planning/vpw` (non-compact only).
- Two new sublabels next to the existing bar: "Falta juntar R$X para começar VPW hoje" and "Em N anos no seu ritmo (aposenta aos M)".
- New `<SavingsSimulator>` rendered next to the existing `<PatrimonySimulator>`.
- New `avgMonthlySavings: number` prop on `VPWIndicator`. Three call sites updated.

**Explicitly out of scope:**
- Any change to the existing bootstrap chart, sliders, copy, or tooltip from the previous plan.
- Changes to other strategies' indicators or to the centralized `monthlySavingsOverride` in `StrategyDetailPage.tsx` (we'll wire VPW like OneOverN — own internal `simulatedSavings` state, no centralized override).
- Backend or API changes.

---

## File structure

**Modified:**
- `react/src/pages/private/Home/VPWIndicator.tsx` — add `avgMonthlySavings` prop, `simulatedSavings` state, `<SavingsSimulator>`, accumulation projection useMemo, accumulation chart, gap+time sublabels.
- `react/src/pages/private/Planning/StrategyDetailPage.tsx` — pass `avgMonthlySavings={derivedMonthlySavings}` to VPW (mirroring how OneOverN gets it on line 277).
- `react/src/pages/private/Planning/PlanningHub.tsx` — pass `avgMonthlySavings={avgMonthlySavings}` to VPW compact card.
- `react/src/pages/private/Home/Indicators.tsx` — pass `avgMonthlySavings={monthlySavings}` to VPW compact card.

**Created:** none. All math lives inside `VPWIndicator.tsx` (consistent with how OneOverN keeps its `computeProjection` local).

---

## Math conventions

**Real return for accumulation** is the blended deterministic return based on the user's effective allocation:

```ts
const realReturn = (effectiveStockPct * stockReturn + effectiveBondPct * bondReturn) / 100 / 100;
```

Same formula `computeVPWRate` already uses internally. The user's `stockReturn` and `bondReturn` slider values feed both the PMT rate (existing) and the accumulation growth (new).

**VPW target at year `k`** (the patrimony required to retire k years from now and have VPW cover today's expenses immediately):

```ts
const yearsAtRetirement = yearsRemaining - k; // = targetAge - (currentAge + k)
const rate = computeVPWRate(
  effectiveStockPct, effectiveBondPct,
  yearsAtRetirement,
  stockReturn, bondReturn,
);
const target = avgExpenses * 1200 / rate; // 12 months × (100/rate%)
```

When `yearsAtRetirement <= 0`, retirement is impossible and the loop stops. When `yearsAtRetirement === 1`, `pmt(r, 1)` returns `−(1+r)`, so `rate ≈ 100%(1+r)`, and `target ≈ avgExpenses × 12 / (1 + realReturn_pmt_assumption)` — small enough to be plausible. No special handling needed.

**Accumulation step** (start-of-year balance, end-of-year apply growth + savings, matching OneOverN convention):

```ts
balance = balance * (1 + realReturn) + monthlySavings * 12;
```

**Crossover** is the first `y` where `balance >= target_y`. Capped at `MAX_ACCUM_YEARS = 80` (same as OneOverN).

---

## Chunk 1: Wire the prop through

### Task 1: Add `avgMonthlySavings` prop and `simulatedSavings` state

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`
- Modify: `react/src/pages/private/Planning/StrategyDetailPage.tsx`
- Modify: `react/src/pages/private/Planning/PlanningHub.tsx`
- Modify: `react/src/pages/private/Home/Indicators.tsx`

This task is pure plumbing — no new UI yet. The prop just threads through. Self-verify with `tsc --noEmit`.

- [ ] **Step 1: Add `avgMonthlySavings` prop to `VPWIndicator`**

In `react/src/pages/private/Home/VPWIndicator.tsx`, add the prop to the destructured params and the type. Insert immediately after `avgExpenses`:

```ts
avgMonthlySavings,
```

…and in the type:

```ts
avgMonthlySavings: number;
```

- [ ] **Step 2: Add the `simulatedSavings` state**

In the same file, immediately after the existing `simulatedPatrimony` and `overrideStockPct` state hooks, add:

```ts
const [simulatedSavings, setSimulatedSavings] = useState<number | null>(null);
const effectiveSavings = simulatedSavings ?? Math.max(0, avgMonthlySavings);
```

`Math.max(0, ...)` clamps negative savings (user spends more than earns) to zero — same convention OneOverN uses (line 228 of `OneOverNIndicator.tsx`).

- [ ] **Step 3: Update `StrategyDetailPage.tsx`**

In the `case "vpw":` block (around line 261), add `avgMonthlySavings={derivedMonthlySavings}` to the `<VPWIndicator>` invocation. `derivedMonthlySavings` is already in scope on line 138.

Use `derivedMonthlySavings` (not the centralized `monthlySavings`) so VPW manages its own override state internally — same pattern OneOverN uses on line 277.

- [ ] **Step 4: Update `PlanningHub.tsx`**

In `compactIndicators.vpw` (around line 131), add `avgMonthlySavings={avgMonthlySavings}` to the `<VPWIndicator>` invocation. `avgMonthlySavings` is already computed at line 78.

- [ ] **Step 5: Update `Indicators.tsx`**

Find the `<VPWIndicator>` block (around line 275). Add `avgMonthlySavings={monthlySavings}` (or whatever the local variable is — verify in the file). The local is at line 139 of `Indicators.tsx`.

- [ ] **Step 6: Verify**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit
```
Expected: exits 0.

If you see stale errors about `AGE_IN_BONDS_RATIONALE` etc., delete `tsconfig.tsbuildinfo` (in `react/`) and retry.

- [ ] **Step 7: ❌ DO NOT COMMIT** (rule applies for the whole plan).

---

## Chunk 2: Accumulation projection math

### Task 2: Add `computeAccumulation` helper and the projection useMemo

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`

- [ ] **Step 1: Add `MAX_ACCUM_YEARS` and the `AccumulationPoint` type**

Near the top of `VPWIndicator.tsx` (next to the existing `ChartPoint` type definition), add:

```ts
const MAX_ACCUM_YEARS = 80;

type AccumulationPoint = {
  year: number;
  age: number;
  patrimony: number;
  target: number;
};

type AccumulationResult = {
  points: AccumulationPoint[];
  crossoverYear: number | null; // null = never crosses within MAX_ACCUM_YEARS
  initialGap: number;            // max(0, target_0 - currentInvestment)
};
```

- [ ] **Step 2: Add the `computeAccumulation` function**

Add as a module-private helper (top of the file, alongside the existing `pmt`, `computeVPWRate`, `computeAge`):

```ts
const computeAccumulation = ({
  startingInvestment,
  monthlySavings,
  monthlyExpenses,
  rvPct,
  rfPct,
  stockReturn,
  bondReturn,
  yearsRemaining,
  currentAge,
}: {
  startingInvestment: number;
  monthlySavings: number;
  monthlyExpenses: number;
  rvPct: number;
  rfPct: number;
  stockReturn: number;
  bondReturn: number;
  yearsRemaining: number; // targetAge - currentAge
  currentAge: number;
}): AccumulationResult => {
  const realReturn = (rvPct * stockReturn + rfPct * bondReturn) / 100 / 100;

  const targetAtYear = (k: number): number => {
    const yearsAtRetirement = yearsRemaining - k;
    if (yearsAtRetirement <= 0) return Infinity; // cannot retire at or after targetAge
    const rate = computeVPWRate(rvPct, rfPct, yearsAtRetirement, stockReturn, bondReturn);
    return (monthlyExpenses * 1200) / rate;
  };

  const target0 = targetAtYear(0);
  const initialGap = Math.max(0, target0 - startingInvestment);

  const points: AccumulationPoint[] = [
    { year: 0, age: currentAge, patrimony: startingInvestment, target: target0 },
  ];
  let balance = startingInvestment;
  let crossoverYear: number | null = balance >= target0 ? 0 : null;

  if (crossoverYear === null) {
    const cap = Math.min(MAX_ACCUM_YEARS, yearsRemaining - 1);
    for (let y = 1; y <= cap; y++) {
      balance = balance * (1 + realReturn) + monthlySavings * 12;
      const target = targetAtYear(y);
      points.push({ year: y, age: currentAge + y, patrimony: balance, target });
      if (balance >= target) {
        crossoverYear = y;
        break;
      }
    }
  }

  return { points, crossoverYear, initialGap };
};
```

- [ ] **Step 3: Add the `accumulation` useMemo inside the component**

Inside `VPWIndicator`, add a new `useMemo` next to (above or below) the existing `projection` useMemo:

```ts
const accumulation = useMemo<AccumulationResult | null>(() => {
  if (currentAge === null || yearsRemaining === null || yearsRemaining <= 0) {
    return null;
  }
  return computeAccumulation({
    startingInvestment: effectiveInvestment,
    monthlySavings: effectiveSavings,
    monthlyExpenses: avgExpenses,
    rvPct: effectiveStockPct,
    rfPct: effectiveBondPct,
    stockReturn,
    bondReturn,
    yearsRemaining,
    currentAge,
  });
}, [
  effectiveInvestment,
  effectiveSavings,
  avgExpenses,
  effectiveStockPct,
  effectiveBondPct,
  stockReturn,
  bondReturn,
  yearsRemaining,
  currentAge,
]);
```

- [ ] **Step 4: Verify**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 5: ❌ DO NOT COMMIT.**

---

## Chunk 3: UI — sublabels, savings simulator, and accumulation chart

### Task 3: Render `<SavingsSimulator>` next to `<PatrimonySimulator>`

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`

- [ ] **Step 1: Import `SavingsSimulator`**

Add to the imports near the top of the file:

```ts
import SavingsSimulator from "./SavingsSimulator";
```

- [ ] **Step 2: Render the simulator**

Find the existing `<PatrimonySimulator>` block. Immediately after it (still inside the same parent Stack), add:

```tsx
<SavingsSimulator
  value={effectiveSavings}
  onChange={setSimulatedSavings}
  onReset={() => setSimulatedSavings(null)}
  avgMonthlySavings={Math.max(0, avgMonthlySavings)}
  showReset={simulatedSavings !== null}
/>
```

Both simulators must render only in non-compact mode — confirm the wrapping `!compact &&` already covers `<PatrimonySimulator>` and that `<SavingsSimulator>` falls inside the same conditional.

- [ ] **Step 3: Verify**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 4: ❌ DO NOT COMMIT.**

---

### Task 4: Add gap and time-to-reach sublabels next to the bar

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`

- [ ] **Step 1: Compute the labels**

Inside the component, after the `accumulation` useMemo, add:

```ts
const accumulationLabels = useMemo(() => {
  if (!accumulation) return null;
  const { crossoverYear, initialGap } = accumulation;

  if (initialGap === 0) {
    return {
      gapText: "Já cobre o alvo VPW",
      timeText: `Pode aposentar hoje aos ${currentAge} anos`,
      gapIsBad: false,
      timeIsBad: false,
    };
  }

  const gapText = `Falta juntar ${
    hideValues ? "***" : formatCurrency(initialGap)
  } para começar VPW hoje`;

  if (crossoverYear !== null) {
    return {
      gapText,
      timeText: `Em ${crossoverYear} ${
        crossoverYear === 1 ? "ano" : "anos"
      } no seu ritmo (aposenta aos ${(currentAge ?? 0) + crossoverYear})`,
      gapIsBad: true,
      timeIsBad: false,
    };
  }

  return {
    gapText,
    timeText: `Mais de ${MAX_ACCUM_YEARS} anos no seu ritmo — aumente os aportes ou o retorno`,
    gapIsBad: true,
    timeIsBad: true,
  };
}, [accumulation, currentAge, hideValues]);
```

- [ ] **Step 2: Render the labels**

Find the existing sublabel row (the `<Stack direction="row">` containing the "Saque: X% a.a. · R$Y/mês" `<Text>`). Wrap it in `flexWrap="wrap"` if not already. Inside that same row, after the existing "Saque" `<Text>`, conditionally render the new pair:

```tsx
{!compact && accumulationLabels && (
  <>
    <Text
      size={FontSizes.EXTRA_SMALL}
      color={accumulationLabels.gapIsBad ? Colors.danger200 : Colors.brand}
      weight={FontWeights.MEDIUM}
    >
      {accumulationLabels.gapText}
    </Text>
    <Text
      size={FontSizes.EXTRA_SMALL}
      color={accumulationLabels.timeIsBad ? Colors.danger200 : Colors.neutral200}
      weight={FontWeights.MEDIUM}
    >
      {accumulationLabels.timeText}
    </Text>
  </>
)}
```

(Mirrors `OneOverNIndicator.tsx` lines 404-421.)

If `Colors.neutral200` doesn't exist in the design system, fall back to `Colors.neutral400`. Verify by reading the imports/usage in OneOverN — if OneOverN compiles with `Colors.neutral200`, it exists.

- [ ] **Step 3: Verify**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit
```
Expected: exits 0.

If `Colors.neutral200` is missing: report BLOCKED with the exact tsc error and the plan owner will substitute.

- [ ] **Step 4: ❌ DO NOT COMMIT.**

---

### Task 5: Add the accumulation chart above the existing bootstrap chart

**Files:**
- Modify: `react/src/pages/private/Home/VPWIndicator.tsx`

- [ ] **Step 1: Add a small `AccumulationTooltipContent` component**

Add near the existing `ChartTooltipContent` (above or below — same level):

```tsx
const AccumulationTooltipContent = ({
  active,
  payload,
  hideValues,
}: {
  active?: boolean;
  payload?: { payload: AccumulationPoint }[];
  hideValues?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const fmt = (v: number) => (hideValues ? "***" : formatCurrency(v));
  const gap = Math.max(0, data.target - data.patrimony);
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
      <p style={{ color: getColor(Colors.neutral300) }}>
        Ano {data.year} (idade {data.age})
      </p>
      <p style={{ color: getColor(Colors.brand400) }}>
        Patrimônio: {fmt(data.patrimony)}
      </p>
      <p style={{ color: getColor(Colors.danger200) }}>
        Meta VPW: {fmt(data.target)}
      </p>
      <p style={{ color: gap > 0 ? getColor(Colors.danger200) : getColor(Colors.brand) }}>
        {gap > 0 ? `Falta: ${fmt(gap)}` : `Sobra: ${fmt(-gap || 0)}`}
      </p>
    </Stack>
  );
};
```

- [ ] **Step 2: Add `ReferenceLine` to the existing recharts imports**

Find the existing recharts import block:

```ts
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
```

Add `ReferenceLine`:

```ts
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
```

- [ ] **Step 3: Render the accumulation chart above the existing bootstrap chart**

Find the existing bootstrap `<ResponsiveContainer>` block (the one with dual Y-axis, `height={240}`, six band lines). **Immediately above it**, in the same parent Stack, add a new `<ResponsiveContainer>`:

```tsx
{!compact && accumulation && accumulation.points.length > 1 && (
  <Stack gap={0.5}>
    <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
      Acumulação — quando o patrimônio (em verde) cruza a meta (em vermelho), você pode começar VPW
    </Text>
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart
        data={accumulation.points}
        margin={{ top: 18, right: 8, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="5" vertical={false} />
        <XAxis
          dataKey="year"
          stroke={getColor(Colors.neutral0)}
          tickLine={false}
          tickFormatter={(v) => `${v}a`}
        />
        <YAxis
          stroke={getColor(Colors.neutral0)}
          tickLine={false}
          axisLine={false}
          tickFormatter={numberTickFormatter}
          tickCount={hideValues ? 0 : undefined}
        />
        <RechartsTooltip
          cursor={false}
          content={<AccumulationTooltipContent hideValues={hideValues} />}
        />
        <Line
          type="monotone"
          dataKey="patrimony"
          stroke={getColor(Colors.brand)}
          strokeWidth={2.5}
          dot={false}
          name="Patrimônio projetado"
        />
        <Line
          type="monotone"
          dataKey="target"
          stroke={getColor(Colors.danger200)}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          name="Meta VPW"
        />
        {accumulation.crossoverYear !== null && accumulation.crossoverYear > 0 && (
          <ReferenceLine
            x={accumulation.crossoverYear}
            stroke={getColor(Colors.brand)}
            strokeDasharray="3 3"
            label={{
              value: `aposenta aos ${(currentAge ?? 0) + accumulation.crossoverYear}`,
              position: "top",
              fill: getColor(Colors.brand),
              fontSize: 12,
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  </Stack>
)}
```

- [ ] **Step 4: Add a header label above the existing bootstrap chart**

To clarify the framing now that two charts coexist, find the existing bootstrap `<ResponsiveContainer>` and wrap it in a Stack with a small header text:

Replace the existing structure:

```tsx
{!compact && projection.length > 0 && (
  <ResponsiveContainer width="100%" height={240}>
    <ComposedChart ...
```

With:

```tsx
{!compact && projection.length > 0 && (
  <Stack gap={0.5}>
    <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
      Aposentadoria — se você se aposentar hoje, retiradas e patrimônio ao longo da vida (1500 trajetórias)
    </Text>
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart ...
```

…and close the Stack at the end (after `</ResponsiveContainer>`):

```tsx
    </ResponsiveContainer>
  </Stack>
)}
```

- [ ] **Step 5: Verify**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 6: ❌ DO NOT COMMIT.**

---

## Chunk 4: Final QA

### Task 6: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run typecheck**

```bash
cd /Users/murilo/github/multi-sources-financial-control/react && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 2: Browser checklist on `/planning/vpw`**

Start the dev server (`npm run dev`) and verify:

- [ ] The bar still reads `Cobertura: X%`. The "Saque: X% a.a. · R$Y/mês" sublabel is unchanged.
- [ ] **NEW:** Two new sublabels appear next to "Saque": "Falta juntar R$X para começar VPW hoje" (red when gap > 0) and "Em N anos no seu ritmo (aposenta aos M)".
- [ ] If the user already has Cobertura ≥ 100%: gap text reads "Já cobre o alvo VPW" and time text reads "Pode aposentar hoje aos {age} anos".
- [ ] If the gap is reachable within 80 years: time text shows the year count.
- [ ] If unreachable in 80 years: time text reads "Mais de 80 anos no seu ritmo — aumente os aportes ou o retorno".
- [ ] **NEW:** A Savings simulator row appears below the Patrimony simulator (similar TextField + Slider + Resetar layout).
- [ ] Dragging the Savings slider down to 0 makes the time text grow (or become unreachable). Dragging it up shortens it.
- [ ] **NEW:** A new chart with the header "Acumulação — quando o patrimônio (em verde) cruza a meta (em vermelho), você pode começar VPW" sits ABOVE the existing bootstrap chart.
- [ ] The accumulation chart shows two lines: a rising green line (patrimony) and a falling dashed red line (meta VPW). They cross at the crossover year, marked with a vertical brand-colored dashed line and label "aposenta aos {age}".
- [ ] Hovering the accumulation chart shows a tooltip with year, age, patrimony, meta, and falta/sobra.
- [ ] The existing bootstrap chart sits below the accumulation chart, now with header "Aposentadoria — se você se aposentar hoje, retiradas e patrimônio ao longo da vida (1500 trajetórias)". Its content is unchanged.
- [ ] In `hideValues` mode, all currency values across both charts and both sublabels show `***`.
- [ ] Dragging Patrimony, Allocation, Target Age, RV/RF return, or Savings sliders updates BOTH charts and BOTH new sublabels in real time.
- [ ] If the user has no DOB set, the page shows the existing "configure sua data de nascimento" message and no charts. (Unchanged behavior — guard rails should still work.)
- [ ] If the user is older than `targetAge`, the page shows the existing "idade alvo deve ser maior que sua idade atual" error. (Unchanged.)

- [ ] **Step 3: Browser checklist on `/planning` (hub)**

- [ ] VPW compact card still renders. No accumulation chart, no savings simulator, no gap/time labels in the compact card. (All gated by `!compact`.)

- [ ] **Step 4: Browser checklist on `/` (home)**

- [ ] If VPW is the active strategy, the home dashboard renders without errors and without the accumulation extras.

- [ ] **Step 5: Edge cases to spot-check**

- [ ] User with `derivedMonthlySavings < 0` (spending more than earning): the simulator default shows 0 (clamped) and the time label shows ">80 years" unless the user overrides upward.
- [ ] User who can already retire today (Cobertura ≥ 100%): the accumulation chart still renders with `crossoverYear === 0`, no ReferenceLine appears (because the condition is `> 0`), the green and red lines may overlap at year 0.

- [ ] **Step 6: ❌ DO NOT COMMIT.** Report back with any issues found.

---

## Self-review notes

- All scope items map to a task: prop wiring (Task 1), accumulation math (Task 2), simulator UI (Task 3), sublabels (Task 4), chart (Task 5), QA (Task 6).
- Type names are consistent throughout: `AccumulationPoint`, `AccumulationResult`, `MAX_ACCUM_YEARS`. No collisions with the existing `ChartPoint`.
- Math correctness:
  - `targetAtYear` returns `Infinity` for `yearsAtRetirement <= 0`, so `Math.max(0, target - balance)` will be `Infinity` — gap stays large, never closes. The loop bound `yearsRemaining - 1` prevents reaching this case in normal flow.
  - The deterministic real return for accumulation uses the user's effective allocation, so the allocation slider affects both rate-schedule and accumulation. Consistent with the user's mental model.
- File-size watch: `VPWIndicator.tsx` is currently ~570 lines after the previous plan. This plan adds ~200 more lines (math helper, useMemo, simulator wiring, new chart, new tooltip). Final estimate ~770 lines. The earlier reviewer's recommendation to extract `pmt`/`computeVPWRate`/`computeAge` into a `vpwMath.ts` module remains pending; it would be the right next refactor if/when this file becomes painful to navigate. Out of scope here.
- No `git commit` steps anywhere. The user's standing rule applies.
