# ⬜ NOT STARTED — Variable Percentage Withdrawal (VPW) Indicator

## 1. What VPW Is and How It Works

### Overview
VPW adjusts the withdrawal percentage upward each year as the retiree ages, ensuring the portfolio is mostly spent by the end of the expected retirement horizon without running out.

### The Formula
Each year:
```
Annual Withdrawal = Portfolio Balance * VPW_Percentage(years_remaining, stock_allocation)
```

The VPW percentage is derived from a **PMT-based amortization formula**:
```
VPW% = PMT(real_return, years_remaining, -1, 0) * 100
```

Where:
- `real_return = stock_pct * 0.05 + bond_pct * 0.018` (weighted expected real returns)
- `years_remaining = target_end_age - current_age`
- `PMT(rate, nper, pv, fv)` = standard financial PMT function

### Simplified VPW Table (60/40 stocks/bonds, plan to age 100)

| Age | VPW% | Age | VPW% | Age | VPW% |
|-----|------|-----|------|-----|------|
| 30  | 3.4% | 50  | 4.2% | 70  | 6.1% |
| 35  | 3.6% | 55  | 4.6% | 75  | 7.3% |
| 40  | 3.7% | 60  | 5.0% | 80  | 9.0% |
| 45  | 3.9% | 65  | 5.5% | 85  | 11.6%|

### Key Parameters Needed
1. **Current age** (or birth date) -- MISSING
2. **Target end-of-plan age** (e.g., 100) -- MISSING
3. **Asset allocation** (% stocks vs % bonds) -- PARTIALLY EXISTS (derivable from asset types)
4. **Current portfolio balance** -- EXISTS
5. **Average monthly expenses** -- EXISTS

---

## 2. What the Indicator Would Show (UI/UX)

A new progress bar below or alongside the existing FIRE bar:

- **Title:** "Retirada VPW (Variable Percentage Withdrawal)"
- **Primary value:** Current VPW withdrawal percentage (e.g., "4.2%")
- **Secondary value:** Monthly withdrawal amount
- **Progress bar:** VPW monthly withdrawal vs average monthly expenses
  - Green (>=100%): covers expenses
  - Red (<100%): does not cover expenses
- **User Controls:**
  - Birth year slider or input
  - Target age slider (default 100, range 80-105)
  - Stock/bond allocation auto-calculated from real portfolio data

---

## 3. Data Already Exists vs What Is Missing

### EXISTS

| Data | Source |
|------|--------|
| Total portfolio value | `useAssetsIndicators().total` + `useBankAccountsSummary().total` |
| Average monthly expenses (FIRE) | `useHomeExpensesIndicators({ includeFireAvg: true }).fire_avg` |
| Asset types (STOCK, STOCK_USA, CRYPTO, FII, FIXED_BR) | `AssetTypes` in `django/variable_income_assets/choices.py` |
| Asset allocation by type | `GET /assets/reports?group_by=type&kind=total_invested&current=true` |

### MISSING

| Data | Why Needed |
|------|-----------|
| **User birth date** | Calculate current age -> years remaining |
| **Target retirement end age** | Calculate years remaining (default: 100) |
| **Stocks vs Bonds classification mapping** | Map asset types to categories |

### Asset Type Classification (Proposed)

| AssetType | VPW Classification |
|-----------|-------------------|
| STOCK, STOCK_USA, FII, CRYPTO | Stocks |
| FIXED_BR | Bonds |
| Bank account balance | Bonds (cash-equivalent) |

---

## 4. Implementation Approach

### Option A: Backend VPW Endpoint
- Server-side calculation, requires `date_of_birth` migration
- **Backend effort:** ~1 day, **Frontend effort:** ~1 day

### Option B: Frontend-Only (Recommended for MVP)
- No backend changes at all
- Use existing endpoints for allocation and portfolio data
- Store birth year in `localStorage` or component state
- VPW formula computed in TypeScript
- **Backend effort:** 0, **Frontend effort:** ~1.5 days

---

## 5. Backend Changes (Phase 2 only)

### 5.1 Add `date_of_birth` to User Model
**File:** `django/authentication/models.py` -- add `date_of_birth = models.DateField(null=True, blank=True)`
**Complexity:** Small

### 5.2 Migration + Serializer Update
**Files:** `django/authentication/migrations/`, `django/authentication/serializers.py`
**Complexity:** Small

### 5.3 VPW Calculation Utility
**File:** `django/shared/vpw.py` (NEW)
**Complexity:** Small

```python
def pmt(rate, nper, pv=-1, fv=0):
    if rate == 0:
        return -pv / nper
    rate_factor = (1 + rate) ** nper
    return rate * (fv + pv * rate_factor) / (rate_factor - 1)

def calculate_vpw_percentage(stock_pct, bond_pct, years_remaining):
    real_return = stock_pct * 0.05 + bond_pct * 0.018
    return pmt(real_return, years_remaining) * 100
```

### 5.4 VPW API Endpoint
**File:** `django/shared/views.py` -- new action on `PatrimonyViewSet`
**Complexity:** Medium

---

## 6. Frontend Changes

### 6.1 VPW Utility (TypeScript)
**File:** `react/src/pages/private/Home/vpwUtils.ts` (NEW)
**Complexity:** Small

```typescript
function pmt(rate: number, nper: number, pv: number = -1, fv: number = 0): number {
  if (rate === 0) return -pv / nper;
  const rateFactor = Math.pow(1 + rate, nper);
  return (rate * (fv + pv * rateFactor)) / (rateFactor - 1);
}

const STOCK_TYPES = new Set(["STOCK", "STOCK_USA", "FII", "CRYPTO"]);
const BOND_TYPES = new Set(["FIXED_BR"]);

function calculateVPW(stockPct: number, bondPct: number, yearsRemaining: number): number {
  const realReturn = stockPct * 0.05 + bondPct * 0.018;
  return pmt(realReturn, yearsRemaining) * 100;
}
```

### 6.2 VPWProgressBar Component
**File:** `react/src/pages/private/Home/Indicators.tsx` or new file
**Complexity:** Medium

- Fetch allocation data via `useAssetsReports`
- Birth year input + target age slider
- Persist in localStorage
- Compute VPW% and monthly withdrawal

### 6.3 Integration
**File:** `react/src/pages/private/Home/Indicators.tsx`
**Complexity:** Small

---

## 7. Effort Estimate

### Phase 1: Frontend-Only MVP

| # | Task | Effort |
|---|------|--------|
| 1 | VPW utility with PMT formula + type mapping | 2h |
| 2 | VPWProgressBar component | 4h |
| 3 | Fetch allocation data | 1h |
| 4 | Birth year input + target age slider | 2h |
| 5 | Persist in localStorage | 1h |
| 6 | Tests for VPW utility | 2h |

**Phase 1 Total: ~12 hours (~1.5 days)**

### Phase 2: Backend Integration

| # | Task | Effort |
|---|------|--------|
| 7 | `date_of_birth` field + migration | 45min |
| 8 | VPW calculation utility (Python) | 1h |
| 9 | VPW API endpoint | 2h |
| 10 | Backend tests | 2h |
| 11 | Switch frontend to API | 2h |
| 12 | Birth date in user settings | 3h |

**Phase 2 Total: ~12 hours (~1.5 days)**

**Grand Total: ~3 days**
