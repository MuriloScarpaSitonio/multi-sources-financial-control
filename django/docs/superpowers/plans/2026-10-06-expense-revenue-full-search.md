# Expense and Revenue Full-History Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search expense and revenue descriptions across the user's entire history through the approved search mode, retaining existing filters and edit/delete actions.

**Architecture:** Both existing list endpoints use native PostgreSQL word-prefix queries and matching functional GIN indexes. The existing combined page selects full-history mode with `view=search`; each resource uses its own URL filters and one flat, server-paginated request. Search-specific controls and mutation refreshes stay local or opt-in, preserving existing overview behavior.

**Tech Stack:** Python 3.13, Django 6.1, PostgreSQL, Django REST Framework, django-filter, React 18, TypeScript, Material UI, Material React Table, TanStack Query, pytest, Vitest.

**Spec:** [Expense and revenue full-history search design](../specs/2026-10-05-expense-revenue-full-search-design.md). The user explicitly requested this plan on 2026-10-06. This document authorizes neither implementation nor staging, commits, branch switches, database changes, or delivery. Review the plan and choose execution before implementation.

**Status:** corrected plan for review. On 2026-10-06, the user accepted invalidating the affected search cache after successful edits/deletions. Pagination follows the already-approved requirement to move from an invalid page to a valid preceding page with unchanged filters. The extra count-only request and prescribed custom callback/wrapper are withdrawn. Ordinary helper/interface and pagination wiring details stay within the design's permitted local/opt-in approach.

## Approved implementation boundary

Implement the accepted mutation and pagination behavior without reopening it as a separate design decision:

- **Invalid pages after mutations:** use the search table's pagination state and ordinary list requests to display a valid preceding page with unchanged filters. The withdrawn count-only lookup is not part of this plan. Keep existing error feedback for other failures.
**Accepted mutation refresh:** after a successful edit/deletion, invalidate the affected resource's search queries so the server supplies current rows/count. Preserve existing overview cache behavior, balance/report effects and failure feedback. This accepts cache invalidation; it does not prescribe a new callback, drawer wrapper or create-form path.
URL/tab restoration and overview preservation are already approved. Implement them within the permitted local/opt-in boundary, following existing navigation conventions and preserving other callers. File organization, names, types and opt-in table inputs are ordinary planning details; they do not require reopening design approval. The earlier classification of those details as further unapproved design decisions was incorrect.

## Global Constraints

- Use `view=search` on the existing page; `revenues=true` selects revenues. No new route, full-window modal, combined-resource table, or full-search endpoint.
- Toolbar entry clears both search namespaces, including description and dates. Switching tabs inside search retains each tab's filters.
- Use the approved `expense_search_*` and `revenue_search_*` URL parameters. Search refresh/direct links restore their represented filters.
- Start/end dates are independently optional and clearable. Omitted dates introduce no period or current-date cutoff. Leaving search restores overview period and filters.
- Description matching applies to overview and full-history search for both resources: AND-combined word prefixes, independent of order, case-insensitive with `config='simple'`.
- Split on whitespace and ignore terms with no alphanumeric character: `super !!!` behaves as `super`; `!!!` alone returns no results; missing/empty description adds no predicate.
- Use native `SearchQuery(Lexeme(term, prefix=True), config='simple')`. No custom raw-query escaping/builder, extra contains filter, regex, trigram, PGroonga, stored vector/token field, or coordinated search write path.
- Add `expenses_desc_search_gin` and `revenues_desc_search_gin`, each indexing `SearchVector('description', config='simple')`. Keep existing user/date indexes and constraints.
- Remove SQLite fallback, `USE_POSTGRES`, and obsolete SQLite-only backup code/command references. Preserve PostgreSQL connection variables, unrelated upload functionality, and user database files.
- Upgrade Django to supported 6.x. Task 1 selects `Django>=6.1.1,<6.2`; dependency changes are limited to that upgrade and compatibility requirements.
- Expense response metadata is read-only: `installments_id`, `installment_number`, `installments_qty`. Preserve the write-only `installments` field and existing business rules.
- Full search is flat and ungrouped, with one list request per selected resource/page and the backend count. Page size 100 is not a total-results limit. Do not partition by fixed/ordinary/installment type or force page 1.
- Full-search ordering uses the existing parameter: default `-created_at,-id`, and an ID tie-breaker for existing date/value sorts. Do not change endpoint defaults.
- Existing drawers, confirmations, installment warnings, fixed/future actions, balance effects, and mutation failure feedback remain. Successful search mutations refresh search results; invalidated last pages recover to a valid preceding page.
- New revenue category/tag filters, tag lookup/writes, tag deduplication, custom invalid-date UI/request blocking, global search-input/debounce fixes, and global overview cache rewrites are in the separate design. Do not implement them here.
- Preserve the existing `Limpar filtros` semantics: entity/date clearing does not also clear description. Do not change shared search boxes on other pages.
- Work in an isolated checkout established at execution through `superpowers:using-git-worktrees`. Preserve unrelated work. Commit checkpoints below run only if the user explicitly authorizes staging/commits; otherwise retain unstaged task changes and continue authorized work.

