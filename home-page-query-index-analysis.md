# Home Page API Endpoints - Database Index Coverage Analysis

Analysis of the 16 API endpoints called when loading `/home`, checking whether their database queries are properly covered by indexes.

## Existing Indexes Inventory

**Expense** (`expenses_expense`):
- Composite: `(user_id, created_at)`
- `recurring_id`, `installments_id` — `db_index=True`
- FK auto-indexes: `user_id`, `bank_account_id`, `expanded_category_id`, `expanded_source_id`

**Revenue** (`expenses_revenue`):
- Composite: `(user_id, created_at)`
- `recurring_id` — `db_index=True`
- FK auto-indexes: `user_id`, `bank_account_id`, `expanded_category_id`

**BankAccount** (`expenses_bankaccount`):
- FK auto-index: `user_id`
- Partial unique: `(user, description) WHERE is_active=True`
- Partial unique: `(user,) WHERE is_default=True`

**BankAccountSnapshot** (`expenses_bankaccountsnapshot`):
- FK auto-index: `user_id`
- No index on `operation_date`

**AssetReadModel** (`variable_income_assets_assetreadmodel`):
- `user_id` — `db_index=True`
- `write_model_pk` — `unique=True`
- Composite: `(user_id, quantity_balance)`
- Composite: `(user_id, normalized_closed_roi)`

**AssetsTotalInvestedSnapshot** (`variable_income_assets_assetstotalinvestedsnapshot`):
- FK auto-index: `user_id`
- No index on `operation_date`

**PassiveIncome** (`variable_income_assets_passiveincome`):
- Single-column: `operation_date`
- FK auto-index: `asset_id`

---

## Per-Endpoint Analysis

### 1. GET /api/v1/assets/indicators
**View:** `AssetViewSet.indicators()`
**Queries:**
- `AssetReadModel.filter(user_id=?).aggregate(...)` — full aggregate over user's assets
- `AssetsTotalInvestedSnapshot.filter(user_id=?).order_by("-operation_date").first()`

**Status: PARTIAL** — Main query covered by `user_id` index. Snapshot query needs `(user_id, operation_date)` for efficient ordered lookup.

---

### 2. GET /api/v1/bank_accounts/summary
**View:** `BankAccountViewSet.summary()`
**Query:** `BankAccount.filter(user_id=?, is_active=True).aggregate(Sum("amount"))`

**Status: OK** — FK index on `user_id` is sufficient; very few bank accounts per user.

---

### 3. GET /api/v1/expenses/indicators?month=X&year=Y
**View:** `ExpenseViewSet.indicators()`
**Query:** `Expense.filter(user_id=?).aggregate(...)` with conditional Sums on `created_at` month/year.

**Status: OK** — Composite `(user_id, created_at)` covers this perfectly.

---

### 4. GET /api/v1/revenues/sum?start=X&end=Y
**View:** `RevenueViewSet.sum()`
**Query:** `Revenue.filter(user_id=?, created_at__gte=?, created_at__lte=?).aggregate(Sum("value"))`

**Status: OK** — Composite `(user_id, created_at)` covers this perfectly.

---

### 5. GET /api/v1/revenues/avg
**View:** `RevenueViewSet.avg()`
**Query:** `Revenue.filter(user_id=?).since_a_year_ago_avg()` — date range on `created_at`, aggregate.

**Status: OK** — Composite `(user_id, created_at)` covers this.

---

### 6. GET /api/v1/assets/total_invested_history?start=X&end=Y
**View:** `AssetViewSet.total_invested_history()`
**Query:** `AssetsTotalInvestedSnapshot.filter(user_id=?, operation_date__gte=?, operation_date__lte=?).order_by("operation_date")`

**Status: NOT COVERED** — No composite index. Only FK index on `user_id`, no index on `operation_date`.

---

### 7. GET /api/v1/bank_accounts/history?start=X&end=Y
**View:** `BankAccountViewSet.history()`
**Query:** `BankAccountSnapshot.filter(user_id=?, operation_date__gte=?, operation_date__lte=?).order_by("operation_date")`

**Status: NOT COVERED** — No composite index. Only FK index on `user_id`, no index on `operation_date`.

---

### 8. GET /api/v1/expenses/historic_report?start=X&end=Y
**View:** `ExpenseViewSet.historic_report()`
**Query:** `Expense.filter(user_id=?, created_at range).annotate(TruncMonth).values().annotate(Sum).order_by()`

**Status: OK** — Composite `(user_id, created_at)` covers this.

---

### 9. GET /api/v1/revenues/historic_report?start=X&end=Y
**View:** `RevenueViewSet.historic_report()`
**Query:** Same pattern as #8 on Revenue model.

**Status: OK** — Composite `(user_id, created_at)` covers this.

---

