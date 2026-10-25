# Expense and revenue full-history search design

**Status:** consolidates the individually accepted search requirements. The user explicitly requested implementation planning on 2026-10-06. The [current implementation plan](../plans/2026-10-06-expense-revenue-full-search.md) has been corrected to retain approved behavior and remove withdrawn mechanisms. Plan review and execution-method selection remain pending. No product implementation is authorized by these documents' creation.

**Purpose:** let the user find, edit, and delete their expenses or revenues across all stored dates, without having to remove or work around the overview's mandatory period filters.

## 1. Scope

Search is a mode on the existing Expenses/Revenues page, selected by `view=search`. The existing selected tab determines the resource: expenses by default, revenues when `revenues=true`. Search does not force the expense tab or combine expenses and revenues into one result set.

The main task is full-text search on expense and revenue descriptions and the already-approved full-history view. Preserve existing entity-filter behavior. New revenue filter controls and unrelated filter/input/cache fixes belong to the separate design and do not block this work.

Both resources have empty initial search filters, independently optional dates, description word-prefix matching, a flat table, server pagination, and their existing edit/delete actions. Each tab retains its own search filters while switching within search mode.

The previously proposed full-window modal and new route were superseded. The existing overview remains available with its current period, filters, reports, indicators, and grouping.

| Capability | Expenses | Revenues |
| --- | --- | --- |
| Description prefix search | Yes | Yes |
| Independently optional start/end dates | Yes | Yes |
| Category filter | Existing filter | Separate enhancement |
| Source filter | Existing filter | No source field/filter was selected for revenues |
| Tag filter | Existing filter | Moved to the separate design |
| Bank-account filter | Existing filter | Existing filter |
| Flat server-paginated results | Ordinary, fixed, and installment expenses together | Ordinary and fixed revenues together |
| Existing editing drawer and deletion confirmation | Yes | Yes |

Revenue category/tag filter enhancements were individually accepted earlier. The user moved the revenue tag dropdown to [the additional-changes design](2026-10-05-revenue-filter-and-tag-enhancements-design.md), then required focus on full-text search. Both new revenue filter enhancements now belong to that separate workstream, retaining their earlier individual approvals. Their API/UI implementation, revenue tag assignment/editing, and recurring tag propagation are outside the main task.

## 2. Opening, navigating, and leaving search

Each table toolbar offers an action to search all expenses or all revenues. It opens `view=search` for the selected tab. Entry through that action starts with all search filters empty, including description and both date bounds; overview filters are not copied into search. Clearing both expense and revenue search namespaces on this entry was already approved. Switching tabs within the search session retains each tab's filters.

Search mode shows the selected resource's table and filter controls, with the Expenses/Revenues tab selection available. It hides the month selector, overview indicators, and reports. Switching tabs stays in search mode and restores that tab's search filters.

For example, the user searches `super` in expenses, switches to revenues and searches `sal`, then switches back to expenses and sees its `super` search again.

Back to overview removes the search mode and restores the overview period and filters. Search filter changes must not overwrite the overview's saved filters or dates.

A direct URL or refresh restores the mode, selected resource, and search filters represented in the URL. Only entry through the toolbar starts a new empty search; refreshing an existing search does not clear it.

## 3. Filter and URL state

Description and both optional date bounds are URL-backed alongside the entity filters. Clearing a description through its existing search control, or clearing an optional date, removes that search condition; clearing both dates does not restore a default month. State handling needed for URL/tab restoration stays local to full-search mode. This does not extend the existing clear-filters action to description or change search boxes on other pages.

The approved expense and revenue search namespaces are separate from overview parameters:

```text
?view=search&expense_search_description=super
?view=search&revenues=true&revenue_search_description=sal
```

Expense search parameters use `expense_search_*`; revenue search parameters use `revenue_search_*`. Both namespaces and their parameter naming were already approved. Overview parameters retain their existing namespaces.

When the user supplies a start date, apply `created_at >= start_date`; an end date applies `created_at <= end_date`. Either bound works alone. Omitting both introduces no implicit period or current-date cutoff. Keep the existing API date formats and URL date convention.

Reuse the existing expense selection semantics: repeated categories, sources, or tags select any of the chosen values within that filter, while distinct filters combine. Revenue search retains its existing bank-account filter.

