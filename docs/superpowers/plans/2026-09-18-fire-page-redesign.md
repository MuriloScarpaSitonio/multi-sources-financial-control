# FIRE Planning Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Simulation Studio as the default `/planning/fire` presentation while preserving the current FIRE UI behind a non-persisted Legacy/New switch.

**Architecture:** `FireDetail` remains the single owner of draft inputs and persistence. The new studio snapshots those draft values only on initial load or when the user presses `Recalculate`, then feeds that immutable snapshot through the existing Web Worker and existing indicator/result rendering; the legacy path continues receiving live draft values and therefore keeps its current automatic recalculation behavior. The redesign adds presentation components only and does not change simulation formulas, worker messages, API payloads, or database state.

**Tech Stack:** React 18, TypeScript, Material UI 6, Recharts, Vitest, Testing Library, existing FIRE Web Worker.

**Spec:** `docs/superpowers/specs/2026-09-18-fire-page-redesign-design.md`

## Global Constraints

- Do not change FIRE formulas, portfolio classification, historical-return data, preference semantics, or simulation methodology.
- Do not move simulation work to the backend.
- Do not persist the Legacy/New switch; `New` is the default on every mount.
- Do not remove or visually redesign the legacy presentation.
- The legacy presentation must retain automatic recalculation.
- The new presentation must recalculate only on initial load and explicit `Recalculate` clicks.
- Recalculation is not persistence; the existing header save action remains the only preference write.
- Use the existing `FireSimulationRequest`, `FireSimulationResult`, and Web Worker contract.
- Do not add a migration or modify user data.
- Do not commit after individual tasks. Per the product owner's instruction, make one commit only after the complete implementation has been reviewed and verified.

---

## File structure

- Create `react/src/pages/private/Planning/fire/fireStudioScenario.ts`: immutable draft/submitted scenario type and snapshot builder.
- Create `react/src/pages/private/Planning/fire/fireStudioScenario.test.ts`: exact request and snapshot coverage for constant-dollar and age-in-bonds modes.
- Create `react/src/pages/private/Planning/fire/FireResultsSkeleton.tsx`: complete results-column skeleton used only by the studio.
- Create `react/src/pages/private/Planning/fire/FireScenarioPanel.tsx`: scenario inputs, advanced assumptions, and explicit recalculation action.
- Create `react/src/pages/private/Planning/fire/FireScenarioPanel.test.tsx`: input, advanced-section, and recalculation interaction coverage.
- Create `react/src/pages/private/Planning/fire/FireResultsPanel.tsx`: submitted-scenario results, warning placement, errors, and `Adjust` action.
- Create `react/src/pages/private/Planning/fire/FireSimulationStudio.tsx`: responsive two-column shell, submitted-snapshot boundary, and collapse state.
- Create `react/src/pages/private/Planning/fire/FireSimulationStudio.test.tsx`: manual recalculation, loading, collapse, error, and adjustment-flow coverage.
- Create `react/src/pages/private/Planning/strategies/FireDetail.test.tsx`: Legacy/New integration and persistence regression coverage.
- Modify `react/src/pages/private/Planning/strategies/FireDetail.tsx`: preserve all draft/persistence ownership and select legacy or studio presentation.
- Modify `react/src/pages/private/Planning/StrategyHeader.tsx`: add an optional header action slot for the view switch without affecting other strategies.
- Modify `react/src/pages/private/Planning/FireHistoricalDataControls.tsx`: allow the studio to suppress its inline warning and target the controls for focus; defaults preserve legacy behavior.
- Modify `react/src/pages/private/Planning/FireHistoricalDataControls.test.tsx`: cover the new opt-in presentation props and preserve existing behavior.
- Modify `react/src/pages/private/Home/ConstantDollarIndicator.tsx`: add an opt-in studio result mode while leaving default legacy rendering unchanged.
- Modify `react/src/pages/private/Home/ConstantDollarAgeInBondsIndicator.tsx`: add the same opt-in studio result mode and controlled patrimony support.

---

### Task 1: Define immutable studio scenario snapshots

**Files:**
- Create: `react/src/pages/private/Planning/fire/fireStudioScenario.ts`
- Create: `react/src/pages/private/Planning/fire/fireStudioScenario.test.ts`