## Review Focus

- Operator-like punctuation, apostrophes and backslashes must remain data and must not cause SQL errors or change AND matching (Task 2).
- Another user's identical descriptions must not leak into results/counts (Task 2).
- Equal dates/values and more than 100 records of each supported type must remain reachable across pages (Tasks 2, 4, 5).
- Pending description updates must not overwrite browser navigation, another tab's filters, or the overview restored on exit (Tasks 3, 6).
- Filter-changing edits, installment/future deletions, and an emptied final page must refresh the correct search without overwriting results or altering overview caches (Tasks 4, 5).

---

## File structure and execution environment

Paths below are relative to the repository root, `/Users/murilo/github/multi-sources-financial-control`. Backend commands run in `django/`; frontend commands run in `react/`. Apply them to the execution checkout, not the shared dirty checkout.

| Unit | Files and responsibility |
| --- | --- |
| Platform | `django/pyproject.toml`, `django/uv.lock`, `django/requirements-dev.txt`, `django/requirements-production.txt`: supported Django runtime and matching dependency artifacts. `django/config/settings/base.py`, `django/Makefile`, `docker-compose.yml`: unconditional PostgreSQL. `django/config/scripts.py`: remove SQLite helper while retaining upload utility. Delete `django/variable_income_assets/management/commands/backup_dbs.py`, the SQLite-only wrapper. |
| Backend search | `django/expenses/filters.py`: native description predicate. `django/expenses/models/expenses.py`, `django/expenses/models/revenues.py`, `django/expenses/migrations/0022_description_search_gin.py`: matching indexes. `django/expenses/serializers.py`, `django/expenses/views.py`: read-only metadata and allowed ID ordering. |
| Search state | Create `react/src/pages/private/Expenses/fullHistorySearch.ts`, `useFullHistorySearch.ts`, `FullHistorySearchControls.tsx`: local URL protocol and controls. Extend the two resource `types.ts`/`filterConfig.ts` files. `react/src/hooks/useTable.ts`: opt-in state support only. The resource tables retain ownership of their search pagination. |
| Expense surface | Existing expense API/model, table, toolbar/filter menu, drawer/form and delete dialog: raw rows, optional bounds, existing actions and search-only refresh. Exact paths are in Task 4. |
| Revenue surface | Existing revenue API, table, toolbar/filter menu, drawer/form and delete dialog: equivalent search with current bank-account filter. Exact paths are in Task 5. |
| Page integration | `react/src/pages/private/Expenses/index.tsx`: entry/exit, selected tab, overview preservation, and visibility of existing sections. |

Use a disposable PostgreSQL service, separate from the user's existing databases. The repository testing compose uses PostgreSQL 16; use that version on a separate local port:

```sh
docker run --rm --detach --name mfc-fullsearch-postgres --env POSTGRES_DB=fullsearch --env POSTGRES_USER=postgres --env POSTGRES_PASSWORD=postgres --publish 127.0.0.1:55437:5432 postgres:16
docker exec mfc-fullsearch-postgres pg_isready -U postgres -d fullsearch
export POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=55437 POSTGRES_DB=fullsearch POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres
```

