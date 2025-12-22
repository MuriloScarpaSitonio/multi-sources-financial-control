# Future Home Indicators

This document contains ideas for additional indicators to be implemented on the Home page. These are suggestions based on available data and potential new endpoints.

---

## Using Existing Data (No Backend Changes)

### 1. Monthly Balance/Savings 💰
- **What**: Show the difference between revenues and expenses for the current month
- **Calculation**: `revenuesIndicators.total - expensesIndicators.total`
- **Message**: "Você está economizando R$ X.XXX neste mês" or "Você está gastando R$ X.XXX a mais que sua receita"
- **Why**: Directly ties into wealth building and shows *how* the patrimony is growing/shrinking
- **Variant**: `success` if positive, `danger` if negative

### 2. Savings Rate 📊
- **What**: Percentage of income being saved
- **Calculation**: `((revenues - expenses) / revenues) * 100`
- **Message**: "X% da sua receita está sendo poupada neste mês"
- **Why**: Key metric for financial health tracking, widely used in personal finance

### 3. Emergency Fund Coverage 🛡️
- **What**: How many months of expenses the bank balance can cover
- **Calculation**: `bankAmount / expensesIndicators.avg` (using the average monthly expenses)
- **Message**: "Seu saldo cobre X meses de despesas"
- **Why**: Classic emergency fund metric, helps visualize financial security
- **Note**: The `avg` is already returned by the expenses indicators endpoint

---

## Requiring Backend Changes (New Endpoints or Data)

### 4. Passive Income Coverage 🌱
- **What**: What percentage of monthly expenses is covered by passive income (dividends, etc.)
- **Calculation**: `(monthly_passive_income / expensesIndicators.total) * 100`
- **Backend needed**: New aggregation for average monthly passive income or projected annual yield
- **Message**: "Seus proventos cobrem X% das suas despesas mensais"
- **Why**: Key FIRE (Financial Independence) metric

### 5. Dividend Yield on Cost 📈
- **What**: Annual dividend yield based on total invested (not current value)
- **Calculation**: `(annual_credited_incomes / total_invested) * 100`
- **Backend needed**: Total invested value and annual credited incomes sum
- **Message**: "Rendimento de proventos: X% a.a. sobre o custo"
- **Why**: Important for dividend-focused investors to track portfolio yield

### 6. Monthly Budget Progress 🎯
- **What**: Progress towards a user-defined monthly expense limit
- **Calculation**: `(expensesIndicators.total / user_monthly_budget) * 100`
- **Backend needed**: New field on CustomUser model for `monthly_budget_limit`
- **Message**: "Você gastou X% do seu orçamento mensal"
- **Why**: Helps users stay within spending limits

### 7. Net Worth Growth Trend 📊
- **What**: Growth rate of patrimony over time (3 months, 6 months, 1 year)
- **Calculation**: Compare current total with historical snapshots
- **Backend needed**: Endpoint to return patrimony at specific historical dates (might already exist via `AssetsTotalInvestedSnapshot`)
- **Message**: "Seu patrimônio cresceu X% nos últimos 6 meses"
- **Why**: Long-term perspective on wealth building

### 8. FIRE Number Progress 🔥
- **What**: Progress towards financial independence (typically 25x annual expenses)
- **Calculation**: `(patrimony_total / (expensesIndicators.total * 12 * 25)) * 100`
- **Backend needed**: None if using current data, or historical annual expenses average for more accuracy
- **Message**: "Você está X% mais perto da independência financeira (regra dos 4%)"
- **Why**: Popular metric for those pursuing early retirement

### 9. Investment vs Expenses Ratio 💼
- **What**: How much is being invested compared to spent
- **Calculation**: Would need to track monthly investment contributions
- **Backend needed**: New model/endpoint to track monthly investment contributions
- **Message**: "Você investiu X% do que gastou neste mês"
- **Why**: Shows priority given to investing vs consuming

### 10. Future Fixed Expenses Projection 📅
- **What**: Total of fixed expenses already committed for the next 3-6 months
- **Calculation**: Already available via `expensesIndicators.future`
- **Message**: "Você tem R$ X.XXX em despesas fixas para os próximos meses"
- **Why**: Helps with cash flow planning

---

## Implementation Priority Suggestion

1. **Monthly Balance/Savings** - High impact, zero backend work
2. **Emergency Fund Coverage** - Uses existing `avg` data
3. **Savings Rate** - Simple calculation, meaningful metric
4. **Future Fixed Expenses** - Data already exists (`expensesIndicators.future`)
5. **Passive Income Coverage** - Requires backend work but high value for investors
6. **FIRE Number Progress** - Aspirational metric, good for engagement

---

## Notes

- All indicators should respect `useHideValues()` hook for privacy
- Consider using `IndicatorBox` component for consistency
- Loading and error states should be handled appropriately
- Some metrics might benefit from tooltips explaining the calculation