**Interfaces:**
- Consumes: `PortfolioSlice`, `SamplingMethod`, `FireSimulationRequest`.
- Produces: `FireStudioDraft`, `FireStudioSnapshot`, `buildFireStudioSnapshot(draft)`, and `resubmitFireStudioSnapshot(draft)`.

- [ ] **Step 1: Write failing constant-dollar and age-in-bonds snapshot tests**

```ts
import { describe, expect, it } from "vitest";

import {
  buildFireStudioSnapshot,
  resubmitFireStudioSnapshot,
  type FireStudioDraft,
} from "./fireStudioScenario";

const baseDraft: FireStudioDraft = {
  isReady: true,
  showAgeInBonds: false,
  currentAge: 40,
  patrimonyTotal: 1_000_000,
  simulatedPatrimony: null,
  avgExpenses: 10_000,
  expensesOverride: null,
  derivedMonthlySavings: 5_000,
  monthlySavingsOverride: null,
  withdrawalRate: 4,
  targetYears: 30,
  samplingMethod: "independent_months",
  portfolio: [],
};

describe("buildFireStudioSnapshot", () => {
  it("builds the existing constant-dollar worker request", () => {
    expect(buildFireStudioSnapshot(baseDraft)?.request).toEqual({
      kind: "constant_dollar",
      input: {
        targetYears: 30,
        portfolio: [],
        samplingMethod: "independent_months",
        annualExpenses: 120_000,
        withdrawalRate: 4,
        patrimonyTotal: 1_000_000,
        simulatedPatrimony: null,
        annualSavings: 60_000,
      },
    });
  });

  it("builds the existing age-in-bonds request", () => {
    expect(
      buildFireStudioSnapshot({ ...baseDraft, showAgeInBonds: true })?.request,
    ).toEqual({
      kind: "age_in_bonds",
      input: {
        currentAge: 40,
        targetYears: 30,
        portfolio: [],
        samplingMethod: "independent_months",
        effectivePatrimony: 1_000_000,
        annualExpenses: 120_000,
        annualSavings: 60_000,
        withdrawalRate: 4,
      },
    });
  });

  it("does not create a snapshot before source data is ready", () => {
    expect(buildFireStudioSnapshot({ ...baseDraft, isReady: false })).toBeNull();
  });

  it("clones the portfolio when the same draft is resubmitted", () => {
    const first = buildFireStudioSnapshot(baseDraft)!;
    const second = resubmitFireStudioSnapshot(baseDraft)!;
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.portfolio).not.toBe(first.portfolio);
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run from `react/`:

```bash
yarn vitest run src/pages/private/Planning/fire/fireStudioScenario.test.ts
```

Expected: FAIL because `fireStudioScenario.ts` does not exist.

- [ ] **Step 3: Implement the snapshot contract and builders**

```ts
import type { PortfolioSlice } from "../../Home/firePortfolio";
import type { SamplingMethod } from "../../Home/fireReturnTypes";
import type { FireSimulationRequest } from "../../Home/fireSimulation";

export type FireStudioDraft = {
  isReady: boolean;
  showAgeInBonds: boolean;
  currentAge: number | null;
  patrimonyTotal: number;
  simulatedPatrimony: number | null;
  avgExpenses: number;
  expensesOverride: number | null;
  derivedMonthlySavings: number;
  monthlySavingsOverride: number | null;
  withdrawalRate: number;
  targetYears: number;
  samplingMethod: SamplingMethod;
  portfolio: readonly PortfolioSlice[];
};

export type FireStudioSnapshot = {
  request: FireSimulationRequest | null;
  portfolio: readonly PortfolioSlice[];
  patrimonyTotal: number;
  effectivePatrimony: number;
  monthlyExpenses: number;
  monthlySavings: number;
  withdrawalRate: number;
  targetYears: number;
  samplingMethod: SamplingMethod;
  showAgeInBonds: boolean;
  currentAge: number | null;
};