If that name/port is occupied, use another disposable name/free port and update the exports; do not stop an unrelated service. pytest creates `test_fullsearch` inside this disposable service. All pytest commands below use `--basetemp=/private/tmp/mfc-fullsearch-pytest` to avoid the repository's shared default temporary directory. Stop only this container after final verification.

### Task 1: Supported Django and PostgreSQL-only runtime

**Files:** Modify the platform files listed above; delete the SQLite-only command. Create/test `django/config/tests/test_postgres_configuration.py`.

**Interfaces:** Produces PostgreSQL settings using the existing `POSTGRES_*` variables, without `USE_POSTGRES`, and native `Lexeme` imports on Python 3.13. Retains `config.scripts.send_to_gdrive(backup_names, folder_id)` unchanged. No replacement backup feature is added.

- [ ] **1. Record the existing backend baseline on the disposable service.** Run `USE_POSTGRES=1 uv run pytest --basetemp=/private/tmp/mfc-fullsearch-pytest --create-db -q`. Record pre-existing failures; do not repair unrelated failures as part of search.
- [ ] **2. Write `test_postgresql_is_unconditional` and `test_native_lexeme_available`.** Assert `settings.DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql'`, `not hasattr(settings, 'USE_POSTGRES')`, and that importing/constructing `Lexeme('super', prefix=True)` succeeds. These tests do not need database access.
- [ ] **3. Run the new tests before changes.** `USE_POSTGRES=1 uv run pytest config/tests/test_postgres_configuration.py --basetemp=/private/tmp/mfc-fullsearch-pytest -q`. Expected FAIL: the selector still exists and Django 5.2 lacks native Lexeme.
- [ ] **4. Update the runtime and remove SQLite support.** Set `Django>=6.1.1,<6.2`, run `uv lock --upgrade-package django` and `uv sync`, and resolve only compatibility failures tied to the upgrade. Configure PostgreSQL unconditionally; remove selector usages in Makefile/compose and the SQLite helper/wrapper. Keep user database files and the upload utility. [Django's download page](https://www.djangoproject.com/download/) lists 6.1.1 as the current stable release at plan-writing time; the range admits subsequent 6.1 patches.
- [ ] **5. Regenerate existing exports using their current conventions.** Run `uv export --format requirements-txt --no-group=production --no-hashes --output-file requirements-dev.txt` and `uv export --format requirements-txt --no-dev --all-groups --no-hashes --output-file requirements-production.txt`.
- [ ] **6. Verify the prerequisite without the old flag.** Unset `USE_POSTGRES`; run the new tests, `uv run python manage.py check`, `uv run python manage.py makemigrations --check --dry-run`, and the baseline backend suite again on the disposable service. Expected: new tests/checks pass, no unrelated migration drift, and no new compatibility failures. Record any required compatibility dependency adjustment in this task's review.
- [ ] **7. Review the task diff; if commits are authorized, stage only this task's files and commit** `build: upgrade Django and remove SQLite support`.

### Task 2: Native prefix search, indexes and response contract

**Files:** Modify `django/expenses/filters.py`, `models/expenses.py`, `models/revenues.py`, `serializers.py`, `views.py`, `tests/e2e/test__expenses__views.py`. Create `django/expenses/migrations/0022_description_search_gin.py` and `django/expenses/tests/e2e/test__description_search.py`.

**Interfaces:** `_PersonalFinanceFilterSet.filter_description(self, queryset: QuerySet, name: str, value: str) -> QuerySet` serves both resource filtersets. Produces the existing list response plus the three nullable, read-only expense metadata fields; `ordering_fields` permits `created_at`, `value`, `id`. The endpoint defaults, date filters, entity filters and tag joins retain their behavior.

- [ ] **1. Write parameterized endpoint tests for expenses and revenues.** Reuse authenticated fixtures/factories. The owned cases are `a: Compra no supermercado` dated `2020-01-15`, `b: Supermercado !!!` dated `2030-02-01`, and `c: Compra em mercado` dated `2026-10-01`; use the existing resource fixture as `a`, rather than leaving an extra original row. Add another user's identical `a` with their own bank account. Assert status 200, these IDs, and matching counts:

```python
# query -> expected owned labels
cases = [('super', {'a', 'b'}), ('super comp', {'a'}),
         ('comp super', {'a'}), ('SUPER COMP', {'a'}),
         ('mercado', {'c'}), ('super wrong', set()),
         ('super !!!', {'a', 'b'}), ('!!!', set()),
         ('', {'a', 'b', 'c'})]
# GET /api/v1/{resource}?description=query&page_size=100
assert {row['id'] for row in response.json()['results']} == expected_ids
assert response.json()['count'] == len(expected_ids)
```

  Add `test_operator_like_input_is_data`: `super | wrong` returns none; `super ! comp` returns `a`; apostrophe/backslash-bearing input returns 200 and never another user's IDs. Missing description returns all owned cases. `test_description_with_existing_filters` combines an existing date/category/source/tag/bank-account filter with the description predicate without changing that filter's semantics; revenue uses its current bank-account/date filters only.
- [ ] **2. Write contract and pagination regressions.** `test_installment_metadata_is_read_only` checks ordinary/fixed nulls, actual installment UUID/number/count, and that update attempts cannot change them; update the existing exact response-schema assertion. `test_all_kinds_are_paginated` creates 101 ordinary/fixed/installment expenses or 101 ordinary/fixed revenues under a common description prefix, then follows every page with `page_size=100`. Assert totals 303/202, all owned IDs reachable, page 2 honored, and equal-date rows ordered by `-created_at,-id`. `test_value_order_with_id_ties` verifies `value,-id` on equal-value rows. Update the existing expense `description=pense` expectation from 12 to 0, since inside-word matching is explicitly replaced.
- [ ] **3. Run the focused tests to establish failures.** `uv run pytest expenses/tests/e2e/test__description_search.py expenses/tests/e2e/test__expenses__views.py --basetemp=/private/tmp/mfc-fullsearch-pytest -q`. Expected FAIL for prefix composition, metadata and ID ordering before implementation.
- [ ] **4. Implement the existing filter method with native Django objects.** Declare `description = django_filters.CharFilter(method='filter_description')` on `_PersonalFinanceFilterSet`. For retained terms, AND native `SearchQuery(Lexeme(term, prefix=True), config='simple')` objects and match an alias named `description_search` using `SearchVector('description', config='simple')`. Nonempty input without retained terms returns `queryset.none()`. Do not introduce a standalone prefix builder, raw escaping, extra matching mechanism, or tag deduplication. [Django documents native Lexeme composition and functional GIN indexes](https://docs.djangoproject.com/en/6.0/ref/contrib/postgres/search/).
- [ ] **5. Add the approved indexes and API fields.** Add the two exact functional GIN definitions from the spec, retain user/date indexes and constraints, and correct comments claiming the date filter cannot be removed. Generate `uv run python manage.py makemigrations expenses --name description_search_gin`; current latest migration is 0021, so expected output is 0022 with only two `AddIndex` operations. If numbering changed, use the next migration rather than overwriting another migration. Add the three serializer fields as read-only, retaining existing create/update behavior, and permit ID ordering without changing `get_queryset()` defaults.
- [ ] **6. Verify behavior, migration and index applicability.** Run the focused tests plus `test__revenues__views.py`, `test__expenses__is_fixed.py`, `test__revenues__is_fixed.py`, and `test__bank_account__views.py`; expected PASS apart from recorded unrelated baseline failures. Run `uv run python manage.py sqlmigrate expenses 0022` (using the generated migration number) and inspect the two `USING gin` expressions against the query expression/configuration. Add `test_description_indexes_match_query_expression` to the new test module: while its PostgreSQL fixture is active, assert both names exist in `pg_indexes` with GIN and the `simple` vector expression. Capture the native predicate's actual count and first-page SQL and normal `EXPLAIN (ANALYZE, BUFFERS)` there, recording fixture size/selectivity; run that test with `uv run pytest expenses/tests/e2e/test__description_search.py::test_description_indexes_match_query_expression --basetemp=/private/tmp/mfc-fullsearch-pytest -s`. Check expression/index applicability separately if the small dataset chooses a sequential scan. Do not claim a speedup from a forced plan or measure rejected strategies.
- [ ] **7. Review the task diff; if commits are authorized, stage only this task's files and commit** `feat: add native description prefix search`.

### Task 3: Search-only URL state and opt-in table controls

**Files:** Create the three shared search files from the file map. Modify `react/src/pages/private/Expenses/types.ts`, `filterConfig.ts`, `react/src/pages/private/Revenues/types.ts`, `filterConfig.ts`, and `react/src/hooks/useTable.ts`. Create/test `react/src/pages/private/Expenses/useFullHistorySearch.test.tsx`, `FullHistorySearchControls.test.tsx`, and `react/src/hooks/useTable.test.tsx`.

**Interfaces:** Define/export the following in `fullHistorySearch.ts`; resource `types.ts` exports `SearchFilters = Filters & SearchFields`:

```ts
type SearchFields = { description?: string; startDate?: string; endDate?: string };
type BoundFilters<T> = { filters: T; setFilters: Dispatch<SetStateAction<T>> };
type FullHistoryTableProps<T> =
  | { mode?: 'overview'; externalFilters: BoundFilters<T>; initialSearch?: string;
      onOpenSearch?: (overviewDescription: string) => void }
  | { mode: 'search'; externalFilters: BoundFilters<T & SearchFields>;
      onBackToOverview: () => void };
type SearchDateControls = { startDate: Date | null; endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void };
getFullHistoryOrdering(sorting: MRT_SortingState): string;
getSearchDateControls<T>(filters: T & SearchFields,
  setFilters: Dispatch<SetStateAction<T & SearchFields>>): SearchDateControls;
```

`useFullHistorySearch()` returns `{ isSearchMode: boolean, expenses: BoundFilters<ExpenseSearchFilters>, revenues: BoundFilters<RevenueSearchFilters>, openSearch(): void, backToOverview(): void }`. `FullHistorySearchBar({search: string, setSearch: Dispatch<SetStateAction<string>>})` and generic `FullHistoryFilterIndicators({filters, setFilters, fieldConfigs})` live in `FullHistorySearchControls.tsx`. No recovery interface is selected.

- [ ] **1. Write URL/control/table tests before implementation.** In a `MemoryRouter`, retain overview dates/category and `revenues=true` while entry clears both search scopes. Assert independent expense/revenue descriptions and dates survive tab changes, refresh and browser navigation; exit removes `view` while leaving overview parameters. Clear either date to undefined, keeping the other. Use fake timers to pin the existing 600ms typing delay and verify navigation/unmount cancels only this new input's pending update. `FullHistoryFilterIndicators` clearing entity/date filters keeps description. `useTable` tests must verify controlled search, filter-reset page 0 before the new request, and unchanged non-opting callers.
- [ ] **2. Test error reporting needed by search pagination.** In `useTable.test.tsx`, return a pagination error from the mocked query and assert the hook exposes that error while preserving existing error feedback and non-opting callers' pagination behavior. Resource-level invalid-page behavior is tested in Tasks 4 and 5.
- [ ] **3. Run the URL/control/table tests.** `yarn vitest run src/pages/private/Expenses/useFullHistorySearch.test.tsx src/pages/private/Expenses/FullHistorySearchControls.test.tsx src/hooks/useTable.test.tsx`. Expected FAIL because the new modules/opt-in interfaces do not exist.
- [ ] **4. Implement the local URL protocol and controls.** Extend each resource's existing schema with string `description`, `startDate`, `endDate`; reuse existing filter labels/presentation, without a new description chip. Use `useSearchParams` and existing `serializeFilters`, `deserializeFilters`, `buildURLSearchParams`, `clearScopedParams` for the new scopes; overview `useURLFilters` remains untouched. Derive filters from the URL. Toolbar entry clears both scopes and sets `view=search`; filter edits preserve unrelated parameters and follow existing navigation conventions. Use existing date formatting/parsing for selection/display; add no custom invalid-URL gate. Keep description outside the entity/date chip reset. Default ordering is `-created_at,-id`; a selected date/value sort uses its existing direction followed by `-id`.
- [ ] **5. Add narrowly opt-in support to `useTable`.** Interfaces: `initialSearch?: string` (default empty), `externalSearch?: {value: string; setValue: Dispatch<SetStateAction<string>>}`, and `paginationResetKey?: string`; expose `queryError: unknown` from the existing query result. Extract input options before forwarding props to MRT. Only an opted-in filter-key change resets pagination; compute the effective page 0 before building the query key/request so no stale-page request is issued. Other callers retain current state/query behavior. The resource tables use the exposed error and their existing pagination state for search-only invalid-page handling.
- [ ] **6. Run the focused tests and `yarn build`.** Expected PASS, with default shared-hook behavior preserved. Review that shared `pages/private/components.tsx`, `FilterIndicators`, `useURLFilters`, and `FormDrawer` were not changed.
- [ ] **7. Review the task diff; if commits are authorized, stage only this task's files and commit** `feat: add scoped full-history search controls`.

### Task 4: Flat expense search with existing actions

**Files:** Modify `react/src/pages/private/Expenses/api/models.ts`, `api/expenses/index.ts`, `Table/index.tsx`, `Table/ToopToolBar/index.tsx`, `Table/ToopToolBar/FiltersMenu.tsx`, `Table/ExpenseDrawer/index.tsx`, `Table/ExpenseDrawer/ExpenseForm.tsx`, `Table/DeleteExpenseDialog.tsx`. Create/test `react/src/pages/private/Expenses/Table/fullHistorySearch.test.tsx` and `react/src/pages/private/Expenses/api/expenses/index.test.ts`.

**Interfaces:** Expense `Table` accepts `FullHistoryTableProps<Filters>`. Export `ExpenseListParams` from the API module, retaining current fields and adding typed `bank_account_description`; allow `startDate?: Date | string`, `endDate?: Date | string` for legacy dates/scoped URL strings. `getExpenses(params: ExpenseListParams = {}): Promise<ApiListResponse<Expense>>` keeps the same endpoint. Add nullable response fields to `Expense`; omit them from `ExpenseWrite`/form initial-data spread. Toolbar accepts navigation props plus optional `SearchDateControls`; FiltersMenu accepts optional `searchDateControls`. Mutation success invalidates expense search queries; retain existing drawer/form interfaces where possible.

- [ ] **1. Write API and table regressions.** Capture actual serialized date/filter parameters: missing bounds are absent from the HTTP query; either raw URL string or a legacy Date retains its existing date format. Render search with count 303 and page 2: assert one `getExpenses` call, page 2 honored, no `is_fixed`/`with_installments`, no synthetic type column/grouping/expansion, and the backend count. Dates/category/source/tag/bank account/description come only from search filters; overview context dates must not enter that request. Preserve repeated selector values rather than deduplicating returned rows.
- [ ] **2. Write existing-action and cache-invalidation tests.** Use the real drawer/form/dialog with mocked APIs. Ordinary rows show no installment warning; installment rows use UUID metadata for the existing warning; fixed rows retain the future-action toggle. Failed mutations retain existing error behavior and do not remove rows. Successful edit/deletion invalidates the expense search queries: editing `rent` to `food` removes the row from a `rent` search, and installment-group deletion updates rows/count. Existing balance/report effects and overview cache behavior remain intact. In `invalid_page_after_delete_keeps_search_filters`, remove the only result from the final page and assert the table displays a valid preceding page with the same description/entity/date filters and page size. Also verify empty results remain usable, other API failures retain feedback, and an old request cannot move a newer search. No count-only lookup is issued.
- [ ] **3. Run the new tests.** `yarn vitest run src/pages/private/Expenses/Table/fullHistorySearch.test.tsx src/pages/private/Expenses/api/expenses/index.test.ts`. Expected FAIL for missing mode/metadata and current partitioned queries.
- [ ] **4. Implement the expense mode branch.** Keep the existing grouped overview request/render branch. Search uses one direct `getExpenses` request, Task 3 controlled description/reset key/ordering, raw URL bounds, and current entity filters. Query page/page-size are actual table state; default page size remains 100. Search columns omit `type`; grouping/expansion are disabled. Wire optional dates to the existing menu without modifying overview month state. Use the local search controls and approved toolbar entry/back actions. Retain the current overview description for restoration on exit. Date strings remain strings when sent for existing backend validation; do not add a new date-error UI or request blocker. Distinguish expense search query keys so invalidation targets that search within the approved local/opt-in boundary.
- [ ] **5. Preserve existing actions and invalidate search queries on success.** Derive installment warnings from `installments_id`, not synthetic group labels. The delete dialog accepts plain `Expense` and retains its existing confirmation/action API. Reuse the existing edit drawer, business rules and feedback. In search mode, successful edit/deletion invalidates expense search queries; use refetched server rows/count and preserve the overview's current cache path. If the current page becomes invalid, use the table's pagination state and ordinary list requests to display a valid preceding page with unchanged filters. Keep this handling local to search. Do not add the withdrawn callback/wrapper, create-form path or count-only request.
- [ ] **6. Run these tests and `yarn build`.** Expected PASS for the specified behavior, including preserved overview actions, plain-row installment warnings and valid pagination after mutations.
- [ ] **7. Review the task diff; if commits are authorized, stage only this task's files and commit** `feat: add full-history expense search table`.

### Task 5: Equivalent flat revenue search

**Files:** Modify `react/src/pages/private/Revenues/api.ts`, `Table/index.tsx`, `Table/ToopToolBar/index.tsx`, `Table/ToopToolBar/FiltersMenu.tsx`, `Table/RevenueDrawer/index.tsx`, `Table/RevenueDrawer/RevenueForm.tsx`, `Table/DeleteRevenueDialog.tsx`. Create/test `react/src/pages/private/Revenues/Table/fullHistorySearch.test.tsx` and `react/src/pages/private/Revenues/api.test.ts`.

**Interfaces:** Revenue `Table` accepts `FullHistoryTableProps<Filters>`. Export `RevenueListParams` with existing fields, typed `bank_account_description`, and the same `Date | string` bounds as Task 4. `getRevenues(params: RevenueListParams = {}): Promise<ApiListResponse<Revenue>>` keeps its endpoint. Toolbar/menu consume Task 3 controls. The delete dialog accepts plain `Revenue`. Mutation success invalidates revenue search queries, as for expenses.

- [ ] **1. Write revenue-specific API/table/action regressions.** Assert one search request for count 202, working page 2, no fixed/ordinary partition or forced page 1, raw rows with grouping/expansion disabled, optional independent bounds and the current bank-account filter. Test native description/query ordering integration, filter reset and backend count. Preserve ordinary/fixed confirmations, balance effects and failure feedback. Successful edits/future deletions invalidate revenue search queries and update server rows/count while preserving overview cache behavior. Exercise Task 4's invalid-page and stale-request cases for revenues, retaining description/bank-account/date filters and page size, without a count-only lookup. Assert there are no new category/tag filter controls or tag lookup request.
- [ ] **2. Run the new tests.** `yarn vitest run src/pages/private/Revenues/Table/fullHistorySearch.test.tsx src/pages/private/Revenues/api.test.ts`. Expected FAIL for current grouped forced-page-1 requests and absent mode support.
- [ ] **3. Implement the revenue search branch using Task 3's interfaces.** Preserve the existing grouped overview path. Search calls `getRevenues` once with current pagination, optional raw bounds, description, bank account and approved ordering. Wire local controls and approved entry/back actions; preserve overview description on exit. Reuse the existing edit drawer and delete confirmation. Distinguish revenue search query keys and invalidate them after successful edit/deletion, as for expenses. Apply the same search-only pagination behavior as Task 4. Add no new revenue category/tag behavior, tag persistence or recurring-tag rule.
- [ ] **4. Run the new tests and `yarn build`.** Expected PASS, with original overview handlers retained and valid pagination after mutations.
- [ ] **5. Review the task diff; if commits are authorized, stage only this task's files and commit** `feat: add full-history revenue search table`.

### Task 6: Combined page integration and final verification

**Files:** Modify `react/src/pages/private/Expenses/index.tsx`. Create/test `react/src/pages/private/Expenses/fullHistorySearchPage.test.tsx`.

**Interfaces:** Consumes Task 3's `useFullHistorySearch` and resource table prop contracts. Keep existing overview URL hooks/context, and preserve overview period, entity filters and description across search entry/exit. Local state storage and table lifecycle are implementation details within that approved behavior; no additional design-approval gate applies to them.

- [ ] **1. Write page integration tests.** Entry from each overview selects its own resource, clears both search namespaces, retains overview dates/entity filters, and hides PeriodsManager/Indicators/Reports while keeping the resource tabs/table. Typing `super` in expenses, then `sal` in revenues, then returning to expenses restores `super`; direct links/refresh/browser history do likewise. Back restores overview period, filters and the captured description. Search date changes must not mutate overview context dates/month. On a filter change from page 2, only the new page-1 request is issued. Use real state hooks/tables with mocked API responses; isolate geometry-heavy MRT rendering while checking the actual table options and row-action components.
- [ ] **2. Run the new test.** `yarn vitest run src/pages/private/Expenses/fullHistorySearchPage.test.tsx`. Expected FAIL before page wiring.
- [ ] **3. Integrate the existing page.** Keep React hooks unconditional. Branch the visible overview sections on `isSearchMode`; pass the selected resource its own URL search filters/navigation props or its existing overview filters plus entry callback. Preserve the existing `revenues=true` selection rather than forcing expenses. Keep related-entity context/hooks available to the existing columns and forms. Do not introduce a new route/modal or change shared overview filtering.
- [ ] **4. Run final focused and compatibility checks once.** Backend: `uv run pytest --basetemp=/private/tmp/mfc-fullsearch-pytest --create-db -q`, `uv run python manage.py check`, `uv run python manage.py makemigrations --check --dry-run`, and `uv run ruff check` on changed Python files. Frontend: run all new test files in one `yarn vitest run` invocation, then `yarn build`; run the existing Vitest suite once for the opt-in shared-hook change. Expected: new tests/checks pass and no new failures compared with the recorded baseline. Do not repair unrelated user changes to make a broad check green.
- [ ] **5. Perform focused visual verification.** Open both resources' search from their toolbar, confirm empty/clearable bounds and all-history results, paginate beyond 100, switch tabs, refresh/back, and exercise both existing edit drawers/delete confirmations with installment/fixed examples. Verify overview restoration and the existing clear-filters semantics. Record visual verification separately from unit/API tests; do not claim it if not performed.
- [ ] **6. Review the spec against the final diff and stop only the disposable PostgreSQL container.** Confirm exactly two GIN indexes, no stored search field/write coordination, no additional endpoint, and none of the separate-design fixes/enhancements. Record native-query plan/performance evidence without unsupported production claims.
- [ ] **7. Review the task diff; if commits are authorized, stage only this task's files and commit** `feat: integrate full-history expense and revenue search`.

## Execution handoff

The corrected plan retains the approved requirements and removes the withdrawn mechanisms. Review the plan and select execution before implementation. Do not reopen ordinary pagination/helper wiring as additional product-design decisions. No execution method is selected.

- **Native — recommended:** implement tasks in this session, followed by one fresh whole-branch reviewer. These six tasks share URL, table and mutation interfaces, so keeping implementation context together avoids repeated setup and costs fewer contexts.
- **Subagent-driven:** a fresh implementer and fresh reviewer for each task, followed by a whole-branch review. This provides earlier independent review at greater context cost.

The older `2026-10-05-expense-search.md` plan is superseded and must not be executed. The separate enhancement design remains deferred. No product code, dependency artifact, migration or application database was changed while writing this plan.
