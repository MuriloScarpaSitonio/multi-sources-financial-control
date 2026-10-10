# Expense/revenue full-history search execution record

Worktree: `/private/tmp/mfc-full-search`
Branch: `feat/expense-revenue-full-search`
Base: `1f3d7f7898809658deea080b0d67ac526be4c2d6`
The user authorized committing, pushing and opening a PR on 2026-10-07. Delivery uses the isolated branch; the original checkout is preserved. The implementation record below describes the earlier execution phase before that authorization.

## Implemented

Existing combined page gains toolbar entry into `view=search`, independent URL-backed expense/revenue filters, empty optional dates, flat paginated rows, native description prefix search and existing editing/deletion. PostgreSQL is unconditional; Django/compatible DRF dependencies updated. Two functional GIN indexes and three nullable read-only installment fields; no stored search field, new endpoint or deferred enhancement.

## Validation

- New frontend tests: 43 passing across eight files; production build passes.
- Backend search/resource/fixed/bank tests: 279 passing, two skipped.
- Django system check, migration consistency, changed-file Ruff and diff whitespace checks pass.
- Full backend: 981 passed, 10 skipped, four failures. Three pre-existing backfill tests hardcode user ID 1. An unchanged randomized dummy-data test also failed and passed its focused rerun; it remains recorded as intermittent, not repaired.
- Full frontend: 293 passed, one timeout; same eight failed files as baseline (seven node:test-only files and fireSimulation timeout). Details below.
- Synthetic local PostgreSQL plans: both GIN indexes chosen naturally for count/page queries on 2503 owned rows/resource with two matches, execution 0.157–0.203 ms. This establishes local query/index applicability, not a production speedup.
- Browser verification unperformed: Computer Use approval rejected opening Chrome. No visual or production claims.

Backend failures:

- `variable_income_assets/tests/management_commands/test__generate_dummy_data.py::TestGenerateDummyDataCommand::test__should_create_closed_operations` (focused rerun passes).
- `variable_income_assets/tests/test_scripts.py::test_fixed_income_facts_backfill_is_dry_run_by_default_and_updates_read_model`
- `variable_income_assets/tests/test_scripts.py::test_fixed_income_event_backfill_is_dry_run_by_default_and_idempotent`
- `variable_income_assets/tests/test_scripts.py::test_fixed_income_event_backfill_recognizes_existing_maturity_with_different_price`

Frontend failures:

- `src/pages/private/Incomes/incomeTypeOptions.test.ts [ src/pages/private/Incomes/incomeTypeOptions.test.ts ]`
- `src/pages/private/Home/fireBootstrap.test.ts [ src/pages/private/Home/fireBootstrap.test.ts ]`
- `src/pages/private/Home/firePortfolio.test.ts [ src/pages/private/Home/firePortfolio.test.ts ]`
- `src/pages/private/Home/fireResultPresentation.test.ts [ src/pages/private/Home/fireResultPresentation.test.ts ]`
- `src/pages/private/Home/vpwMath.test.ts [ src/pages/private/Home/vpwMath.test.ts ]`
- `src/pages/private/Home/vpwSimulation.test.ts [ src/pages/private/Home/vpwSimulation.test.ts ]`
- `src/pages/private/Assets/ImportB3/logic.test.ts [ src/pages/private/Assets/ImportB3/logic.test.ts ]`
- `src/pages/private/Home/fireSimulation.test.ts > keeps zero extension identical to the existing calculation`

## Rulings I made

