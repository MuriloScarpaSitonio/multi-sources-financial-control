# ✅ COMPLETED — Retirada Constante (formerly "Dólar constante")

> Renamed key from `constant_dollar` to `constant_withdrawal`.

## What Was Built

Progress bar = `simulatedDepletionYears / targetYears × 100`. Answers: "will my money outlast me?"

**Simulation**: year-by-year depletion using user-configured real return rate and current expenses.

**Two sliders**:
- Real return: 1–8%, default 5%, step 0.5%
- Target years: 20–50, default 30, step 5

**Files changed**:
- `ConstantDollarIndicator.tsx` — rewritten with depletion simulation, two sliders
- `Planning/consts.ts` — renamed, updated subtitle/rationale, added pros/cons
- `Planning/index.tsx` — new state (`realReturn`, `targetYears`)
- `Home/Indicators.tsx` — same state changes
- `Planning/api.ts` — type renamed to `constant_withdrawal`
- `authentication/serializers.py` — backend choice renamed
