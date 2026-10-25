# Additional work raised during search brainstorming — separate design draft

**Main search design:** [Expense and revenue full-history search](2026-10-05-expense-revenue-full-search-design.md).

## Scope and approval status

This document records revenue category/tag filter enhancements, the tag-options API, extra expense tag-deduplication and date-validation proposals, unapproved global shared-input/debounce/cache proposals, additional revenue editing/recurrence work, and possible overview filter extensions. On 2026-10-06, the user moved the revenue tag dropdown here and then required focus on full-text search rather than additional fixes. These enhancements are outside the main task. Earlier individual approvals are retained below; they do not authorize implementation of this separate workstream. Its complete design, plan, and execution method remain pending.

## Scope map

| Topic | Current status | Design location |
| --- | --- | --- |
| Revenue category search filter | Individually approved earlier; separated when the user required focus on full-text search. | This document. |
| Revenue tag dropdown and supporting tag filtering | Previously accepted for search; explicitly moved here on 2026-10-06. | This document. |
| Revenue tag-list API | Concrete endpoint proposal remains unapproved; moved with the dropdown. | This document. |
| Expense tag deduplication | Extra fix excluded from the main full-text-search task; prior approval was not established. | This document; deferred. |
| Custom invalid URL-date error/request blocking | Extra behavior excluded from the main task; prior approval was not established. | This document; deferred. |
| Global shared-input synchronization / changing clear-filters semantics | Unapproved scope expansion; outside the full-search task. | This document; deferred. |
| Shared debounce cancellation across other pages | Unapproved scope expansion; outside the full-search task. | This document; deferred. |
| Replacing existing shared mutation/overview cache handling | Unapproved scope expansion; full-search-only refresh handling remains a distinct proposal. | This document; deferred. |
| SQLite removal | Explicitly required in the main plan, superseding the earlier support-only discussion. | Main search design, section 5; main plan, Task 0. |
| Django update | Explicitly required in the main plan. | Main search design, section 5; main plan, Task 0. |
| Revenue tag assignment/editing | Individually approved for the create/edit form, then separated from the search task. | This document. |
| Tag changes on future fixed revenues | Asked but unanswered when the user redirected scope. | This document; unresolved. |
| Future tag creation / automatic recurrence and overview filter extensions | Possible follow-up topics; no decision was made. | This document; do not treat them as approved features. |

Earlier entries claimed approval of all three broader changes. The user disputed that and then objected to expanding scope. These entries are retained as unapproved, deferred proposals; their presence is not implementation authorization.

## Deferred tag/date fixes

The old search draft proposed adding `distinct()` to `ExpenseFilterSet.filter_tag` so an expense matching multiple selected tags appears once. Current source does not deduplicate this join. Applying the change to the shared list endpoint would affect overview results and counts too. This wider effect was not initially disclosed. The user rejected expanding the main task into such fixes; keep this proposal deferred rather than requiring it for full-text search.

The old draft also proposed showing a custom UI validation error and blocking requests for invalid URL dates, such as `31/02/2026`. Approval of that behavior was not established. It is deferred here rather than included as a new requirement of description search. This does not change the approved optional-date/full-history requirements.

Neither fix is authorized for implementation as part of the main task, and neither is a blocker for completing the main design.

## Deferred shared-control/cache proposals

- Change the shared search box so an external filter reset also resets displayed description text on every caller, including extending the existing `Limpar filtros` behavior to description. Not selected for the main task.
- Cancel stale delayed search/clear actions across the shared input's existing callers. Not selected for the main task.
- Replace existing shared overview mutation/cache updates with authoritative refetching. Not selected for the main task; keeping full-search results correct does not itself authorize replacing overview handlers.

Do not implement these proposals while building full search. The main design confines its required URL/tab state binding and any proposed result refresh to the new search mode.

## Revenue category filter: accepted intent, separate scope

Add category filtering to revenues using the existing category field and category option catalog. This intent was individually approved earlier. It now belongs to the separate filter-enhancement workstream following the user's instruction to focus the main task on full-text search. Do not add its UI or list-filter behavior as an incidental part of description search.