export const buildFireStudioSnapshot = (
  draft: FireStudioDraft,
): FireStudioSnapshot | null => {
  if (!draft.isReady) return null;
  const portfolio = [...draft.portfolio];
  const effectivePatrimony = draft.simulatedPatrimony ?? draft.patrimonyTotal;
  const monthlyExpenses = draft.expensesOverride ?? draft.avgExpenses;
  const monthlySavings =
    draft.monthlySavingsOverride ?? draft.derivedMonthlySavings;
  const annualExpenses = monthlyExpenses * 12;
  const annualSavings = Math.max(0, monthlySavings) * 12;
  const request: FireSimulationRequest | null = draft.showAgeInBonds
    ? draft.currentAge === null
      ? null
      : {
          kind: "age_in_bonds",
          input: {
            currentAge: draft.currentAge,
            targetYears: draft.targetYears,
            portfolio,
            samplingMethod: draft.samplingMethod,
            effectivePatrimony,
            annualExpenses,
            annualSavings,
            withdrawalRate: draft.withdrawalRate,
          },
        }
    : {
        kind: "constant_dollar",
        input: {
          targetYears: draft.targetYears,
          portfolio,
          samplingMethod: draft.samplingMethod,
          annualExpenses,
          withdrawalRate: draft.withdrawalRate,
          patrimonyTotal: draft.patrimonyTotal,
          simulatedPatrimony: draft.simulatedPatrimony,
          annualSavings,
        },
      };
  return {
    request,
    portfolio,
    patrimonyTotal: draft.patrimonyTotal,
    effectivePatrimony,
    monthlyExpenses,
    monthlySavings,
    withdrawalRate: draft.withdrawalRate,
    targetYears: draft.targetYears,
    samplingMethod: draft.samplingMethod,
    showAgeInBonds: draft.showAgeInBonds,
    currentAge: draft.currentAge,
  };
};

