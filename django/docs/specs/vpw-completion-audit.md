# VPW completion audit

Current authoritative implementation: main worktree, uncommitted, baseline `9312564`. Latest owner scope excludes pension/INSS support. This audit does not treat the earlier pension approval or intermediate implementation notes as current requirements.

Previous goal turn: **progress** — connected the actual route and cards, corrected review findings, passed financial/API/frontend/build checks, and recorded final matched benchmarks. This continuation: **progress** — verified the remaining UI persistence and mobile-control behavior, and recorded the requirement audit. Chrome access remains the same external blocker, seen in the implementation turn and this continuation. An explicit access question is pending; no browser access has been assumed.

| Requirement | Authoritative implementation and evidence | Result |
| --- | --- | --- |
| 1. Asset-specific history in both engines | `Home/vpwPortfolio.ts`, shared `firePortfolio.ts`, `vpwSimulation.ts`; portfolio tests cover US/global/crypto/fixed income and ignore legacy allocation overrides; simulation fixture proves US uses SPY; production route test checks its worker request | Verified |
| 2. Historical real growth, no manual return controls | `Planning/vpw/vpwScenario.ts`; round-trip, negative-growth and selected-aligned-history tests; route and compact card use this builder; old sliders removed | Verified |
| 3. Conditional timing plus reach fraction | Engine test `timing excludes failed trials while the reach fraction still includes them`; `VPWResults` displays both; UI result fixture verifies reach disclosure | Verified |
| 4. No timing at nonpositive savings | Engine test rejects implied portfolio sales; UI test retains target and asks for a positive contribution | Verified |
| 5. Initial coverage only | `VPWResults` uses FIRE metric cards with initial withdrawal and per-trial income minima; compact-card test rejects retirement-safety wording | Verified |
| 6. Pension scope | Latest owner instruction: leave it out. No pension fields or income offsets in builder, APIs or UI | Verified exclusion |
| 7. Mandatory spending ceiling and retained excess capital | Engine `spending is a required ceiling and unused capital remains invested`; builder and headline use the same cap; UI expense edit reaches worker input | Verified |
| 8. Both sampling choices | Shared FIRE sampler; deterministic/different-path engine test; UI test sends 12-month blocks on Recalculate; backend accepts both | Verified |
| 9. Per-trial income minimum first, including zero | Dedicated different-minimum-years engine fixture and genuine-zero fixture; UI shows worker minima instead of minima of chart lines | Verified |
| 10. Headline/engine agreement | Shared monthly annuity helpers; builder caps by available wealth and requested amount; actual/simulated wealth fixture; compact card uses same builder | Verified |
| 11. Actual accumulation horizon | Targets use `min(80, years - 1)`; unreached result test and one-year UI fixture | Verified |
| 12. Background simulations and responsive page | Shared worker request/dispatch, stale-result/error/cancellation tests, actual worker probe, editable-inputs-during-job UI test | Worker verified; actual browser responsiveness **unverified** |
| 13. Zero-growth formula | R$120,000 / 120 months = R$1,000 test, zero-growth simulation fixture | Verified |
| 14. Monthly payment timing and target | Independent 240-month cash-flow test gives approximately R$651.18 from R$100,000 at 5%; target inverse tested | Verified |
| 15. Monthly final year | Final-year test proves retained funds keep earning; no annual liquidation shortcut | Verified |
| 16. Recover invalid target age | Tests for invalid saved age, typed value clamping, and explicit age-105 limit; controls remain mounted | Verified |
| 17. Monthly recalculation | Monthly-loss fixture changes the next payment; schedule computed once outside trial loops; unchanged trial counts in benchmarks | Verified |

## Cross-cutting gates

- Main worktree contains all work, uncommitted/unstaged; original unrelated files match the captured SHA-256 hashes. No push, merge, publish, or deployment.
- FIRE UI format: reused numeric controls, history drawer, loading presentation and header; two-column scenario/results, desktop collapse, mobile expand, draft/submitted snapshots and explicit Recalculate. Component tests verify desktop routing and mobile controls; real-browser visual QA remains unverified.
- Preference persistence: Django tests cover PATCH/GET, map clearing, independent FIRE preservation, invalid values and inactive-strategy protection. New UI audit tests cover Save's VPW-only payload, reopened values, and inactive VPW editing without saving over FIRE. Worker scenarios include the selected saved histories.
- Actual wealth versus simulated wealth, no bank cash, no additional expense schedule/tax/essential-spending fields, no pension model and no 90% gate are preserved in the builder/engine/UI; reviewed independently.
- The updated frontend regression suite and build are recorded in the latest approved-correction section below.
- Financial engine checks are recorded in the latest approved-correction section below.
- Backend: 99 user API tests passed, including extra-years PATCH/GET and invalid values; `/private/tmp/vpw-extra-api-green.log`.
- Production build and TypeScript passed, `/private/tmp/vpw-approved-build.log`; existing large-chunk warning.
- Benchmarks: all nine same-machine matched independent-month cases meet median-of-five no-slowdown gate at 1,500 trials per engine. Baseline and integrated inputs retain the same portfolios, starting wealth, spending, savings and horizons. Corrected math and historical-growth estimation intentionally change outputs. See `../benchmarks/README.md` and final JSON artifacts. New block mode recorded separately because the old engine had no comparable option.
- Actual production worker probes cover both zero and five extra years; latest medians are in `docs/benchmarks/README.md`. Node heartbeat remained active. This is explicitly not browser responsiveness evidence.
- Fresh independent review completed; both Important findings fixed with observed failing-then-passing regressions. No remaining material review findings.
- Local Vite source endpoint confirms `/planning/vpw` imports the new studio. This proves which route source is served, not its browser rendering.

