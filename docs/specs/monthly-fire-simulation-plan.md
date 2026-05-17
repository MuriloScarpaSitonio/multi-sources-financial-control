# Monthly FIRE Simulation Plan

## Goal

Improve FIRE, VPW, and 1/N simulations by moving from annual return sampling to monthly Brazilian real-return data.

The target is a simulation closer to brFIRESim's model: historical Brazilian monthly data, inflation-adjusted, with aligned asset-class returns.

## Baseline

Current baseline after the B3 data update:

- Equity: B3 IBOV, 1995-2025
- REIT/FII proxy: B3 IFIX, 2011-2025
- Fixed income proxy: BCB CDI, 1995-2025
- Inflation: BCB IPCA, 1995-2025
- Simulation frequency: annual
- Sampling: random aligned historical years

This is already better than the old NEFIN 2001-2025 window, but monthly data can model contributions, withdrawals, and sequence risk more naturally.

## Phase 1: Generate Monthly Real Returns

Extend `generate_fire_returns_ts` to emit monthly arrays in addition to annual arrays.

Monthly series:

- `IBOV_MONTHLY_REAL_RETURNS`
- `IFIX_MONTHLY_REAL_RETURNS`
- `CDI_MONTHLY_REAL_RETURNS`
- `FIRE_RETURNS_MONTHS`
- `IFIX_MONTHS`

Rules:

- Use B3 daily index levels for IBOV and IFIX.
- Use last available trading day of each month.
- Compute nominal monthly return from previous month close to current month close.
- Use BCB SGS 4391 directly for monthly CDI.
- Use BCB SGS 433 directly for monthly IPCA.
- Deflate each month as:

```text
real = (1 + nominal) / (1 + ipca) - 1
```

Keep annual arrays for compatibility until the monthly engine is proven.

## Phase 2: Add Monthly Simulation Engine

Add a separate engine instead of replacing the annual one immediately.

Needed capabilities:

- Monthly contributions during accumulation.
- Monthly withdrawals during retirement.
- Aligned month sampling across IBOV, IFIX, CDI, and IPCA.
- IFIX-aware sample windows, same materiality threshold concept as today.
- Deterministic seeded randomness.

Initial functions:

- `runMonthlyBootstrap`
- `runMonthlyAccumulationBootstrap`
- `runMonthlyBootstrapWithVaryingWithdrawal`
- `runMonthlyBootstrapWithVaryingWeights`

Do not remove the annual engine in this phase.

## Phase 3: Compare Annual vs Monthly

Before changing the UI behavior, compare both engines for representative scenarios:

- FIRE 30 years, 60/40, no IFIX
- FIRE 60 years, 70/30, no IFIX
- FIRE with material IFIX
- Age-in-bonds
- VPW current scenario
- 1/N current scenario

Compare:

- safe withdrawal rate
- FIRE target
- projected retirement age
- p10 / p50 / p90 balances
- depletion behavior
- runtime impact

Only switch if the monthly engine produces coherent values and acceptable performance.

## Phase 4: Switch Consumers

If the comparison is acceptable, migrate strategy consumers one at a time:

1. FIRE static
2. FIRE age-in-bonds
3. VPW
4. 1/N

Keep the existing UX shape. The goal is better data and mechanics, not a redesign.

Update labels from annual sample language to:

```text
Dados mensais reais brasileiros: IBOV/CDI/IPCA 1995-2025; IFIX 2011-2025 quando ha exposicao material a FII.
```

## Phase 5: Better Fixed-Income Proxies

After monthly simulation works, research ANBIMA indexes.

Potential mappings:

- CDI: cash / post-fixed / emergency fund proxy
- IMA-S: Tesouro Selic / LFT proxy
- IMA-B or IMA-B 5: IPCA+ marked-to-market proxy
- IRF-M: prefixado marked-to-market proxy

This should be a separate feature. CDI is too smooth for marked-to-market bonds, but it is acceptable as the first monthly fixed-income proxy.

## Non-Goals

- Do not use individual COTAHIST stocks/FIIs for simulation yet.
- Do not add new user inputs.
- Do not change the planning page UX before the monthly engine is validated.
- Do not replace IFIX with individual FII price data without distribution/corporate-action handling.

## Main Risks

- B3 index endpoints are semi-internal.
- IFIX still starts only in 2011.
- Monthly simulation may be slower.
- Monthly random sampling can look more precise than the data really supports.
- Fixed income remains simplified if everything maps to CDI.

## Success Criteria

- Generated monthly data is reproducible.
- Monthly engine is deterministic.
- Existing annual engine remains available during rollout.
- UI outputs are stable and explainable.
- Build passes.
- Methodology copy clearly states the data sources and sample windows.