export const resubmitFireStudioSnapshot = buildFireStudioSnapshot;
```

- [ ] **Step 4: Run the focused test**

Run: `yarn vitest run src/pages/private/Planning/fire/fireStudioScenario.test.ts`

Expected: PASS.

---

### Task 2: Add studio-only result and loading modes without changing legacy defaults

**Files:**
- Create: `react/src/pages/private/Planning/fire/FireResultsSkeleton.tsx`
- Modify: `react/src/pages/private/Home/ConstantDollarIndicator.tsx`
- Modify: `react/src/pages/private/Home/ConstantDollarAgeInBondsIndicator.tsx`
- Test: `react/src/pages/private/Planning/fire/FireSimulationStudio.test.tsx`

**Interfaces:**
- Consumes: the existing indicator props and existing `useFireSimulationWorker` state.
- Produces on both indicators: optional `presentation?: "legacy" | "studio"` and `onCalculationStateChange?: (state: FireCalculationState) => void` props. Age-in-bonds also gains optional controlled `simulatedPatrimony` and `onSimulatedPatrimonyChange` matching the constant-dollar component.

- [ ] **Step 1: Add a failing result-mode harness test**

Create the first test in `FireSimulationStudio.test.tsx` using the existing fake Worker pattern from `Home/useFireSimulationWorker.test.tsx`. Assert that a studio-mode indicator:

```ts
expect(screen.queryByText("Taxa: 4% a.a.")).not.toBeInTheDocument();
expect(screen.getByTestId("fire-results-skeleton")).toBeInTheDocument();
expect(onCalculationStateChange).toHaveBeenLastCalledWith({
  isCalculating: true,
  error: null,
});
```

Then respond through the fake worker and assert that the skeleton disappears. Rerender the same component without `presentation="studio"` and assert that its existing inline controls remain visible.

- [ ] **Step 2: Run the harness test and confirm it fails**

Run: `yarn vitest run src/pages/private/Planning/fire/FireSimulationStudio.test.tsx`

Expected: FAIL because the studio presentation props and skeleton do not exist.

- [ ] **Step 3: Implement the shared calculation-state type and skeleton**

Export this type from `FireResultsSkeleton.tsx` so both indicators and the studio use one contract:

```ts
export type FireCalculationState = {
  isCalculating: boolean;
  error: string | null;
};
```

Render a `Stack data-testid="fire-results-skeleton"` containing skeletons shaped like the final hierarchy: one progress card, one verdict card, one warning/metric row, and two chart rectangles. Do not use a spinner and do not leave old result text visible beneath the skeleton.

- [ ] **Step 4: Add opt-in studio behavior to both indicators**

In both indicators, retain `presentation = "legacy"` as the default. Add an effect that reports worker state:

```ts
useEffect(() => {
  onCalculationStateChange?.({ isCalculating, error: simulationError });
}, [isCalculating, onCalculationStateChange, simulationError]);
```

Before the existing legacy error/result branches, add studio-only full replacements:

```tsx
if (presentation === "studio" && isCalculating) {
  return <FireResultsSkeleton />;
}
if (presentation === "studio" && simulationError) {
  return <Alert severity="error">{simulationError}</Alert>;
}
```

Gate only the inline input rows, historical controls, inline loading text, and inline savings simulator behind `presentation === "legacy"`. Keep progress, verdicts, charts, scenario visibility controls, and explanations available in both modes. Do not change any default prop values, strings, worker requests, or calculations on the legacy path.

For `ConstantDollarAgeInBondsIndicator`, make simulated patrimony controlled with the same controlled/uncontrolled pattern already used by `ConstantDollarIndicator`; legacy callers that omit the new props continue using local state.

- [ ] **Step 5: Run focused worker and indicator tests**

Run:

```bash
yarn vitest run src/pages/private/Home/useFireSimulationWorker.test.tsx src/pages/private/Planning/fire/FireSimulationStudio.test.tsx
```

Expected: PASS, including the existing assertion that obsolete workers are terminated and the previous worker result is retained in legacy mode.

---

### Task 3: Build the scenario panel and advanced historical assumptions

**Files:**
- Create: `react/src/pages/private/Planning/fire/FireScenarioPanel.tsx`
- Create: `react/src/pages/private/Planning/fire/FireScenarioPanel.test.tsx`
- Modify: `react/src/pages/private/Planning/FireHistoricalDataControls.tsx`
- Modify: `react/src/pages/private/Planning/FireHistoricalDataControls.test.tsx`

**Interfaces:**
- Consumes: draft values and setters already owned by `FireDetail`, `allocation`, `localFirePreferences`, and `isCalculating`.
- Produces: `onRecalculate()`, `historicalControlsRef`, and an advanced section that can be opened programmatically.

- [ ] **Step 1: Write failing panel interaction tests**

Cover these exact behaviors:

```ts
expect(screen.getByRole("button", { name: "Recalcular" })).toBeEnabled();
await user.click(screen.getByText("Premissas avançadas"));
expect(screen.getByText("Dados históricos")).toBeVisible();
await user.click(screen.getByLabelText("Cripto"));
expect(onHistoricalPreferenceChange).toHaveBeenCalledWith(
  "excluded_return_categories",
  ["CRYPTO"],
);
expect(onRecalculate).not.toHaveBeenCalled();
await user.click(screen.getByRole("button", { name: "Recalcular" }));
expect(onRecalculate).toHaveBeenCalledTimes(1);
```

Rerender with `isCalculating` and assert the button is disabled and labeled `Recalculando…`.

- [ ] **Step 2: Add opt-in historical-control presentation props**

Extend `FireHistoricalDataControls` with:

```ts
showShortPeriodWarning?: boolean;
controlsRef?: React.Ref<HTMLDivElement>;
```

Default `showShortPeriodWarning` to `true`, wrap the root with a `div ref={controlsRef} tabIndex={-1}`, and render the current short-period alert only when the prop is true. The legacy caller supplies neither prop, so its output remains unchanged. Add a test showing that `showShortPeriodWarning={false}` hides only the warning while the period text remains.

- [ ] **Step 3: Implement the panel with existing input components**

The component props must include the current values/setters for patrimony, expenses, monthly savings, withdrawal rate, target years, sampling method, age-in-bonds, historical preferences, and allocation. Reuse `PatrimonySimulator`, `ExpenseSimulator`, `SavingsSimulator`, and `PersistedSlider`; do not introduce alternative parsing or financial normalization.

Use a controlled Material UI `Accordion` for `Premissas avançadas`. Inside it render `FireHistoricalDataControls` with `showShortPeriodWarning={false}`, then the age-in-bonds switch. Place the primary full-width `Recalcular` button at the bottom of the panel.

- [ ] **Step 4: Run panel and historical-control tests**

Run:

```bash
yarn vitest run src/pages/private/Planning/fire/FireScenarioPanel.test.tsx src/pages/private/Planning/FireHistoricalDataControls.test.tsx
```

Expected: PASS; the original historical-control tests must remain unchanged and green.

---

### Task 4: Compose results, warning adjustment, and responsive studio layout

**Files:**
- Create: `react/src/pages/private/Planning/fire/FireResultsPanel.tsx`
- Create: `react/src/pages/private/Planning/fire/FireSimulationStudio.tsx`
- Modify: `react/src/pages/private/Planning/fire/FireSimulationStudio.test.tsx`

**Interfaces:**
- Consumes: `draft: FireStudioDraft`, the draft setters needed by `FireScenarioPanel`, allocation metadata, and fixed/variable-income totals.
- Produces: a responsive studio that owns `submittedSnapshot`, `panelCollapsed`, `advancedOpen`, and calculation-state presentation.

Use this exact public prop contract:

```ts
type FireSimulationStudioProps = {
  draft: FireStudioDraft;
  allocation: readonly FireAllocationBucket[];
  firePreferences: Required<FirePlanningPreferences>;
  dateOfBirth: string | null;
  fixedIncomeTotal: number;
  variableIncomeTotal: number;
  isPersisting: boolean;
  onSimulatedPatrimonyChange: (value: number | null) => void;
  onExpensesChange: (value: number | null) => void;
  onMonthlySavingsChange: (value: number | null) => void;
  onWithdrawalRateChange: (value: number) => void;
  onTargetYearsChange: (value: number) => void;
  onSamplingMethodChange: (value: SamplingMethod) => void;
  onShowAgeInBondsChange: (value: boolean) => void;
  onHistoricalPreferenceChange: <K extends keyof Required<FirePlanningPreferences>>(
    field: K,
    value: Required<FirePlanningPreferences>[K],
  ) => void;
};
```

- [ ] **Step 1: Write failing studio orchestration tests**

Use the fake Worker and a rerenderable draft fixture. Verify:

1. The first ready draft starts exactly one worker request.
2. Editing/rerendering the draft starts no additional request.
3. Clicking `Recalcular` starts exactly one request containing the latest draft.
4. During that request the entire result area is `fire-results-skeleton`, and the button reads `Recalculando…`.
5. Worker success replaces the skeleton atomically.
6. Worker failure replaces the skeleton with an alert and retains the edited input.
7. `Recolher cenário` hides the panel on desktop, shows a narrow `Editar cenário` rail, and reopening restores the panel.
8. The short-period warning's `Ajustar` action reopens the panel, expands advanced assumptions, and focuses the historical controls.

- [ ] **Step 2: Implement submitted-snapshot ownership**

Use this state transition; draft changes must not replace the submitted snapshot:

```ts
const draftSnapshot = useMemo(() => buildFireStudioSnapshot(draft), [draft]);
const [submittedSnapshot, setSubmittedSnapshot] =
  useState<FireStudioSnapshot | null>(null);

