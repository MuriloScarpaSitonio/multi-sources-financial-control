# ⬜ NOT STARTED — Glide-Path Allocation Withdrawal Method Indicator

## 1. Method Summary

Instead of the linear age-in-bonds approach (bond% = age), use a **logarithmic glide-path**:

```
stock_percent = (log10(100 - age) - 1) * 100
bond_percent  = 100 - stock_percent
```

This adds bonds more slowly in early years (allowing more portfolio growth) then transitions more quickly to bond-heavy allocation during later retirement, eventually reaching 100% bonds at age 90+.

### Comparison Table

| Age | Glide stock% | Glide bond% | Linear stock% | Linear bond% |
|-----|-------------|------------|--------------|-------------|
| 25  | 87.5%       | 12.5%      | 75%          | 25%         |
| 35  | 81.3%       | 18.7%      | 65%          | 35%         |
| 45  | 74.0%       | 26.0%      | 55%          | 45%         |
| 55  | 65.3%       | 34.7%      | 45%          | 55%         |
| 65  | 54.4%       | 45.6%      | 35%          | 65%         |
| 75  | 39.8%       | 60.2%      | 25%          | 75%         |
| 85  | 17.6%       | 82.4%      | 15%          | 85%         |
| 90  | 0%          | 100%       | 10%          | 90%         |

Edge case: cap stock% at 0 for age >= 90.

---

## 2. What the Indicator Shows (UI/UX)

### Proposed UI
Place in **Financial Health Summary** section (`FinancialHealthSummary`) on the Home page.

Using `IndicatorBox` component:

1. **Title:** "Alocacao Glide-Path"
2. **Current allocation bar:** Stacked horizontal bar showing actual stock% vs bond%
3. **Target comparison:** Two text lines showing:
   - "Linear (idade-em-bonds): X% renda fixa / Y% renda variavel"
   - "Glide-Path logaritmico: X% renda fixa / Y% renda variavel"
4. **Deviation indicator:** Color-coded (success if within 5% of target, danger if far off)
5. **Tooltip:** Explains the formula in plain language

### Interaction
- If no birth date configured, show prompt
- Optionally use `Slider` to see projected allocation at different ages

---

## 3. Data Already Exists vs Missing

### Already Exists

| Data | Location |
|------|----------|
| Asset types (STOCK, STOCK_USA, CRYPTO, FII, FIXED_BR) | `django/variable_income_assets/choices.py` |
| Asset allocation by type report | `AssetReadModelQuerySet.total_invested_report(group_by="type")` |
| Assets reports endpoint | `GET /assets/reports?group_by=type` |
| Frontend reports hook | `useAssetsReports()` |
| `IndicatorBox` component | `react/src/pages/private/Expenses/Indicators/components.tsx` |
| `FinancialHealthSummary` section | `react/src/pages/private/Home/FinancialHealthSummary.tsx` |
| User model (`CustomUser`) | `django/authentication/models.py` |
| `useHideValues` hook | `react/src/hooks/useHideValues.ts` |

### Missing

| Data | Impact |
|------|--------|
| **`date_of_birth` on `CustomUser`** | CRITICAL -- blocks the feature |
| **Glide-path backend endpoint** | Needed for target vs actual allocation |
| **Frontend birth date input** | Needed for user to enter birth date |
| **Stock/bond classification mapping** | Conceptually obvious but not codified |

---

## 4. Backend Changes Needed

### 4.1 Add `date_of_birth` to `CustomUser`
**File:** `django/authentication/models.py` -- `date_of_birth = models.DateField(null=True, blank=True)`
**Migration:** Auto-generated
**Complexity:** Small

### 4.2 Update `UserSerializer`
**File:** `django/authentication/serializers.py` -- add to `Meta.fields`
**Complexity:** Small

### 4.3 Stock/Bond Classification Utility
**File:** `django/variable_income_assets/choices.py`
```python
STOCK_LIKE_TYPES = {AssetTypes.stock, AssetTypes.stock_usa, AssetTypes.fii, AssetTypes.crypto}
BOND_LIKE_TYPES = {AssetTypes.fixed_br}
```
**Complexity:** Small

### 4.4 New `glide_path` Action on `AssetViewSet`
**File:** `django/variable_income_assets/views.py`
- Gets `date_of_birth`, computes age
- Computes target allocations (both linear and logarithmic formulas)
- Queries actual allocation by stock-like vs bond-like types
- Returns actual vs target percentages
**Complexity:** Medium

### 4.5 Response Serializer
Fields: `age`, `actual_stock_pct`, `actual_bond_pct`, `linear_target_stock_pct`, `linear_target_bond_pct`, `glide_target_stock_pct`, `glide_target_bond_pct`, `stock_total`, `bond_total`, `total`
**Complexity:** Small

---

## 5. Frontend Changes Needed

### 5.1 Birth Date in User Profile
**Complexity:** Medium

### 5.2 API Function
**File:** `react/src/pages/private/Assets/api/index.ts` -- `getGlidePath()`
**Complexity:** Small

### 5.3 React Query Hook
**File:** `react/src/pages/private/Assets/Indicators/hooks/assets.ts` -- `useGlidePathAllocation()`
**Complexity:** Small

### 5.4 GlidePathIndicator Component
**File:** `react/src/pages/private/Home/GlidePathIndicator.tsx` (NEW)
**Complexity:** Medium

- Calls `useGlidePathAllocation()`
- If no birth date, renders configuration prompt
- Otherwise renders actual vs target comparison with `IndicatorBox`
- Uses `useHideValues`, `Tooltip`

### 5.5 Integration
**File:** `react/src/pages/private/Home/FinancialHealthSummary.tsx`
**Complexity:** Small

---

## 6. Effort Estimate

| Item | Complexity | Effort |
|------|-----------|--------|
| `date_of_birth` on model + migration + serializer | Small | 0.75h |
| Stock/bond classification utility | Small | 0.25h |
| `glide_path` API action + serializer | Medium | 2h |
| Frontend API function + hook | Small | 0.5h |
| GlidePathIndicator component | Medium | 3h |
| Integration into FinancialHealthSummary | Small | 0.25h |
| Birth date input in user settings | Medium | 1.5h |
| Backend tests | Medium | 2h |
| Frontend testing | Small | 1h |

**Total: ~8-12 hours (~1-1.5 days)**

---

## 7. Notes

- **Shared prereq with other age-based methods**: The `date_of_birth` field is needed by Constant-Dollar (Age in Bonds), Constant-Percentage (Age in Bonds), VPW, and Glide-Path. Implement it once.
- **The glide-path endpoint could also serve the age-in-bonds indicators** by returning both linear and logarithmic targets in the same response. Consider combining into a single `/assets/allocation-target` endpoint.
- **FII classification**: As stocks. Could be configurable later.
- **Crypto**: Highly volatile, classified as stock-like.
- **Age >= 90**: Must cap stock% at 0 to avoid negative values from log.
