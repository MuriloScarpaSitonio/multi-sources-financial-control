# 1/N Withdrawal Indicator — Design Spec

## Overview

Add a new withdrawal strategy indicator: 1/N (planned depletion). Each year, withdraw `1 / years_remaining` of the portfolio. The withdrawal percentage increases annually until the portfolio reaches zero at the target age.

## Formula

```
years_remaining = target_depletion_age - current_age
withdrawal_percentage = (1 / years_remaining) * 100
annual_withdrawal = portfolio_total * (1 / years_remaining)
monthly_withdrawal = annual_withdrawal / 12
coverage = (monthly_withdrawal / avg_monthly_expenses) * 100
```

## Backend Changes

### 1. Add `date_of_birth` to `CustomUser`

**File:** `django/authentication/models.py`

```python
date_of_birth = models.DateField(null=True, blank=True)
```

Auto-generate migration. This is a shared prereq for all future age-based methods (VPW, Glide-Path, both Age-in-Bonds).

### 2. Expose in `UserSerializer`

**File:** `django/authentication/serializers.py`

Add `"date_of_birth"` to `UserSerializer.Meta.fields`. This automatically includes it in the login response via `TokenWUserObtainPairView`, which means `setUserDataToLocalStorage` in `react/src/helpers.js` will store it as `user_date_of_birth` in localStorage.

### 3. Add `one_over_n` to planning preferences

**File:** `django/authentication/serializers.py`

- Add `"one_over_n"` to `PlanningPreferencesSerializer.selected_method` choices (line ~111):
  ```python
  choices=["fire", "dividends_only", "constant_withdrawal", "one_over_n"]
  ```
- Update `show_galeno` validation (line ~223) to allow `one_over_n`:
  ```python
  if merged.get("show_galeno") and merged.get("selected_method") not in ("fire", "constant_withdrawal", "one_over_n"):
  ```

## Frontend Changes

### 1. Planning types and consts

**File:** `react/src/pages/private/Planning/api.ts`
- Add `"one_over_n"` to `WithdrawalMethodKey` type. Once added, TypeScript `satisfies Record<WithdrawalMethodKey, ...>` constraints in both `Indicators.tsx` and `Planning/index.tsx` will enforce adding the new entry to all indicator records.

**File:** `react/src/pages/private/Planning/hooks.ts`
- Add `"one_over_n"` to the `VALID_METHODS` array (line ~17). Without this, selecting `one_over_n` would cause `useSelectedMethod` to fall back to `"fire"`.

**File:** `react/src/pages/private/Planning/index.tsx`
- Add `"one_over_n"` to the `validMethods` array (line ~63).

**File:** `react/src/pages/private/Planning/consts.ts`
- Add method config to `METHODS` array:
  - **key:** `one_over_n`
  - **title:** "Retirada 1/N (Esgotamento planejado)"
  - **subtitle:** "Divida o patrimonio pelo numero de anos restantes ate a idade alvo."
  - **rationale:** Explanation of 1/N strategy — withdrawal fraction increases each year, portfolio reaches zero at target age.
  - **pros/cons:** Predictable depletion timeline, increasing income over time vs. no legacy, risk of outliving target age.

### 2. `dateOfBirth` data pipeline

`getPlanningPreferences` in `Planning/api.ts` already fetches the full user object (`GET /users/{id}`), then extracts only `planning_preferences`. Extend it (or create a sibling function) to also return `date_of_birth` from the same response. This avoids an extra API call. The `usePlanningPreferences` hook should expose `dateOfBirth` alongside the existing data.

### 3. OneOverNIndicator component

**File:** `react/src/pages/private/Home/OneOverNIndicator.tsx` (NEW)

**Props** (follows existing pattern):
```typescript
{
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  dateOfBirth: string | null;
  targetDepletionAge: number;
  onTargetDepletionAgeChange: (value: number) => void;
}
```

**Behavior:**
- If `dateOfBirth` is null, show prompt to configure it in user profile.
- Compute `currentAge` from `dateOfBirth`, then `yearsRemaining`, `monthlyWithdrawal`, `coverage`.
- Progress bar: `coverage` percentage (green if >= 100%, red if < 100%).
- One slider: target depletion age (range 70-105, default 90, step 1).
- Uses `useHideValues` for privacy masking.
- Tooltip with strategy explanation.

**Edge cases:**
- `years_remaining <= 0`: show warning, suggest increasing target age.
- Zero portfolio: guard against division by zero.

### 4. Integration — Home page

**File:** `react/src/pages/private/Home/Indicators.tsx`

- Add `targetDepletionAge` local state (default 90).
- Add `one_over_n` entry to the indicators record, rendering `OneOverNIndicator`.
- Pass `dateOfBirth` from the extended `usePlanningPreferences` hook.
- No change needed for Galeno: the existing `showGaleno` logic (line ~45) already permits Galeno for any method that is not `"dividends_only"`, so `one_over_n` is automatically allowed.
- No extra data fetching needed: `one_over_n` uses the same patrimony + expenses data already fetched for other methods.

### 5. Integration — Planning page

**File:** `react/src/pages/private/Planning/index.tsx`

- Add `targetDepletionAge` local state.
- Add `one_over_n` to the indicators mapping.
- Add `localGalenoOneOverN` state (following pattern of `localGalenoFire`, `localGalenoConstant`).
- Add `"one_over_n"` branch in `isGalenoChecked` and `handleGalenoChange` functions.

## What This Does NOT Include

- Projection table (nice-to-have from plan, not in scope for initial implementation).
- Birth date input in user profile form (out of scope — the field is added to the model/serializer, but the profile form update is a separate task).