useEffect(() => {
  if (submittedSnapshot === null && draftSnapshot !== null) {
    setSubmittedSnapshot(draftSnapshot);
  }
}, [draftSnapshot, submittedSnapshot]);

const handleRecalculate = () => {
  const next = resubmitFireStudioSnapshot(draft);
  if (next === null) return;
  setCalculationState({ isCalculating: next.request !== null, error: null });
  setSubmittedSnapshot(next);
};
```

The result indicator receives values exclusively from `submittedSnapshot`; the scenario panel receives live draft values. This is the manual recalculation boundary.

- [ ] **Step 3: Implement `FireResultsPanel`**

Select `ConstantDollarIndicator` or `ConstantDollarAgeInBondsIndicator` from the submitted snapshot. Pass `presentation="studio"`, no historical controls, no persistence, and the snapshot's values/portfolio. Forward `onCalculationStateChange` to the studio.

Calculate the submitted historical period with the existing `eligiblePeriod(snapshot.portfolio)`. When it has fewer than 120 months, render the same short-period warning prominently before the charts with an `Ajustar` button. The button calls `onAdjustHistoricalSources`; it does not mutate a source itself.

When `submittedSnapshot.request === null` because age-in-bonds lacks a birth date, render the existing birth-date guidance instead of a stale worker result.

For a worker error, render an error alert saying that the simulation could not be recalculated and that the draft values were preserved. Once the indicator reports `isCalculating: false`, leave the panel's `Recalcular` button enabled so it is the retry action.

- [ ] **Step 4: Implement desktop collapse and mobile disclosure**

Use Material UI responsive `sx` values:

```tsx
<Box
  sx={{
    display: "grid",
    gridTemplateColumns: {
      xs: "minmax(0, 1fr)",
      md: panelCollapsed ? "56px minmax(0, 1fr)" : "360px minmax(0, 1fr)",
    },
    gap: 2,
    alignItems: "start",
  }}
