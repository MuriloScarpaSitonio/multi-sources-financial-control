# ✅ COMPLETED — 1/N Withdrawal Method Indicator

## 1. Method Summary

Instead of a fixed percentage, divide your portfolio by the number of remaining years you need it to last.

- Year 1 with 20-year horizon: withdraw 1/20th
- Year 2: 1/19th
- And so on

The withdrawal percentage increases each year. Designed to spend down the entire portfolio by a target date. The 1/N amount can be treated as a maximum ("I can withdraw UP TO 1/N this year").

### Formula
```
withdrawal_percentage = 1 / years_remaining * 100
annual_withdrawal = portfolio_total * (1 / years_remaining)
monthly_withdrawal = annual_withdrawal / 12
```

Where `years_remaining = target_depletion_age - current_age`.

---

## 2. What the Indicator Would Show (UI/UX)

### Location
Below/alongside the existing FIRE progress bar in `react/src/pages/private/Home/Indicators.tsx`.

### Visual Design
- **Title:** "Retirada 1/N (Esgotamento planejado)"
- **Primary value:** Monthly withdrawal amount
- **Secondary:** Withdrawal percentage, years remaining
- **Progress bar:** Monthly withdrawal vs average monthly expenses (green if >= 100%)
- **User controls:**
  - Birth year input (or use stored `date_of_birth`)
  - Target depletion age slider (default: 90, range 70-105)
- **Tooltip:** "Divide o patrimonio pelo numero de anos restantes. Ano 1: 1/N do total. Cada ano a porcentagem aumenta. O portfolio sera totalmente consumido ate a idade alvo."

---

## 3. Data Already Exists vs What Is Missing

### EXISTS

| Data | Source |
|------|--------|
| Total portfolio value | `useAssetsIndicators().total + useBankAccountsSummary().total` -- computed in `Indicators.tsx` |
| Average monthly expenses (FIRE) | `useHomeExpensesIndicators({ includeFireAvg: true }).fire_avg` |

### MISSING

| Data | Why Needed | Solution |
|------|-----------|----------|
| **User's age / birth date** | Core to formula: years_remaining = target - age | `date_of_birth` on `CustomUser` model OR localStorage for MVP |
| **Target depletion age** | Defines the N in 1/N | Frontend state with slider (default 90) |

---

## 4. Backend Changes Needed

### Add `date_of_birth` to `CustomUser`
- Add `date_of_birth = models.DateField(null=True, blank=True)` to `CustomUser` at `django/authentication/models.py`
- Migration + serializer update
- Add `"one_over_n"` to `PlanningPreferencesSerializer.selected_method` choices
- **Complexity:** Small

This also unlocks the shared prereq for all future age-based methods (VPW, Glide-Path, both Age-in-Bonds).

---

## 5. Frontend Changes Needed

### 5.1 Create 1/N Indicator Component
**File:** `react/src/pages/private/Home/OneOverNWithdrawalIndicator.tsx` (NEW)
**Complexity:** Medium

- Accept props or use hooks: `patrimonyTotal`, `avgExpenses`, `isLoading`
- Uses `date_of_birth` from user profile; if not set, shows prompt to configure it
- Internal state for `targetAge` (default 90, slider 70-105)
- Calculate `currentAge`, `yearsRemaining`, `withdrawalPct`, `annualWithdrawal`, `monthlyWithdrawal`
- Coverage ratio: `monthlyWithdrawal / avgExpenses * 100`
- If no birth year set, prompt to enter it
- Follows `FIREProgressBar` pattern (styled `LinearProgress`, tooltip, slider)
- Uses `useHideValues` for privacy

### 5.2 Integrate into Home Indicators
**File:** `react/src/pages/private/Home/Indicators.tsx` (MODIFY)
**Complexity:** Small

- Import and render after FIRE bar

---

## 6. Edge Cases

1. **No `date_of_birth` set**: Show prompt to configure it in user profile
2. **years_remaining <= 0**: User's age >= target age. Show warning, suggest increasing target
3. **years_remaining = 1**: Withdrawal = 100% of portfolio. Valid but show caution
4. **Very young user (e.g., age 25, target 90)**: 1/65 = 1.5% -- very low withdrawal, which is correct
5. **Zero portfolio**: Guard against division by zero

---

## 7. Projection Table (Nice-to-Have)

Optionally show a small table or chart projecting withdrawals over time:

| Year | Age | % | Annual Withdrawal | Remaining |
|------|-----|---|-------------------|-----------|
| 1 | 35 | 1.8% | R$ 18,000 | R$ 982,000 |
| 5 | 39 | 2.0% | R$ 19,600 | R$ 900,000 |
| 10 | 44 | 2.2% | R$ 19,800 | R$ 780,000 |
| ... | ... | ... | ... | ... |

This would account for portfolio returns during depletion. Requires assumed return rate (similar to constant-dollar indicator).

---

## 8. File-by-File Summary

| File | Action | Complexity |
|------|--------|------------|
| `django/authentication/models.py` | MODIFY | Small |
| `django/authentication/serializers.py` | MODIFY | Small |
| `django/authentication/migrations/` | CREATE (auto) | Small |
| `react/src/pages/private/Home/OneOverNWithdrawalIndicator.tsx` | CREATE | Medium |
| `react/src/pages/private/Home/Indicators.tsx` | MODIFY | Small |
| `react/src/pages/private/Planning/consts.ts` | MODIFY | Small |
| `react/src/pages/private/Planning/api.ts` | MODIFY | Small |
| `react/src/pages/private/Planning/index.tsx` | MODIFY | Small |

---

## 9. Total Effort Estimate

| Task | Effort |
|------|--------|
| `date_of_birth` on model + migration + serializer | 1 hour |
| Add `one_over_n` to planning preferences + consts | 30 minutes |
| OneOverNIndicator component with target age slider | 3 hours |
| 1/N calculation logic | 30 minutes |
| Integration into Indicators.tsx + Planning page | 30 minutes |
| Testing and edge cases | 1 hour |
| **Total** | **~6.5 hours** |

**Overall complexity: Small-Medium. Simplest math of all methods. Small backend cost for `date_of_birth` pays off as shared prereq for all future age-based methods (VPW, Glide-Path, both Age-in-Bonds).**