- Ruling: No staging or commits during implementation — the plan explicitly conditions those on separate authorization, which has not been supplied — cost if wrong: changes remain reviewable as an unstaged diff rather than task commits. Preserve ledger after review until changes have a durable authorized record.
- Ruling: Existing unrelated branch is the execution base; create the plan-required isolated worktree without switching the original checkout — preserves the user's work and follows authorized execution setup — cost if wrong: delivery needs rebasing onto the user's preferred base.
- Ruling: Use Corepack for Yarn 4 and the worktree venv Python for pytest where sandboxed uv cache access fails — same locked environments, no global tooling changes — cost if wrong: commands need the worktree environment paths.
- Task 1: Ruling: Raise DRF minimum to tested 3.18.3 — locked 3.16.0 imports cc_delim_re removed in Django 6.1, preventing URL/API checks — cost if wrong: DRF compatibility changes beyond this removed import; verify the whole existing API suite. Django resolves to 6.1.2 within the planned range.
- Ruling: Bootstrap the owned base database using migrate --skip-checks before standalone Django checks — existing URL imports query ConversionRate before an empty database has schema — cost if wrong: checks depend on the disposable base schema; no application code or user database changes.
- Task 1: Ruling: Exclude only the generated single-user default-account validator — DRF 3.18 rejects default transfers before existing transactional view logic can run; retain description/user validation and database constraints — cost if wrong: another single-user serializer uniqueness rule would require explicit handling. The two existing transfer tests supplied RED evidence.
- Task 2: Ruling: Add django.contrib.postgres to installed apps — Django 6.1 GinIndex system checks explicitly require it — cost if wrong: native PostgreSQL app startup overhead; no added extension or search mechanism.
- Task 2: Ruling: Read mutation metadata from the persisted row or created installment group; return nulls for ordinary/fixed creations and preserve existing DTO response IDs — creation returns a domain object with no persisted ID, whereas read-only fields belong to stored expenses — cost if wrong: one metadata SELECT for installment creations/updates; existing API mutation tests verify compatibility.
- Task 2: Ruling: Compare the two unchanged past expense IDs as a set in the existing fixed-tag test — adding GIN changes the plan/order of an unordered SQL query, while record identities and business effects remain unchanged — cost if wrong: this assertion no longer checks an unspecified physical row order; count and identity assertions remain.
- Task 4: Ruling: Existing ExpensesContext supplies a search-mode flag to existing edit forms — permits direct resource search invalidation without the withdrawn mutation callback/drawer wrapper; overview success path stays intact — cost if wrong: an incorrectly supplied mode flag selects the wrong cache path.
- Task 4: Ruling: Search-only queries override staleTime/refetchOnMount and disable automatic retries — App's infinite cache otherwise keeps inactive search results stale, and repeated invalid-page retries delay ordinary pagination correction — cost if wrong: transient search failures require another interaction or revisit to retry; overview query defaults stay unchanged.
- Task 4: Ruling: Render a resource error alert inside the search toolbar — custom toolbar replaces MRT's default alert, so its existing error-state flag alone has no visible feedback (regression failed) — cost if wrong: generic wording obscures the server's specific cause; no new date-specific validation flow.
- Final: Ruling: Review the unstaged diff and untracked implementation files alongside BASE — no commits were authorized, so the normal BASE..HEAD package is empty — cost if wrong: reviewer coverage depends on the explicit file manifest; preserve all review artifacts.
- Final: Ruling: Expense tag deduplication and custom URL date validation remain deferred — explicitly approved scope boundary — cost if wrong: existing behavior remains until that separate work.
- Final: Ruling: Revenue category/tag controls, editing and recurring propagation remain separate — approved core search deliberately reuses existing revenue filters — cost if wrong: those enhancement capabilities are absent from this feature.
- Final: Ruling: Shared input/debounce and overview cache paths remain excluded — user explicitly moved them to the other design — cost if wrong: existing shared behavior persists.
- Final: Ruling: Retain unrelated suite failures in the report without repairing them — approved plan forbids unrelated changes — cost if wrong: broad-suite confidence remains limited by those failures.
- Final: Ruling: Browser fidelity is unverified — Chrome permission was rejected and in-app browser is unavailable — cost if wrong: visual/UI defects can remain despite component/API tests.
- Final: Ruling: Run existing node:test files with their tsx/Node runner and Vitest files with one worker in the post-fix verification — Vitest does not register Node suites and parallel CPU contention triggers the known simulation timeout — cost if wrong: the default unqualified Vitest command still has its pre-existing runner failures; no test/config code was changed to hide failures.

## Review

One fresh independent reviewer found one Important mutation/read race and no Critical/Minor findings. It was fixed in the single authorized fix pass by cancelling affected resource search reads before invalidation. Four real table/form/dialog tests failed before the fix and pass after it. No second review was dispatched.

Post-fix build passes; all 43 feature tests pass. Correctly separating the seven Node test files from Vitest and reducing Vitest to one worker produces 297 passing Vitest tests and one unrelated `FireScenarioPanel > keeps typed values editable while enforcing limits and supporting resets` failure; that unchanged test passes its focused rerun. All seven Node files pass using `node --import tsx --test`. Broad-suite verification remains limited by the recorded intermittent failures; it is not claimed fully green.

Owned backend process and disposable PostgreSQL container are stopped. Worktree/ledger are preserved. No deferred minor findings.
 Detailed logs and red/green evidence remain in `/private/tmp/mfc-full-search/.superpowers/sdd/2026-10-06-expense-revenue-full-search`.

## Pull request delivery

The original base branch was squash-merged as PR #55. The search commit is rebased onto current `master` (`99e4fb2`), whose source tree exactly matches the original execution base. This removes already-merged planning commits from the PR without changing the reviewed search implementation.

Fresh pre-PR verification: 43 frontend feature tests pass, production build passes, and focused PostgreSQL search/API/configuration/compatibility tests pass (281 passed, two skipped). No broad-suite or browser claims are added.