>
```

At `md` and wider, render the full panel or 56px rail. Below `md`, render a normal full-width `Editar cenário` disclosure above the result column and never render the rail. Use buttons with explicit accessible names `Recolher cenário`, `Expandir cenário`, and `Editar cenário`.

- [ ] **Step 5: Implement the adjustment focus flow**

`handleAdjustHistoricalSources` must set the panel open, set the advanced accordion open, and focus after React commits:

```ts
setPanelCollapsed(false);
setMobilePanelOpen(true);
setAdvancedOpen(true);
requestAnimationFrame(() => historicalControlsRef.current?.focus());
```

- [ ] **Step 6: Run the full studio tests**

Run: `yarn vitest run src/pages/private/Planning/fire/FireSimulationStudio.test.tsx`

Expected: PASS for initial calculation, draft isolation, explicit recalculation, skeleton/error transitions, responsive controls, and adjustment focus.

---

### Task 5: Integrate the Legacy/New switch in `FireDetail`

**Files:**
- Modify: `react/src/pages/private/Planning/StrategyHeader.tsx`
- Modify: `react/src/pages/private/Planning/strategies/FireDetail.tsx`
- Create: `react/src/pages/private/Planning/strategies/FireDetail.test.tsx`

**Interfaces:**
- Consumes: all existing `FireDetail` state and handlers.
- Produces: non-persisted local `view: "legacy" | "new"`, with `new` as the initial value.

- [ ] **Step 1: Write failing view-switch regression tests**

Mock only the data hooks and worker boundary needed to render `FireDetail`. Assert:

```ts
expect(screen.getByRole("button", { name: "New" })).toHaveAttribute(
  "aria-pressed",
  "true",
);
expect(screen.getByTestId("fire-simulation-studio")).toBeInTheDocument();

await user.click(screen.getByRole("button", { name: "Legacy" }));
expect(screen.queryByTestId("fire-simulation-studio")).not.toBeInTheDocument();
expect(screen.getByText("Retirada constante (FIRE)")).toBeInTheDocument();
expect(updatePreferences).not.toHaveBeenCalled();
```

Change a draft input in New, switch to Legacy and back, and assert the value is preserved. Assert that only the existing `Salvar alterações` action invokes `updatePreferences`.

- [ ] **Step 2: Add an optional header action slot**

Extend `StrategyHeaderProps` with `actions?: ReactNode`. Render it beside the existing save/active controls. Existing strategy callers omit it and retain identical output.

- [ ] **Step 3: Wire `FireDetail` without moving persistence ownership**

Add:

```ts
const [view, setView] = useState<"legacy" | "new">("new");
```

Pass a two-button `ButtonGroup` or `ToggleButtonGroup` through the header action slot. It updates only `view` and never calls `updatePreferences`.

Keep the existing `indicator` expression intact as the legacy branch. Build a `FireStudioDraft` from the same local state and derived data, then render:

```tsx
{view === "legacy" ? (
  <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>{indicator}</Paper>
) : (
  <FireSimulationStudio
    draft={studioDraft}
    allocation={allocation}
    firePreferences={localFirePreferences}
    dateOfBirth={dateOfBirth}
    fixedIncomeTotal={fixedIncomeTotal}
    variableIncomeTotal={variableIncomeTotal}
    isPersisting={isUpdating}
    onSimulatedPatrimonyChange={setSimulatedPatrimony}
    onExpensesChange={setExpensesOverride}
    onMonthlySavingsChange={setMonthlySavingsOverride}
    onWithdrawalRateChange={setWithdrawalRate}
    onTargetYearsChange={setTargetYears}
    onSamplingMethodChange={setSamplingMethod}
    onShowAgeInBondsChange={setShowAgeInBonds}
    onHistoricalPreferenceChange={(field, value) => {
      if (field === "us_equity_proxy") setUsEquityProxy(value as UsEquityProxy);
      if (field === "global_equity_proxy") {
        setGlobalEquityProxy(value as GlobalEquityProxy);
      }
      if (field === "crypto_proxy") setCryptoProxy(value as CryptoProxy);
      if (field === "excluded_return_categories") {
        setExcludedReturnCategories(value as ReturnCategory[]);
      }
    }}
  />
)}
```

In New, render `DefaultsPanel` collapsed beneath the studio for both allocation modes so the methodology remains available without competing with the primary results. In Legacy, preserve the current `showAgeInBonds` condition exactly. Keep the age-in-bonds explainer and strategy chrome in their current order. Do not persist `view` and do not add it to `isDirty` or `handleSave`.

- [ ] **Step 4: Run integration and regression tests**

Run:

```bash
yarn vitest run src/pages/private/Planning/strategies/FireDetail.test.tsx src/pages/private/Planning/FireHistoricalDataControls.test.tsx src/pages/private/Home/useFireSimulationWorker.test.tsx
```

Expected: PASS.

---

### Task 6: Verify the complete redesign and prepare the single final commit

**Files:**
- Verify all files listed above.
- Do not stage unrelated files, generated comparison artifacts, `.DS_Store`, or `.superpowers/`.

- [ ] **Step 1: Run all focused FIRE tests**

Run the three existing assertion scripts from `react/` with their current
runner:

```bash
yarn tsx src/pages/private/Home/fireBootstrap.test.ts
yarn tsx src/pages/private/Home/firePortfolio.test.ts
yarn tsx src/pages/private/Home/fireResultPresentation.test.ts
```

Then run the Vitest suites:

```bash
yarn vitest run \
  src/pages/private/Home/fireSimulation.test.ts \
  src/pages/private/Home/useFireSimulationWorker.test.tsx \
  src/pages/private/Planning/FireHistoricalDataControls.test.tsx \
  src/pages/private/Planning/fire/fireStudioScenario.test.ts \
  src/pages/private/Planning/fire/FireScenarioPanel.test.tsx \
  src/pages/private/Planning/fire/FireSimulationStudio.test.tsx \
  src/pages/private/Planning/strategies/FireDetail.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 2: Run static verification**

