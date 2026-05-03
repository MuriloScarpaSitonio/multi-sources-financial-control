# Planning Page Redesign: Hub + Dedicated Strategy Pages

## Problem

The current Planning page shows all withdrawal strategies as full cards on a single page — rationale, pros/cons, interactive indicator, toggles — all at once. This is overwhelming and the rationale text is too terse for non-technical users.

## Solution

Split into a **hub page** that lists all strategies with compact progress bars, and **dedicated pages** per strategy with expanded content written for non-technical users.

## Routing

- `/planning` — hub page
- `/planning/:method` — dedicated strategy page
- Valid keys: `fire`, `dividends_only`, `constant_withdrawal`, `one_over_n`, `vpw`
- Invalid key redirects to `/planning`

Two flat routes in `App.jsx`, both wrapped in `PrivateRoute` (consistent with existing router — no nested routing since no other page uses it):
```
<Route path="/planning" element={<PrivateRoute v2><Planning /></PrivateRoute>} />
<Route path="/planning/:method" element={<PrivateRoute v2><StrategyDetailPage /></PrivateRoute>} />
```

## Hub Page (`PlanningHub.tsx`)

Vertical list. Each strategy is a clickable row showing:
- Strategy name + one-line subtitle (always base title, no toggle overrides — toggles are a detail page concern)
- Compact progress bar — always renders the **base** indicator (FIREProgressBar, ConstantDollarIndicator, etc.), not the toggle variants. The hub is for comparison, not configuration.
- Active strategy highlighted with green left border + "Estratégia ativa" badge (consistent label used everywhere)

Each row links to `/planning/{key}`.

Data fetching: same hooks as current Planning page (assets, expenses, bank accounts, reports). Passes data to compact indicators. Loading state: show Skeleton per row while data loads (same pattern as existing indicators).

Galeno is **not shown** on the hub — it's a configuration detail that belongs on the dedicated page.

## Dedicated Strategy Page (`StrategyDetailPage.tsx`)

One shared component, content driven by URL param `:method`. Sections in order:

1. **Header** — strategy name (reflects toggle overrides via `AGE_IN_BONDS_TITLES` when active) + "Selecionar como ativa" button. On click: calls `updatePreferences({ selected_method: method })` and stays on the page (button changes to "Estratégia ativa" badge).
2. **Full interactive indicator** — non-compact, with all sliders, patrimony simulation, projection chart. Swaps component when Age-in-bonds toggle is on (same conditional logic as current Planning page).
3. **Toggles** — Age-in-bonds / Galeno where applicable. Age-in-bonds: fire, constant_withdrawal. Galeno: fire, constant_withdrawal, one_over_n, vpw. Mutually exclusive (same validation as today). Galeno renders inline below the indicator when toggled on.
4. **Expanded rationale** — multi-paragraph accessible explanation
5. **Pros / Cons** — base pros/cons from `StrategyContent`, enriched at render time by appending `GALENO_PROS`/`AGE_IN_BONDS_PROS` etc. when toggles are on (same merge logic as current Planning page). These shared constants stay separate, not folded into per-strategy content.
6. **Defaults explained** — why each default value was chosen
7. **References** — links to source material

**Slider state:** Local `useState` within `StrategyDetailPage`, same as current Planning page. Navigating away loses slider positions — this is acceptable (same behavior as today). Each visit starts with sensible defaults.

**Error/empty states:** Carried forward from existing indicator components. dateOfBirth null → "configure no perfil" message. No special handling needed beyond what indicators already do.

## Content Storage

New `strategyContent.ts` with long-form content per strategy:

```typescript
type StrategyContent = {
  title: string;
  subtitle: string;
  rationale: string[];       // array of paragraphs
  defaultsExplained: { label: string; explanation: string }[];
  references: { title: string; url: string }[];
  pros: ProConItem[];
  cons: ProConItem[];
};

const STRATEGY_CONTENT: Record<WithdrawalMethodKey, StrategyContent> = { ... };
```

Replaces the `METHODS` array in `consts.ts`. The shared toggle constants (`GALENO_RATIONALE`, `GALENO_PROS`, `AGE_IN_BONDS_PROS`, etc.) remain separate and are merged at render time.

## Files Changed

- **New:** `react/src/pages/private/Planning/PlanningHub.tsx`
- **New:** `react/src/pages/private/Planning/StrategyDetailPage.tsx`
- **New:** `react/src/pages/private/Planning/strategyContent.ts`
- **Modified:** `react/src/App.jsx` — add `/planning/:method` route
- **Modified:** `react/src/pages/private/Planning/index.tsx` — becomes `PlanningHub` (or re-exports it)
- **Removed/Simplified:** `consts.ts` METHODS array (replaced by `strategyContent.ts`)
- **Kept:** `consts.ts` Galeno/Age-in-bonds shared constants

## What Stays the Same

- All indicator components unchanged (already support `compact` prop)
- `GalenoIndicator` does not need `compact` — it only renders on the dedicated page (full mode), never on the hub
- Backend unchanged (no new endpoints or preferences)
- Home page unchanged (still renders selected indicator in compact mode)
- Toggle logic (Galeno, Age-in-bonds) stays, moves to `StrategyDetailPage`
- `MethodCard` component can be removed (replaced by hub row + dedicated page layout)

## Content to Write

Expanded rationale for each strategy, written in accessible Portuguese for non-technical users:
- **Regra dos X%** — Trinity Study context, what the percentage means, year-by-year example
- **Viver de proventos** — may have less content, that's okay
- **Retirada constante** — Trinity Study, inflation adjustment mechanics, when portfolio depletes
- **Retirada 1/N** — how N shrinks, why withdrawal grows, what happens at target age
- **VPW** — PMT formula explained simply (like bank loan amortization), why % increases with age

Each strategy also gets:
- Defaults explained (why 4%, why 30 years, why 5% real return, etc.)
- 1-3 reference links