### 10. GET /api/v1/incomes/sum_credited?start=X&end=Y
**View:** `PassiveIncomeViewSet.sum_credited()`
**Query:** `PassiveIncome.filter(asset__user_id=?, operation_date range, event_type='CREDITED').aggregate(Sum(...))`
- JOIN through `asset` table to filter by user.

**Status: PARTIAL** — FK indexes exist for the join, single-column `operation_date` helps with range. No composite covering `(asset, event_type, operation_date)`.

---

### 11. GET /api/v1/patrimony/growth?months_ago=X
**View:** `PatrimonyViewSet.growth()`
**Queries:**
- `AssetReadModel.filter(user_id=?).aggregate(...)` — OK
- `BankAccount.filter(user_id=?, is_active=True).aggregate(...)` — OK
- `AssetsTotalInvestedSnapshot.filter(user_id=?, operation_date__lte=?).order_by("-operation_date").first()` — NOT COVERED
- `BankAccountSnapshot.filter(user_id=?, operation_date__lte=?).order_by("-operation_date").first()` — NOT COVERED

**Status: NOT COVERED** — Both snapshot table queries lack composite indexes.

---

### 12. GET /api/v1/assets/emergency-fund-total
**View:** `AssetViewSet.emergency_fund_total()`
**Query:** `AssetReadModel.filter(user_id=?, quantity_balance__gt=0 | normalized_closed_roi=0, type='FIXED_BR', ...).aggregate(...)`

**Status: OK** — Composite indexes `(user_id, quantity_balance)` and `(user_id, normalized_closed_roi)` handle the main filters; remaining filters applied post-scan on a small set.

---

### 13. GET /api/v1/expenses/indicators (no query params)
**View:** Same as #3, without `include_fire_avg`.

**Status: OK** — Same coverage as #3.

---

### 14. GET /api/v1/revenues/indicators
**View:** `RevenueViewSet.indicators()`
**Query:** Same pattern as #3 on Revenue model.

**Status: OK** — Composite `(user_id, created_at)` covers this.

---

### 15. GET /api/v1/incomes/sum_credited?... (second call, different date range)
**View:** Same as #10.

**Status: PARTIAL** — Same as #10.

---

### 16. GET /api/v1/incomes/avg
**View:** `PassiveIncomeViewSet.avg()`
**Query:** `PassiveIncome.filter(asset__user_id=?, event_type='CREDITED', operation_date in last-year-range).aggregate(...)`

**Status: PARTIAL** — Same pattern as #10.

---

## Summary Table

| #  | Endpoint                        | Status      | Issue                                                  |
|----|---------------------------------|-------------|--------------------------------------------------------|
| 1  | assets/indicators               | PARTIAL     | Snapshot secondary query unindexed                     |
| 2  | bank_accounts/summary           | OK          | —                                                      |
| 3  | expenses/indicators (params)    | OK          | —                                                      |
| 4  | revenues/sum                    | OK          | —                                                      |
| 5  | revenues/avg                    | OK          | —                                                      |
| 6  | assets/total_invested_history   | NOT COVERED | No composite index on snapshot table                   |
| 7  | bank_accounts/history           | NOT COVERED | No composite index on snapshot table                   |
| 8  | expenses/historic_report        | OK          | —                                                      |
| 9  | revenues/historic_report        | OK          | —                                                      |
| 10 | incomes/sum_credited (1st)      | PARTIAL     | No composite on PassiveIncome for event_type+date      |
| 11 | patrimony/growth                | NOT COVERED | Both snapshot table queries unindexed                  |
| 12 | assets/emergency-fund-total     | OK          | —                                                      |
| 13 | expenses/indicators (no params) | OK          | —                                                      |
| 14 | revenues/indicators             | OK          | —                                                      |
| 15 | incomes/sum_credited (2nd)      | PARTIAL     | Same as #10                                            |
| 16 | incomes/avg                     | PARTIAL     | Same as #10                                            |

## Recommended Indexes

### High Priority

**1. `AssetsTotalInvestedSnapshot(user, operation_date)`**
Fixes: endpoints 1, 6, 11
```python
# In AssetsTotalInvestedSnapshot Meta:
indexes = [models.Index(fields=["user", "operation_date"])]
```

**2. `BankAccountSnapshot(user, operation_date)`**
Fixes: endpoints 7, 11
```python
# In BankAccountSnapshot Meta:
indexes = [models.Index(fields=["user", "operation_date"])]
```

### Medium Priority

**3. `PassiveIncome(asset, event_type, operation_date)`**
Fixes: endpoints 10, 15, 16. Replaces existing single-column `operation_date` index.
```python
# In PassiveIncome Meta.indexes (replace existing operation_date index):
models.Index(fields=["asset", "event_type", "operation_date"])
```

**Bottom line:** 3 new composite indexes cover all 7 underindexed endpoint queries.
