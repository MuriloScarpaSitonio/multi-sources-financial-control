# ✅ COMPLETED — Galeno (sub-indicator)

## What Was Built

Galeno is no longer a standalone strategy. It's an optional sub-indicator that can be toggled on within FIRE or Retirada constante cards.

**Progress bar**: `currentRendaFixa / targetBuffer × 100` where `targetBuffer = avgExpenses × 12 × targetBufferYears`.

**"Years to ready" simulation**: given current stocks, how many years of transferring X%/year until the renda fixa buffer reaches the target.

**Two sliders**:
- Transfer rate: 3–15%, default 6%, step 1
- Target buffer years: 3–10, default 7, step 0.5

**Toggle**: persisted via `show_galeno` in `planning_preferences` JSON field. Only fires API call when toggling on the selected method; other cards use local state.

**Rationale**: when Galeno is toggled, the method card's rationale and pros/cons are enriched with Galeno-specific content, visually marked with `[Galeno]` prefix and italic style.

**Backend validation**: `show_galeno` only accepted when `selected_method` is `fire` or `constant_withdrawal`.

**Files changed**:
- `GalenoIndicator.tsx` — rewritten with buffer progress + depletion simulation
- `Planning/api.ts` — removed `galeno` from `WithdrawalMethodKey`, added `show_galeno` to `PlanningPreferences`
- `Planning/consts.ts` — removed Galeno from METHODS, added `GALENO_RATIONALE`, `GALENO_PROS`, `GALENO_CONS`
- `Planning/index.tsx` — Galeno toggle per card, local vs persisted state
- `Planning/MethodCard.tsx` — pros/cons rendering with `galeno` flag support
- `Home/Indicators.tsx` — conditional Galeno rendering based on persisted preference
- `authentication/serializers.py` — `show_galeno` field, merge logic, validation
