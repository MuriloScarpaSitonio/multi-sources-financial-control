# Future Home Indicators

This document contains ideas for additional indicators to be implemented on the Home page. These are suggestions based on available data and potential new endpoints.

---

## 🚧 Pending Implementation

### 6. Monthly Budget Progress 🎯
- **What**: Progress towards a user-defined monthly expense limit
- **Calculation**: `(expensesIndicators.total / user_monthly_budget) * 100`
- **Backend needed**: New field on CustomUser model for `monthly_budget_limit`
- **Message**: "Você gastou X% do seu orçamento mensal"
- **Why**: Helps users stay within spending limits
- **Complexity**: ⭐⭐⭐ High (requires user settings UI + migration)

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