The extra expense tag-deduplication fix and custom invalid-date error/request-blocking rule have been removed from this task. They are deferred in the separate design. Existing entity-filter and validation behavior is not independently redesigned by this search work.

Existing category/source/tag/bank-account option catalogs retain their authenticated-user scope. New revenue category/tag controls and tag-option lookup belong to the separate design.

## 4. Description matching

Use the same word-prefix behavior in overview and full-history search for both resources. Every retained input term must match a word prefix, independently of word order. The user explicitly dropped literal punctuation matching.

| Input | Description | Result |
| --- | --- | --- |
| `super` | `Compra no supermercado` | Match |
| `super comp` | `Compra no supermercado` | Match |
| `comp super` | `Compra no supermercado` | Match |
| `SUPER COMP` | `Compra no supermercado` | Match |
| `mercado` | `Supermercado` | No match |
| `super wrong` | `Compra no supermercado` | No match |
| `super !!!` | `Supermercado` | Match |
| `super !!!` | `Supermercado !!!` | Match |
| `!!!` | Any description | No results |
| Missing or empty description | Any description | No description restriction |

Split description input on whitespace. Ignore terms containing no alphanumeric character. If a nonempty input has no retained terms, return no results rather than treating it as an empty filter. Otherwise compose one native `SearchQuery(Lexeme(term, prefix=True), config="simple")` per retained term and combine them with AND.

Delegate escaping and text-search parsing to Django/PostgreSQL. User text is not an operator language. Do not copy B2B's email-specific matching exception. The selected approach has no extra literal `contains` predicate, custom raw prefix-query escaping, or second search mechanism.

## 5. Models, queries, and indexes

Use a functional full-text vector over each model's existing `description`. Keep each model's existing `(user, created_at)` index and add its individually approved GIN index:

```python
# Expense.Meta.indexes
models.Index(fields=["user", "created_at"]),
GinIndex(
    SearchVector("description", config="simple"),
    name="expenses_desc_search_gin",
),

# Revenue.Meta.indexes
models.Index(fields=["user", "created_at"]),
GinIndex(
    SearchVector("description", config="simple"),
    name="revenues_desc_search_gin",
),
```

Each description filter uses that exact vector expression/configuration, aliased in its user-scoped queryset, and the combined native prefix query. Existing description/date/user fields supply the data. No stored `SearchVectorField`, token array, new tags model, search-data backfill, or coordinated search write path is selected.

PostgreSQL is the supported database. **SQLite removal is explicitly part of the main plan:** remove the fallback and `USE_POSTGRES` selector from settings, configure PostgreSQL unconditionally, and remove obsolete SQLite-only backup code/command references. Preserve the existing PostgreSQL connection configuration and unrelated backup/upload functionality.

**Django must also be updated in the main plan** to a supported 6.x release so native `Lexeme` is available. Select the exact release, synchronize dependency locks/exports, and verify integration compatibility. These are search prerequisites, not separate enhancements. Unrelated dependency modernization remains outside scope.

Query/index applicability and performance still require verification. Earlier measurements of the rejected substring approach do not measure this design. Do not claim a speedup from an untested GIN index or benchmark a rejected strategy.

## 6. API contract

Use the existing expense and revenue list endpoints. Dates are already optional in those backend filters; the UI must stop forcing them in search mode. There is no new full-search endpoint or search-mode flag required by the backend.

| Query parameter | Expenses | Revenues |
| --- | --- | --- |
| `description` | Native word-prefix search | Native word-prefix search |
| `start_date`, `end_date` | Optional bounds | Optional bounds |
| Repeated `category` | Existing filter | Separate enhancement |
| Repeated `source` | Existing filter | Not applicable |
| Repeated `tag` | Existing filter behavior | Moved to the separate design |
| `bank_account_description` | Existing filter | Existing filter |
| `page`, `page_size`, `ordering` | Existing pagination/sorting contract | Existing pagination/sorting contract |

Full search does not send fixed/ordinary/installment partition filters. One request returns one page across the selected resource's matching records, with its complete result count. The existing maximum page size of 100 is a per-page limit; it must not cap the total reachable results. Neither revenue request partition nor expense partition may be forced to page 1.

Expose the existing expense fields `installments_id`, `installment_number`, and `installments_qty` as read-only response metadata. Ordinary expenses return null installment metadata. Preserve the existing write-only `installments` request field and its current business rules; there is no installment resizing feature here. This metadata lets plain search rows retain the existing installment deletion warning without synthetic grouping labels.

