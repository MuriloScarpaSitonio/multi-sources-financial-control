# Future Home Indicators

This document contains ideas for additional indicators to be implemented on the Home page. These are suggestions based on available data and potential new endpoints.

---

## ✅ Already Implemented

### 1. Passive Income Coverage 🌱
- **What**: What percentage of monthly expenses is covered by passive income (dividends, etc.)
- **Calculation**: `(avgPassiveIncome / avgExpenses) * 100`
- **Location**: `PassiveIncomeCoverageIndicator` in `FinancialHealthSummary.tsx`
- **Status**: ✅ Implemented

### 2. Dividend Yield on Cost 📈
- **What**: Total dividend yield based on total invested (not current value)
- **Calculation**: `(total_credited_incomes / total_invested) * 100`
- **Location**: `DividendYieldIndicator` in `FinancialHealthSummary.tsx`
- **Backend**: Added `total_credited_incomes` and `total_invested` to `/assets/indicators` endpoint
- **Status**: ✅ Implemented

### 3. FIRE Number Progress 🔥
- **What**: Progress towards financial independence (typically 25x annual expenses)
- **Calculation**: `(patrimony_total / (avgExpenses * 12 * 25)) * 100`
- **Location**: `FIREProgressBar` in `Home/Indicators.tsx`
- **Status**: ✅ Implemented

### 4. Future Expenses Coverage 💰
- **What**: Whether bank balance + future revenues can cover future expenses
- **Calculation**: `bankAmount + futureRevenues >= futureExpenses`
- **Location**: `FutureExpensesIndicator` in `FinancialHealthSummary.tsx`
- **Backend**: Added `future` field to both `/expenses/indicators` and `/revenues/indicators` endpoints
- **Status**: ✅ Implemented

---

## 🚧 Pending Implementation

### 5. Monthly Budget Progress 🎯
- **What**: Progress towards a user-defined monthly expense limit
- **Calculation**: `(expensesIndicators.total / user_monthly_budget) * 100`
- **Backend needed**: New field on CustomUser model for `monthly_budget_limit`
- **Message**: "Você gastou X% do seu orçamento mensal"
- **Why**: Helps users stay within spending limits
- **Complexity**: ⭐⭐⭐ High (requires user settings UI + migration)

### 6. Net Worth Growth Trend 📊
- **What**: Growth rate of patrimony over time (3 months, 6 months, 1 year)
- **Calculation**: Compare current total with historical snapshots
- **Backend needed**: Endpoint to return patrimony at specific historical dates (might already exist via `AssetsTotalInvestedSnapshot`)
- **Message**: "Seu patrimônio cresceu X% nos últimos 6 meses"
- **Why**: Long-term perspective on wealth building
- **Complexity**: ⭐⭐ Medium

### 7. Investment vs Expenses Ratio 💼
- **What**: How much is being invested compared to spent
- **Calculation**: Would need to track monthly investment contributions
- **Backend needed**: New model/endpoint to track monthly investment contributions
- **Message**: "Você investiu X% do que gastou neste mês"
- **Why**: Shows priority given to investing vs consuming
- **Complexity**: ⭐⭐⭐ High (requires new tracking model)

---

## Notes

- All indicators respect `useHideValues()` hook for privacy
- Use `IndicatorBox` component for consistency
- Loading and error states should be handled appropriately
- Tooltips explain the calculation and variant (success/danger)
