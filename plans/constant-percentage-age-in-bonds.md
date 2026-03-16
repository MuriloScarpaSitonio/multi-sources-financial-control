# ⬜ NOT STARTED — Constant-Percentage (Age in Bonds) Withdrawal Indicator

## 1. Method Summary

Same as constant-percentage (withdraw same fixed % of current portfolio each year), **BUT** the stock/bond allocation is adjusted each year so that **bond percentage equals the owner's age**.

- Effect: Portfolio becomes more conservative yearly, growth slows, but year-to-year withdrawal differences are minimized (increased bond allocation improves stability of returns).
- More smoothed than constant-percentage alone.

---

## 2. What the Indicator Shows (UI/UX)

### Proposed UI
A new `IndicatorBox` in the `FinancialHealthSummary` section showing:

1. **Current allocation vs target allocation:**
   - "Alocacao atual: X% Renda Fixa / Y% Renda Variavel"
   - "Meta para sua idade (Z anos): Z% Renda Fixa / (100-Z)% Renda Variavel"
   - Color: `success` if within +/-5% of target, `danger` if outside

2. **Estimated annual withdrawal:**
   - "Retirada anual estimada: R$ X (Y% do patrimonio)"

3. **Rebalancing action needed:**
   - "Para atingir a meta, mova R$ X de Renda Variavel para Renda Fixa" (or vice versa)

4. **Adjustable slider** for withdrawal rate (default 4%, range 3-5%)

---

## 3. Formulas

```
target_bond_percentage = age  (capped at 100)
target_stock_percentage = 100 - target_bond_percentage

current_bond_percentage = (total_fixed_income / total_portfolio) * 100
current_stock_percentage = 100 - current_bond_percentage

is_on_target = abs(current_bond_percentage - target_bond_percentage) <= 5

annual_withdrawal = total_portfolio * (withdrawal_rate / 100)

rebalance_amount = (target_bond_percentage / 100) * total_portfolio - total_fixed_income
```

### Asset Classification
- **Bonds/Fixed Income**: `FIXED_BR` only
- **Stocks/Variable Income**: `STOCK`, `STOCK_USA`, `CRYPTO`, `FII`
- **Bank accounts**: Excluded from allocation calc, included in total for withdrawal amount

---

## 4. Data Already Exists vs Missing

### Already Exists

| Data | Location |
|------|----------|
| Total portfolio (investments + bank) | `AssetReadModelQuerySet.indicators()` + `BankAccount.objects.get_total()` |
| Asset type classification | `AssetReadModel.type` with choices in `django/variable_income_assets/choices.py` |
| `normalized_current_total` per asset | Expression in `django/variable_income_assets/models/managers/read.py` |
| Withdrawal rate concept | `FIREProgressBar` in `Indicators.tsx` |
| `IndicatorBox` component | `react/src/pages/private/Expenses/Indicators/components.tsx` |
| `useHideValues` hook | `react/src/hooks/useHideValues.ts` |

### Missing

| Data | Impact |
|------|--------|
| **`date_of_birth` on CustomUser** | CRITICAL -- blocks the entire feature |
| **Total current value grouped by asset type** | Need `normalized_current_total` summed per type |
| **Backend endpoint for age-in-bonds data** | Single API call for allocation data |

---

## 5. Backend Changes Needed

### 5.1 Add `date_of_birth` to `CustomUser`
**File:** `django/authentication/models.py` -- add `date_of_birth = models.DateField(null=True, blank=True)`
**Migration:** Auto-generated
**Complexity:** Small

### 5.2 Expose in `UserSerializer`
**File:** `django/authentication/serializers.py` -- add to `Meta.fields`
**Complexity:** Small

### 5.3 New Queryset Method
**File:** `django/variable_income_assets/models/managers/read.py`
```python
def aggregate_normalized_current_total_by_type(self):
    return dict(
        self.opened()
        .annotate_normalized_current_total()
        .values("type")
        .annotate(total=Sum("normalized_current_total", default=Decimal()))
        .values_list("type", "total")
    )
```
**Complexity:** Small

### 5.4 New API Endpoint
**File:** `django/variable_income_assets/views.py` -- new `@action` on `AssetViewSet`:
- Gets user's `date_of_birth`, computes age
- Gets totals by type, classifies into stocks/bonds
- Accepts optional `withdrawal_rate` param
- Returns: age, target/current bond/stock percentages, is_on_target, annual_withdrawal, rebalance_amount
**Complexity:** Medium

### 5.5 Response Serializer
**File:** `django/variable_income_assets/serializers.py` -- `AgeInBondsIndicatorSerializer`
**Complexity:** Small

---

## 6. Frontend Changes Needed

### 6.1 User Profile: Birth Date Input
**File:** `react/src/forms/UserProfileForm.jsx` -- add date picker
**Complexity:** Small

### 6.2 API Function
**File:** `react/src/pages/private/Assets/api/index.ts` -- `getAgeInBonds()`
**Complexity:** Small

### 6.3 React Query Hook
**File:** `react/src/pages/private/Assets/Indicators/hooks/assets.ts` -- `useAgeInBonds()`
**Complexity:** Small

### 6.4 AgeInBondsIndicator Component
**File:** `react/src/pages/private/Home/AgeInBondsIndicator.tsx` (NEW)
**Complexity:** Medium-Large

- Calls `useAgeInBonds()` with `withdrawalRate` state
- If no birth date, shows configuration prompt
- Renders `IndicatorBox` with allocation comparison, withdrawal estimate, rebalance suggestion
- Slider for withdrawal rate
- Handles loading, error, `useHideValues`

### 6.5 Integration
**File:** `react/src/pages/private/Home/FinancialHealthSummary.tsx`
**Complexity:** Small

---

## 7. Effort Estimate

| Item | Complexity | Effort |
|------|-----------|--------|
| `date_of_birth` on model + migration + serializer | Small | 0.75h |
| Queryset method | Small | 0.5h |
| API endpoint + response serializer | Medium | 1.75h |
| User profile birth date input | Small | 1h |
| Frontend API function + hook | Small | 0.5h |
| `AgeInBondsIndicator` component | Medium-Large | 3h |
| Integration into FinancialHealthSummary | Small | 0.25h |
| Backend tests | Medium | 2h |
| Frontend testing | Small | 1h |

**Total: ~11.5 hours (~1.5 days)**

---

## 8. Notes

- **NOTE:** The `AgeInBondsIndicator` component and backend endpoint can be **shared** with the Constant-Dollar (Age in Bonds) method. The allocation logic is identical -- only the withdrawal calculation differs. Consider building a shared `AgeInBondsAllocation` component.
- **FII classification**: Treated as stocks. Could later be user-configurable.
- **`date_of_birth` being null**: Graceful fallback with prompt to configure.
- **Suggested implementation order**: date_of_birth first (shared prereq), then backend endpoint, then frontend component.