## Completion conclusion

Implementation and available automated gates are satisfied. Full goal completion remains unproven solely because Chrome access was not approved; real-browser visual QA and responsiveness must be checked after access is granted, or the owner must explicitly revise that requirement. The goal must not be marked complete on Node or component-test evidence alone.

Blocked audit: the Chrome-access blocker has now persisted for three consecutive goal turns (implementation, UI verification continuation, availability recheck). The latest browser inventory is empty; native Chrome access was previously not approved, and the explicit access question has no reply. All independent implementation and verification work is finished. Mark the goal blocked pending browser access; do not substitute Node/component checks or repeat denied access attempts.

## Latest four approved corrections

- Added FIRE-style extra-years input, integer 0–60, bounded to leave retirement time before the target age. Setting defaults to zero and persists separately in VPW. Each trial reaches its declining VPW target, contributes for the chosen additional years, then uses its own resulting balance for monthly withdrawals until the unchanged target age.
- Removed the rejected allocation/cash sentence and custom coverage banner. The results reuse FIRE's actual `MetricBlock` component and card structure, with VPW initial income, worst-year income percentiles and spending gap. Extension status discloses retirement participation; no income results appear for zero retirement participants.
- Removed the RV field and all allocation rescaling. Supported-setting normalization drops legacy allocation overrides; the engine independently ignores extra legacy properties. Actual asset weights and selected histories are used. The existing explicitly labeled empty-portfolio reference remains.
- The local Vite source endpoint returned HTTP 200 with the new extra-years field and without the removed RV field. This is source delivery evidence, not browser visual QA.
- Fresh focused review found one Important issue: the extension could forecast target crossing without positive savings. Fixed with observed RED→GREEN engine and scenario regressions. Below-target scenarios with nonpositive savings now require a positive contribution before extra accumulation can be calculated; already-at-target scenarios can still wait the chosen extra years. No other findings, declined judgments, rulings or deferred minors.
- Main worktree only; nothing staged or committed. All three unrelated user files retain their captured SHA-256 hashes.

### Final automated checks for approved corrections

- Frontend: **137 tests / 22 files passed**, `/private/tmp/vpw-approved-full-frontend.log`. One initial run alongside the build hit an existing FIRE test's five-second timeout; rerunning the suite with two workers passed without modifying the test or reducing simulation trials.
- VPW math and simulations: **31 tests passed**, `/private/tmp/vpw-approved-core.log`. Existing FIRE portfolio, bootstrap and result-presentation scripts also passed.
- API: **99 tests passed**, `/private/tmp/vpw-extra-api-green.log`. Existing deprecation warnings and a sandbox-only process-cleanup warning followed pytest's successful result.
- TypeScript and production build passed. Existing chunk-size warning remains. Build log: `/private/tmp/vpw-approved-build.log`.
- Review finding RED logs: `/private/tmp/vpw-review-red.log`, `/private/tmp/vpw-review-scenario-red.log`; both covering regressions are included in the final passing suites.
- No git history changes: HEAD remains `9312564792cec9c4bfee32caab41536fe8159321`; index is empty. Browser access remains the sole incomplete goal criterion.

## Results-structure correction — 2026-09-27

Applied a presentation-only correction in `VPWResults.tsx`: FIRE's main-result/metrics/scenarios/retirement-chart order, with the existing pessimistic minimum income as the main VPW result. The scenario table now includes a reading against requested spending. Below-budget initial and pessimistic income use the negative tone. Actual-wealth accumulation is a separate section after retirement results. Existing historical details remain available in a collapsed section. No simulation, input, persistence, trial-count or numerical-method changes.

Verification: 17 affected page tests pass (`/private/tmp/vpw-results-layout-tests.log`), TypeScript passes, local Vite source serves the changed component. All work remains uncommitted; browser rendering has not been verified.

## Source-grounded information review — 2026-09-27

A fresh independent read-only review covered both FIRE render branches and VPW's current results. It identified three concrete issues: reversed accumulation scenario labels, missing retire-today/scenario-wealth conditions beside the result, and missing explanation of VPW allowance versus capped withdrawal. No wholesale redesign was recommended.

Corrections: VPW reuses `FireAccumulationChart` with VPW labels (FIRE defaults preserved), including its correct p10-optimistic/p90-pessimistic gap mapping, tooltips and crossing markers. The main result states today's scenario wealth and the ending age when no extra accumulation applies; existing extended-start disclosures remain. The initial-withdrawal help explains the existing allowance and spending ceiling without adding another headline number. No simulation logic or financial inputs changed.

Verification: both new regressions failed before the correction (`/private/tmp/vpw-chart-red.log`); all 139 frontend tests across 23 files pass (`/private/tmp/vpw-information-tests.log`), TypeScript passes. Main worktree only, unstaged/uncommitted; no claim that passing tests establishes user acceptance of the overall UI. Browser rendering remains unverified.