Run from `react/`:

```bash
yarn lint
yarn build
```

Expected: both commands exit 0.

- [ ] **Step 3: Manually verify both presentations at `/planning/fire`**

Check these exact flows in the running app:

- New is selected on page load.
- Editing every visible scenario input leaves the current results unchanged.
- `Recalcular` replaces the whole results column with skeletons and then swaps in one coherent result.
- The historical warning's `Ajustar` action opens and focuses the relevant advanced controls.
- Collapsing the desktop panel gives its width to results; reopening restores it.
- At a narrow viewport, the rail is absent and `Editar cenário` reveals the full-width panel above results.
- Switching to Legacy shows the pre-redesign UI and its automatic recalculation still works.
- Switching between views preserves draft values but does not call the preferences API.
- `Salvar alterações` persists exactly the fields it persisted before the redesign.

- [ ] **Step 4: Inspect the final diff before staging**

Run from `django/`:

```bash
git diff --check
git status --short
git diff -- ../react/src/pages/private/Planning ../react/src/pages/private/Home/ConstantDollarIndicator.tsx ../react/src/pages/private/Home/ConstantDollarAgeInBondsIndicator.tsx ../docs/superpowers
```

Expected: no whitespace errors; unrelated files remain unstaged and unchanged.

- [ ] **Step 5: Present the completed diff for product-owner review**

Do not commit yet. Report the verification results and explicitly remind the product owner to review the isolated Web Worker commit `48fa4ad` as previously requested.

- [ ] **Step 6: Make the single final commit only after explicit approval**

Stage only the approved redesign, its tests, the approved spec/plan, and the already-approved source-label bug fix files. Exclude `.superpowers/`, `.DS_Store`, and `vwra-vs-vwra11.html`.

```bash
git add \
  ../docs/superpowers/specs/2026-09-18-fire-page-redesign-design.md \
  ../docs/superpowers/plans/2026-09-18-fire-page-redesign.md \
  ../react/.eslintrc.cjs \
  ../react/src/pages/private/Home/ConstantDollarIndicator.tsx \
  ../react/src/pages/private/Home/ConstantDollarAgeInBondsIndicator.tsx \
  ../react/src/pages/private/Planning \
  variable_income_assets/fire_returns/sources.py \
  variable_income_assets/tests/test_scripts.py \
  ../react/src/pages/private/Home/fireReturns.ts
git commit -m "feat: redesign FIRE planning workspace"
```

Expected: one final commit created only after approval; unrelated untracked files remain untouched.
