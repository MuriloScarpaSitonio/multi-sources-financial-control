# ⬜ NOT STARTED — Constant-Dollar (Age in Bonds) Withdrawal Method Indicator

## 1. Method Summary

Same as constant-dollar (first year: X% of portfolio, then adjust for inflation yearly), **BUT** the stock/bond allocation is adjusted each year so that **bond percentage equals the owner's age**. This means 1% allocation shift per year toward bonds.

- Effect: Portfolio value declines faster in later years (increasing withdrawals while reducing growth assets).
- Good if you don't want to leave a large legacy and prefer less market volatility in final years.

---

## 2. What the Indicator Shows (UI/UX)

### Proposed UI
Add below the existing FIRE progress bar in `react/src/pages/private/Home/Indicators.tsx`:

1. **Age-in-Bonds Allocation Bar** -- Horizontal stacked bar showing current bond allocation (FIXED_BR) vs target (age%), and current stock allocation vs target (100 - age%). Green if within tolerance, red if off.
2. **Withdrawal Summary** -- "At age {age}, recommended bond allocation: {age}%, current: {actual}%. Annual withdrawal: R$ {amount}. Estimated portfolio duration: ~{N} years."
3. **Rebalancing Hint** -- If allocation deviates >5%: "Consider moving R$ {X} from stocks to bonds."
4. **Configurable sliders** for inflation rate and assumed returns.

---

## 3. Formulas

### Allocation Check
```
target_bond_pct = age
actual_bond_pct = (bond_value / total_portfolio) * 100
allocation_gap = actual_bond_pct - target_bond_pct
```

### Withdrawal Projection (year-by-year, frontend JS)
```
annual_withdrawal = avg_annual_expenses
portfolio = total_portfolio
for year in 1..max_years:
    annual_withdrawal *= (1 + inflation_rate)
    current_age = age + year
    bond_pct = min(current_age, 100) / 100
    bonds_return = portfolio * bond_pct * assumed_bond_return
    stocks_return = portfolio * (1 - bond_pct) * assumed_stock_return
    portfolio = portfolio + bonds_return + stocks_return - annual_withdrawal
    if portfolio <= 0: break => years_until_depletion = year
```

---

## 4. Data Inventory

### Already Exists

| Data Point | Location |
|---|---|
| Total portfolio value | `AssetReadModelQuerySet.indicators()` + `BankAccount.objects.get_total()` |
| Assets by type report | `AssetReadModelQuerySet.total_invested_report(group_by="type")` in `django/variable_income_assets/models/managers/read.py` |
| Asset type choices | `AssetTypes` in `django/variable_income_assets/choices.py` (STOCK, STOCK_USA, CRYPTO, FII, FIXED_BR) |
| Average monthly expenses (FIRE) | `fire_avg` from `ExpenseQueryset.indicators(include_fire_avg=True)` |
| FIRE multiplier slider | `FIREProgressBar` in `Indicators.tsx` |
| `IndicatorBox` component | `react/src/pages/private/Expenses/Indicators/components.tsx` |

### Missing (CRITICAL)

| Data Point | Impact |
|---|---|
| **`date_of_birth` on CustomUser** | CRITICAL -- no birth date/age field exists anywhere. Confirmed by searching `birth_date`, `date_of_birth`, `nascimento` across all files. |
| **Bond/stock allocation totals on indicators endpoint** | MEDIUM -- reports endpoint can return this but is heavyweight. Need lightweight aggregation. |
| **Inflation rate assumption** | LOW -- default to 4.5%, configurable via slider |
| **Assumed stock/bond return rates** | LOW -- default to historical averages |

---

## 5. Backend Changes Needed

### 5.1 Add `date_of_birth` to User Model (CRITICAL)
**File:** `django/authentication/models.py` -- add `date_of_birth = models.DateField(null=True, blank=True)` to `CustomUser`
**Migration:** Auto-generated
**Complexity:** Small

### 5.2 Expose in `UserSerializer`
**File:** `django/authentication/serializers.py` -- add `"date_of_birth"` to `Meta.fields`
**Complexity:** Small

### 5.3 Add Bond/Stock Allocation to Assets Indicators
**File:** `django/variable_income_assets/models/managers/read.py`
When `include_allocation` is True, add:
```python
aggregations["bond_total"] = Sum(
    "normalized_current_total",
    filter=Q(type=AssetTypes.fixed_br) & Q(opened_filter),
    default=Decimal(),
)
aggregations["stock_total"] = Sum(
    "normalized_current_total",
    filter=~Q(type=AssetTypes.fixed_br) & Q(opened_filter),
    default=Decimal(),
)
```
**Files also:** `django/variable_income_assets/filters.py`, `views.py`, `serializers.py`
**Complexity:** Small

---

## 6. Frontend Changes Needed

### 6.1 User Settings: Birth Date
**File:** `react/src/forms/UserProfileForm.jsx` -- add date picker
**Complexity:** Small-Medium

### 6.2 Update Assets Indicators API Types
**File:** `react/src/pages/private/Assets/api/index.ts` -- add `bond_total?`, `stock_total?` to type
**Complexity:** Small

### 6.3 Withdrawal Projection Utility
**File:** `react/src/pages/private/Home/withdrawalProjection.ts` (NEW) -- year-by-year simulation function
**Complexity:** Medium

### 6.4 AgeInBondsIndicator Component
**File:** `react/src/pages/private/Home/AgeInBondsIndicator.tsx` (NEW)
**Complexity:** Large

- No birth date guard: show prompt to set it
- Allocation bar: dual-color progress showing actual vs target
- Summary text: current vs target allocation, estimated depletion years
- Sliders for inflation rate and assumed returns
- Tooltip with detailed explanation

### 6.5 Integration
**File:** `react/src/pages/private/Home/Indicators.tsx`
**Complexity:** Small

---

## 7. Effort Estimate

| Item | Complexity | Effort |
|------|-----------|--------|
| `date_of_birth` on model + migration + serializer | Small | 1h |
| Bond/stock allocation on indicators endpoint | Small | 1.5h |
| Birth date input in user profile | Small-Medium | 1h |
| API type updates | Small | 30min |
| Withdrawal projection utility | Medium | 2h |
| AgeInBondsIndicator component | Large | 3-4h |
| Integration | Small | 30min |
| Backend tests | Medium | 2h |
| Frontend testing | Small | 1h |

**Total: ~15-19 hours (~2-3 days)**

---

## 8. Edge Cases

- **No birth date set**: Show prompt to configure it; degrade gracefully
- **No FIXED_BR assets**: Show 0% bonds with suggestion to add fixed-income
- **Age > 100**: Cap bond allocation at 100%
- **FII classification**: Treat as "stocks" (variable income)
- **Currency normalization**: Already handled by `normalized_current_total`
