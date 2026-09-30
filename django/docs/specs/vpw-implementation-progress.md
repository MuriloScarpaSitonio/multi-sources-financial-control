# VPW implementation progress

Workspace: `/Users/murilo/github/multi-sources-financial-control` (main worktree).
Baseline: `9312564`. All implementation files are uncommitted and unstaged. The three earlier local implementation commits were removed from the VPW branch history. Existing unrelated edits were preserved.

## Resolved scope

The authoritative decisions are in `vpw-model-review-decisions.md`. The owner explicitly excluded pensions/INSS from this change. The monthly input is the amount requested from investments. Historical growth uses annualized compounded real returns over the selected aligned history, including configured fallback history. Manual RV/RF return sliders no longer drive VPW.

## Integrated behavior

- `/planning/vpw` now renders `VPWStudio`, using FIRE's scenario/results layout, number inputs, history drawer, explicit Recalculate behavior, loading presentation, and sticky header.
- The actual allocation endpoint drives histories and invested wealth. Bank cash is excluded. RV/RF overrides preserve proportions within each group and expose their modeled histories in the drawer, including reference groups when no holdings exist.
- The headline, target, Home card, Planning card, and worker requests share `vpwScenario` and the tested monthly annuity helpers. Simulated wealth affects withdrawals from today; accumulation starts from actual wealth.
- Both historical sampling modes work through the shared worker. The monthly allowance is recalculated before each withdrawal and capped by the requested monthly amount and available balance. The final year retains monthly timing; unspent money stays invested.
- Accumulation targets decrease with the remaining horizon. Timing is conditional on reaching the target, with the reach percentage and actual simulation horizon displayed. Nonpositive savings suppress timing without assuming asset sales to fund a deficit.
- Minimum-income percentiles come from each trial's lowest annual withdrawals divided by 12, including zero. Income and balance charts are separate; no artificial terminal-zero income point enters the minimum calculation.
- Invalid saved target ages remain editable. Missing birth dates, unsupported age limits, query errors, and worker errors have explicit states. Inputs remain editable during worker calculations.
- Historical preferences are independently saved under VPW. Shared FIRE calculation bodies remain unchanged. Legacy backend stock_return/bond_return keys remain accepted for old-client compatibility but are ignored by the new VPW calculations and absent from its frontend controls/types.
- Explanation content describes the actual monthly VPW model. It no longer embeds FIRE's withdrawal-rate tutorial or claims guaranteed depletion, growing income, or retirement safety based on initial coverage.

## Verification

- Full frontend regression suite, including FIRE, passed; final count is recorded in `/private/tmp/vpw-all-frontend-final.log`.
- 24 Node VPW math/simulation tests passed, as did the existing standalone FIRE portfolio/bootstrap/result-presentation scripts.
- 93 Django user API tests passed. Existing dependency warnings and sandbox-denied mirakuru cleanup inspection remain; pytest exited successfully.
- TypeScript and production build passed; existing Vite large-chunk warning remains.
- All nine matched performance cases passed with 1,500 trials and five measured runs. The 60-year balanced case is 36.7 ms versus 847.4 ms originally. See `../benchmarks/README.md` for the complete comparison and worker evidence.
- A fresh independent review found two important integration issues: modeled history controls and failed-query handling. Both were fixed with observed failing-then-passing regression tests. No other material findings were reported.
- The localhost development server serves the new VPW route module.

## Remaining verification limitation

Chrome computer access was not approved. Browser visual QA and actual browser-page responsiveness could not be verified. Component tests and the real production worker probe passed, but are not substitutes for that browser measurement. No claim of completing the full goal's browser-verification criterion is made.

No commits, pushes, merges, deployments, or new pension fields were made during integration.

Completion audit: `vpw-completion-audit.md` maps every approved decision and cross-cutting gate to implementation and test evidence. Additional saved-settings/reopen/inactive-strategy and mobile controls tests passed (15 tests across the two affected UI files); TypeScript passed again. Production code and benchmark workloads were unchanged. Browser access permission is pending.

## Latest approved corrections — complete except prior browser check

All four UI/behavior corrections approved by the user were applied to the main worktree, uncommitted: extra accumulation years with fixed end age; removed allocation/cash sentence; replaced custom coverage banner with FIRE metric cards and VPW income figures; removed RV input and ignored legacy allocation overrides. Saved extra years survive PATCH/GET and route reopening. Each trial's accumulated balance funds its retirement; no median-balance shortcut or increased trial count.