New revenue category/tag filtering and the proposed revenue tag-list API belong to the separate design. They are not API additions in this task.

## 7. Table and mutation behavior

Render the currently visible columns and existing actions for the selected resource as flat rows. There are no group headers, expand/collapse actions, or synthetic grouping columns in full search. Existing overview grouping remains as it is.

Each search page uses one list request and the backend's count. Filtering resets pagination to the first page. Preserve existing sort controls. Full-search requests use the existing `ordering` parameter, defaulting to newest first with ID as a tie-breaker (`ordering=-created_at,-id`). User-selected date/value sorting also uses an ID tie-breaker. This request-level ordering was approved on 2026-10-06; it does not change the list endpoints' default ordering.

If a mutation/refetch makes the current page invalid, move to a valid preceding page while preserving filters. This page recovery was already approved; the user corrected its mistaken classification as an unreviewed addition on 2026-10-06.

Editing opens the selected resource's existing drawer. Deleting opens its existing confirmation, including fixed-expense/revenue options and the expense installment-group warning. Preserve existing bank-balance effects and future-action rules. No new revenue tag-editing or recurring propagation rule is implemented as part of this search design.

Existing editing/deleting remains in scope. The intended result is that an edit changing `rent` to `food` removes that row from a `rent` search, and group mutations update affected rows/counts. **On 2026-10-06, the user accepted cache invalidation:** successful search edits/deletions invalidate the affected resource's search queries so results/count are refetched. This handling is limited to full-search mode and preserves the existing overview's mutation/cache behavior. Preserve existing mutation feedback on failure. The extra count-request recovery strategy and previously prescribed custom callback/wrapper are withdrawn. Moving an invalid page to a valid preceding page remains the already-approved pagination requirement; ordinary pagination wiring does not create another design-approval gate.

The existing `Limpar filtros` action resets entity/date filters and does not clear the separately held description search. Its existing behavior is not expanded by this task. There is no new clear-all action or selected global search-box fix.

The full-search mode needs its own state binding for the approved URL-backed description and per-tab filter retention. Implement that binding locally or through an opt-in interface that preserves existing callers. Global input synchronization, debounce changes on other pages, and changes to existing shared overview mutation caches are outside this task and remain unapproved proposals in [the separate design](2026-10-05-revenue-filter-and-tag-enhancements-design.md).

## 8. Acceptance checks

Verify this design on PostgreSQL and through the relevant frontend paths during authorized implementation:

1. Expense and revenue toolbar actions open search with empty filters and no forced dates.
2. Omitted dates include matching records outside the overview period; each date bound works independently and can be cleared.
3. Switching tabs retains each tab's own search filters. Refresh/direct links restore the represented search. Leaving search restores overview filters and period.
4. Both resources satisfy the word-prefix/punctuation table above and safely handle operator-like input.
5. Existing expense category/source/tag/bank-account filters and the existing revenue bank-account filter keep their current behavior alongside description search. New revenue category/tag filtering and the extra fixes are checked under the separate design.
6. Another user's records and option catalogs remain inaccessible.
7. Search is flat and every matching record is reachable, including more than 100 fixed/installment expenses and more than 100 ordinary/fixed revenues.
8. Existing editing/deleting works from plain search rows and retains existing warnings/business rules. Verify the reviewed full-search refresh handling without replacing existing overview cache behavior.
9. URL/tab restoration works in the new mode. Existing clear-filters semantics and other pages' search-input behavior remain intact.
10. Both GIN indexes exist in an isolated test database and match the query expressions. Check index applicability separately from any claim about normal query plans or speed.
11. Settings select PostgreSQL without a `USE_POSTGRES` flag; the SQLite fallback and obsolete SQLite-only backup path are removed. The updated Django version imports native `Lexeme`, generated dependency files agree, and compatibility checks pass.

## 9. Review and implementation boundary

This document is the main expense/revenue full-search design for review. The handoff is supporting history; it is not a replacement for this design. The earlier expense-only implementation plan is stale and must not be executed.

The user explicitly requested the writing-plans step on 2026-10-06. Review the linked implementation plan for both resources, then select execution. Product code, dependency updates, migrations, application database writes, and delivery remain pending that process. Non-search questions continue in the separate design, one at a time.
