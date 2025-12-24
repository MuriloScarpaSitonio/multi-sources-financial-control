# Future Home Indicators

This document contains ideas for additional indicators to be implemented on the Home page. These are suggestions based on available data and potential new endpoints.

---

## Requiring Backend Changes (New Endpoints or Data)

### 1. Passive Income Coverage 🌱
- **What**: What percentage of monthly expenses is covered by passive income (dividends, etc.)
- **Calculation**: `(monthly_passive_income / expensesIndicators.total) * 100`
- **Backend needed**: New aggregation for average monthly passive income or projected annual yield
- **Message**: "Seus proventos cobrem X% das suas despesas mensais"
- **Why**: Key FIRE (Financial Independence) metric

### 2. Dividend Yield on Cost 📈
- **What**: Annual dividend yield based on total invested (not current value)
- **Calculation**: `(annual_credited_incomes / total_invested) * 100`
- **Backend needed**: Total invested value and annual credited incomes sum
- **Message**: "Rendimento de proventos: X% a.a. sobre o custo"
- **Why**: Important for dividend-focused investors to track portfolio yield

### 3. Monthly Budget Progress 🎯
- **What**: Progress towards a user-defined monthly expense limit
- **Calculation**: `(expensesIndicators.total / user_monthly_budget) * 100`
- **Backend needed**: New field on CustomUser model for `monthly_budget_limit`
- **Message**: "Você gastou X% do seu orçamento mensal"
- **Why**: Helps users stay within spending limits

### 4. Net Worth Growth Trend 📊
- **What**: Growth rate of patrimony over time (3 months, 6 months, 1 year)
- **Calculation**: Compare current total with historical snapshots
- **Backend needed**: Endpoint to return patrimony at specific historical dates (might already exist via `AssetsTotalInvestedSnapshot`)
- **Message**: "Seu patrimônio cresceu X% nos últimos 6 meses"
- **Why**: Long-term perspective on wealth building

### 5. FIRE Number Progress 🔥
- **What**: Progress towards financial independence (typically 25x annual expenses)
- **Calculation**: `(patrimony_total / (expensesIndicators.total * 12 * 25)) * 100`
- **Backend needed**: None if using current data, or historical annual expenses average for more accuracy
- **Message**: "Você está X% mais perto da independência financeira (regra dos 4%)"
- **Why**: Popular metric for those pursuing early retirement

### 6. Investment vs Expenses Ratio 💼
- **What**: How much is being invested compared to spent
- **Calculation**: Would need to track monthly investment contributions
- **Backend needed**: New model/endpoint to track monthly investment contributions
- **Message**: "Você investiu X% do que gastou neste mês"
- **Why**: Shows priority given to investing vs consuming

---

## Implementation Priority Suggestion

1. **Passive Income Coverage** - Requires backend work but high value for investors

---

## Notes

- All indicators should respect `useHideValues()` hook for privacy
- Consider using `IndicatorBox` component for consistency
- Loading and error states should be handled appropriately
- Some metrics might benefit from tooltips explaining the calculation

