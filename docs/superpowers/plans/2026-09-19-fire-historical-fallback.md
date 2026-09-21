# FIRE Historical Fallback Implementation Plan

> Implement inline, with a fresh final code review. User approved this design in conversation and explicitly asked to proceed after committing existing work.

**Goal:** Allow one optional earlier return dataset per asset bucket, with clear provenance and a primary-only comparison.
**Architecture:** Persist a bucket-key-to-series fallback map alongside existing overrides. A pure portfolio resolver joins only fallback months before the primary's first month. Existing precomputed simulation tables consume that history without changing formulas or trial counts. Drawer drafts apply both maps together.
**Tech Stack:** Django REST Framework, TypeScript, React/MUI, Vitest, pytest.
**Spec:** Approved conversation: optional secondary selector; combined-history timeline with usable-history proportions; unusual-choice warnings; approximation and block-boundary explanation; result badge and primary-only comparison.

## Constraints
- No fallback chains, manual cutoff dates, blending, or filling primary interior/end gaps.
- Preserve category, balance, weight, existing financial formulas, precision, seeded outputs without fallbacks, and trial counts.
- Respect existing independent-month and contiguous-block sampling. A block can cross the constructed source boundary; disclose this in the UI rather than silently change sampling rules.
- Draft changes are cancelable. Only explicit existing Save persists preferences.
- No user/database changes outside isolated tests. Do not commit the new feature without another request; the authorized current-work commit was 340776c.
- Keep the accepted design-system styling, grouping, current copy, and unrelated files.

## Review focus
1. Boundary: fallback ends strictly before primary first month; overlap always uses primary.
2. Gaps: secondary cannot fill missing primary months or extend its last date.
3. Scope: another bucket can still shorten combined history; timeline percentage uses shared eligible months.
4. Persistence: fallback removal and primary-only comparison must not lose user's saved/draft choices.
5. Sampling: age-in-bonds retains fallback metadata; no-fallback snapshots remain exact; avoid per-trial resolution.

## Task 1: Data contract and pure historical resolution
Files: authentication/serializers.py and tests; Planning/api.ts; Home/firePortfolio.ts; new Home/fireHistoricalFallback.test.ts.
- [x] Add failing serializer tests for historical_series_fallbacks accepted/unknown dataset/rejected bucket/removal map; add return-resolution tests for real dataset boundaries, overlap, gaps, weight preservation, remaining limiter, and no-fallback equivalence.
- [x] Add validated historical_series_fallbacks map with the same keys and choices as overrides. Share its validation rather than duplicate allowed values.
- [x] Add optional fallbackSeries to PortfolioSlice; buildPortfolio gets it from preferences. Preserve old object shapes when absent.
- [x] Implement historicalMonthsForSlice(slice) and historicalSourceForMonth(slice, month). Prefix only fallback months less than primary first month. eligibleMonths intersects resolved monthly coverage; returnForMonth retrieves the chosen monthly real return.
- [x] Run new tests and deterministic financial regressions plus standalone financial scripts.

## Task 2: Drawer, live coverage, and save flow
Files: Planning/fire/FireHistoricalDrawer.tsx, FireHistoricalSettings.tsx, FireScenarioPanel.tsx, fireHistoricalDatasets.ts, new FireHistoricalCoverage.tsx / FireDatasetSelect.tsx; strategies/FireDetail.tsx and tests.
- [x] Add failing tests enabling/removing fallback, cancellation, both-map application, grouped choices, primary-precedence timeline and warning.
- [x] Extract existing grouped dataset select for reuse, retaining style and accessible names.
- [x] Add hidden-by-default secondary field via Complementar histórico anterior; Remover clears it. Explain no earlier coverage without blocking arbitrary pairs.
- [x] Show actual resolved dates and proportions of shared eligible months using muted secondary and brand primary segments with visible textual percentages. Include approximation and cross-boundary tooltip.
- [x] Wire map through shared drawer and FireDetail state, synchronization, dirty detection and explicit save. Keep primary overrides and fallback maps in each drawer Apply callback.
- [x] Run drawer and both-view integration tests plus serializer API persistence test.

## Task 3: Results disclosure and primary-only comparison
Files: fireStudioScenario.ts, FireSimulationStudio.tsx, FireResultsPanel.tsx and tests.
- [x] Test snapshot comparison preserves original inputs, removes only fallback metadata, and never saves preferences.
- [x] Add pure withoutHistoricalFallbacks(snapshot) helper. Show Histórico complementado badge when submitted portfolio actually uses fallback months. Expose Comparar sem complemento / Voltar ao histórico complementado on submitted results; primary-only comparison runs through existing worker and uses a separate frozen snapshot.
- [x] Reset comparison on Recalcular; never let comparison edit sidebar or persistence state.
- [x] Run targeted component suite, exact financial regressions, backend isolated tests, TypeScript, focused lint, production build. Check fallback performance with deterministic representative fixtures.
- [x] Fresh read-only reviewer checks full feature diff; fix correctness findings with regression tests. No new commit.

## Validation and review outcome
- 70 distinct frontend tests passed (68-test focused suite plus two phase regressions); standalone portfolio/bootstrap scripts passed.
- Eight isolated backend serializer/API tests passed, including save/removal persistence. No live data changed.
- TypeScript, focused ESLint, diff whitespace check, and Vite production build passed. Build reports existing large-chunk warning.
- Independent review found age-in-bonds accumulation history could use a complement hidden by retirement's narrower shared period. A failing studio regression reproduced it; disclosure now evaluates accumulation, mixed retirement, and conditional bond-only retirement separately. Added phase coverage tests.
- Deterministic 45-year, eight-source full-simulation benchmark: independent-month median baseline 655 ms, current 665 ms, complemented 631 ms; block-sampling baseline 551 ms, current 548 ms, complemented 555 ms (three measured runs each, after warmup). No-complement full output deep-equals prior optimized engine in both modes. Complemented outputs intentionally differ.
- Native browser visual inspection was unavailable because Computer Use permission is not granted. No visual QA claim.
- Primary-only result comparison is in the new simulation studio; both legacy and new views can configure/save complements through the shared drawer.
- Existing work pushed as 340776c. This feature remains uncommitted for review. Unrelated vwra-vs-vwra11.html untouched.

## Final integration validation
User explicitly authorized committing and pushing the accumulated work. The final UI removes the Legacy switch and obsolete controls, places the active badge beside the title, shares recalculation gating between the page header and sidebar, persists simulated patrimônio, and reports save success/failure via toasts. Results now use six focused cards in two rows of three; the actual-patrimony card contains its progress bar, and Meta FIRE shows the simulated surplus as concise text.

Final checks: 71 frontend tests and 14 isolated backend tests passed; standalone financial scripts, TypeScript and production build passed. Scoped lint has zero errors and nine pre-existing warnings in Indicators/PlanningHub. Vite reports its large-chunk warning. The unrelated vwra-vs-vwra11.html remains excluded.
