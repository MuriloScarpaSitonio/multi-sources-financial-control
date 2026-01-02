# SPEC: Multiple Bank Accounts

## 1. Current State

### Data Model
```python
class BankAccount(models.Model):
    amount = models.DecimalField(decimal_places=2, max_digits=18)
    description = models.CharField(max_length=300)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.OneToOneField(  # <-- Single account per user
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bank_account"
    )
```

### Current Usage
- **Emergency Fund:** `monthsCovered = bankAmount / avgExpenses`
- **Net Worth:** `current_total = assets_total + bank_amount`
- **Credit Card Bill:** Auto-decrements bank account on billing date
- **Snapshots:** Monthly aggregate stored in `BankAccountSnapshot`

### API
- `GET /bank_account` - Returns single account object
- `PUT /bank_account` - Updates single account

---

## 2. Proposed Changes

### 2.1 Data Model Changes

```python
class BankAccount(models.Model):
    amount = models.DecimalField(decimal_places=2, max_digits=18)
    description = models.CharField(max_length=300)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)  # Soft delete
    account_type = models.CharField(
        max_length=50,
        choices=[
            ('checking', 'Conta Corrente'),
            ('savings', 'Poupança'),
            ('investment', 'Investimento'),
            ('other', 'Outro')
        ],
        default='checking'
    )
    order = models.PositiveIntegerField(default=0)  # UI ordering
    user = models.ForeignKey(  # <-- Changed from OneToOneField
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bank_accounts"  # <-- Plural
    )

    class Meta:
        unique_together = [['user', 'description']]
        ordering = ['order', '-updated_at']
```

### 2.2 API Changes (Breaking)

**Old API (deprecated):**
- `GET /bank_account` → single object
- `PUT /bank_account` → update single

**New API:**
- `GET /bank_accounts` → array of accounts
- `POST /bank_accounts` → create new account
- `PUT /bank_accounts/{id}` → update specific account
- `DELETE /bank_accounts/{id}` → soft delete (is_active=False)
- `GET /bank_accounts/summary` → aggregated total

### 2.3 Indicator Changes

All indicators sum ALL active bank accounts:

```python
total_bank_amount = BankAccount.objects.filter(
    user_id=user_id,
    is_active=True
).aggregate(total=Sum('amount'))['total'] or Decimal('0')
```

### 2.4 Credit Card Bill Handling

**Decision:** Remove automatic decrement, let user manage manually.

- Remove/disable `decrement_credit_card_bill` task
- User manually updates account balances

### 2.5 Snapshot Strategy

**Decision:** Keep aggregate-only snapshots.

```python
# Monthly task creates aggregate snapshot
total = BankAccount.objects.filter(
    user_id=user_id,
    is_active=True
).aggregate(total=Sum('amount'))['total']

BankAccountSnapshot.objects.create(
    user_id=user_id,
    operation_date=today,
    total=total
)
```

---

## 3. UI Changes

**New Account Management Section:**
```
/Expenses/BankAccounts/
├── BankAccountsList.tsx      # List all accounts
├── BankAccountForm.tsx       # Create/Edit drawer
└── hooks.ts                  # API hooks
```

**Features:**
- Data table with: Name, Type, Balance, Last Updated, Actions
- Create new account button
- Edit/Archive account actions
- Drag-to-reorder
- Summary row showing total across all accounts

---

## 4. Files to Modify

**Backend:**
- `django/expenses/models/bank_account.py` - Change OneToOne to ForeignKey, add fields
- `django/expenses/views.py` - Update ViewSet for multiple accounts
- `django/expenses/serializers/bank_account.py` - Update serializers
- `django/shared/views.py` - Update patrimony calculation
- `django/expenses/service_layer/tasks/bank_account.py` - Remove/modify CC task

**Frontend:**
- `react/src/pages/private/Expenses/hooks/bank_account.ts` - Update to array
- `react/src/pages/private/Expenses/Indicators/` - Update all indicators
- `react/src/pages/private/Expenses/BankAccounts/` - New management UI
- `react/src/pages/private/Home/FinancialHealthSummary.tsx` - Aggregate display

---

## 5. Migration Strategy

**Phase 1:** Add new fields (is_active, account_type, order) as nullable

**Phase 2:** Data migration
- Backfill existing accounts: is_active=True, account_type='checking', order=0

**Phase 3:** Change relationship
- Alter user field from OneToOneField to ForeignKey
- This requires careful migration (may need to recreate field)

**Phase 4:** Update related_name
- From `bank_account` (singular) to `bank_accounts` (plural)

---

## 6. Implementation Phases

### Phase 1: Backend Data Model
1. Add new fields to BankAccount
2. Change OneToOneField to ForeignKey
3. Data migration for existing accounts

### Phase 2: Backend API
1. Update ViewSet for CRUD operations
2. Update serializers for array response
3. Add summary endpoint
4. Update patrimony calculation

### Phase 3: Frontend Hooks
1. Update useBankAccount to return array
2. Create aggregation utilities
3. Update all hook consumers

### Phase 4: Frontend Management UI
1. Create BankAccountsList component
2. Create BankAccountForm component
3. Implement CRUD operations

### Phase 5: Frontend Indicators
1. Update all indicators to aggregate
2. Add optional breakdown display

### Phase 6: Testing
1. Backend tests for new endpoints
2. Migration tests
3. Frontend component tests
4. E2E tests

---

## 7. Complexity Assessment

| Aspect | Rating |
|--------|--------|
| **Overall Complexity** | High |
| **Breaking Changes** | API breaking change |
| **Schema Impact** | Relationship change (OneToOne → ForeignKey) |
| **UI Effort** | New management pages |
| **Testing Effort** | High |