Focused final review: one Important finding (nonpositive savings could still yield an extended retirement date) fixed with failing-then-passing engine/scenario tests. Final suites: 137 frontend, 31 VPW calculation, 99 API; existing FIRE scripts, TypeScript and production build pass. Performance artifacts and exact medians live in `docs/benchmarks/README.md`. Localhost source serves the updated controls. Chrome access remains denied, so actual browser visual/responsiveness checks remain unverified. Nothing staged, committed, pushed or published.

## Results-structure correction — 2026-09-27

Applied a presentation-only correction in `VPWResults.tsx`: FIRE's main-result/metrics/scenarios/retirement-chart order, with the existing pessimistic minimum income as the main VPW result. The scenario table now includes a reading against requested spending. Below-budget initial and pessimistic income use the negative tone. Actual-wealth accumulation is a separate section after retirement results. Existing historical details remain available in a collapsed section. No simulation, input, persistence, trial-count or numerical-method changes.

Verification: 17 affected page tests pass (`/private/tmp/vpw-results-layout-tests.log`), TypeScript passes, local Vite source serves the changed component. All work remains uncommitted; browser rendering has not been verified.

## Source-grounded information review — 2026-09-27

A fresh independent read-only review covered both FIRE render branches and VPW's current results. It identified three concrete issues: reversed accumulation scenario labels, missing retire-today/scenario-wealth conditions beside the result, and missing explanation of VPW allowance versus capped withdrawal. No wholesale redesign was recommended.

Corrections: VPW reuses `FireAccumulationChart` with VPW labels (FIRE defaults preserved), including its correct p10-optimistic/p90-pessimistic gap mapping, tooltips and crossing markers. The main result states today's scenario wealth and the ending age when no extra accumulation applies; existing extended-start disclosures remain. The initial-withdrawal help explains the existing allowance and spending ceiling without adding another headline number. No simulation logic or financial inputs changed.

Verification: both new regressions failed before the correction (`/private/tmp/vpw-chart-red.log`); all 139 frontend tests across 23 files pass (`/private/tmp/vpw-information-tests.log`), TypeScript passes. Main worktree only, unstaged/uncommitted; no claim that passing tests establishes user acceptance of the overall UI. Browser rendering remains unverified.

## Owner clarification: layout accepted; information confusing

The owner explicitly clarified: “the layout is ok. the info is confusing.” Preserve the current layout. Do not request Chrome access or continue cosmetic/layout work to resolve this feedback. No new income-coverage probability has been approved or implemented.

Presentation-only changes now distinguish first-month withdrawal from the monthly average in each simulation's lowest-income year; identify starting capital as covering the first requested withdrawal; label actual wealth as portfolio wealth; replace the expense multiple with the existing projection end age; and label the pessimistic spending gap directly. The scenario table explicitly names its time basis and spending comparison. No simulation, settings or layout changes.


## Result content implemented — 2026-09-28

Updated the main-worktree VPWResults component after the owner requested delivery of the working page. The accepted layout stays intact. The headline expresses the existing pessimistic worst-year withdrawal statistic as the required spending reduction. Cards now separate current wealth/initial target/target gap from allowance/actual first withdrawal/initial shortfall. Extra-accumulation scenarios instead show their observed median retirement starting age, balance, and first payment; participation remains disclosed. Removed repeated ending-age and expense-input result cards. No new success probability, simulation runs, worker changes, or financial assumptions.

Verification: 22 affected component tests passed, TypeScript passed, Vite production build passed (existing chunk-size warning), git diff --check passed, and the localhost:3000 source response contains the updated component. No browser visual verification was performed. Tests distinguish actual from simulated wealth, initial ceiling from lifetime shortfall, full coverage, and delayed retirement observations. All changes remain uncommitted and unstaged. This records implementation and checks, not owner acceptance.


### Latest result-content revision rejected and reverted

The owner rejected the 2026-09-28 result-content revision. Restored VPWResults.tsx and its two affected test files byte-for-byte from the pre-revision backups. Earlier uncommitted work remains intact. The preceding implementation entry and its 22-test evidence describe the rejected version, not the restored current UI. No further redesign has been made.