The selection behavior follows the corresponding expense filter: match any selected category, then combine with the other selected filters. No new category model was selected.

## Revenue tag dropdown and supporting API/filtering

The dropdown lets the user choose an existing revenue tag, such as `Bonus`, to find revenues carrying that tag. It is separate from the description text input. The user explicitly moved this dropdown to this design; it must not be added as part of the main full-history search task.

The proposed read-only lookup is a `GET` tags action on the existing revenue endpoint, mirroring the expense tags action and returning the authenticated user's revenue tag names. This endpoint choice has not been approved. Expense and revenue tags remain their existing separate catalogs.

The supporting revenue list filter accepts repeated `tag` values using the corresponding expense selection semantics: any selected tag matches, while distinct filters combine. Matching multiple tags must return each revenue once with an accurate count. Record this supporting filtering here with the dropdown rather than requiring it in the main task.

This lookup/filtering does not authorize tag assignment, changes to the overview controls, or recurring propagation. Those have their own review status below.

## Revenue tag editing: accepted intent

Add tag assignment/editing to the existing revenue create/edit form. Saved tags must be available when reopening a revenue, and all tag data remains scoped to its owner. This uses the existing revenue-tag relation rather than introducing another tags model or sharing the expense tag catalog.

The concrete write API, serialization, option handling, and persistence interface still need design review before implementation. The read-only tag dropdown and proposed lookup are also recorded in this document; that lookup does not itself authorize tag-writing changes.

## Current source relevant to this enhancement

Paths are relative to `/Users/murilo/github/multi-sources-financial-control` and were inspected during this discussion; recheck before implementation.

- `django/expenses/models/revenues.py`: `Revenue.tags` and user-owned `RevenueTag` already exist.
- `django/expenses/serializers.py` and `react/src/pages/private/Revenues/models.ts`: revenue representations/writes do not currently expose tags.
- `react/src/pages/private/Revenues/Table/RevenueDrawer/RevenueForm.tsx`: no tag assignment field exists.
- `django/expenses/domain/models.py`: the revenue domain model currently has no tags field.
- `django/expenses/adapters/sql.py`: fixed-revenue creation and future updates currently persist scalar DTO fields without tag handling.
- `django/expenses/views.py`: future fixed-revenue actions have existing conditions involving the future-action flag, fixed/recurring status, and period; no change to those conditions was selected.

## Unanswered recurring-tag question

The last question presented was:

> When editing a fixed revenue with “Apply to future revenues” enabled, should tag changes also apply to those future revenues?

The user redirected the scope instead of answering. Preserve this as an unresolved question. Do not infer propagation, tag merging/replacement, or changes to past/current/future eligibility.

Possible later questions include tags on future creation or automatic monthly recurrence, clearing tags, and the tag form/write interface. These are potential design topics, not additional requirements already requested or approved.

## Possible overview filter extensions

Revenue category and tag filter enhancements are both recorded here. Extending either new control to the revenue overview has not been decided and would be a separate scope choice. Search approval must not silently add that overview behavior.

## Evidence and next stage

The original conversation is recorded at `/Users/murilo/.codex/sessions/2026/10/03/rollout-2026-10-03T10-54-43-01a1020b-b229-7cd1-9e70-b95c36ca3c92.jsonl`. The revenue category/tag search questions and replies are at lines 2900/2907 and 2912/2919; tag-form editing at 2939/2946; the unanswered propagation question and scope redirection at 2971/2978. The user's 2026-10-06 direction moving the revenue tag dropdown here supersedes its earlier main-task placement. Earlier ambiguous acknowledgments about shared-input behavior are not current approval of those proposals. No rereading of that conversation is required to apply the latest recorded user directions.

Keep this separate work deferred while completing full-text search. Do not use these extra features or their unanswered questions to delay the main task. If the user resumes this workstream, continue its questions one at a time, then write/review its own implementation plan after design approval. No product code has been written for these enhancements.
