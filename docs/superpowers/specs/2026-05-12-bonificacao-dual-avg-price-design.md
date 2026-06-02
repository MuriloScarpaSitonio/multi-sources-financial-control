# Bonificação: dual avg-price (real vs IRPF)

**Date:** 2026-05-12 (revised 2026-06-01 to match shipped implementation)
**Status:** Shipped — see PR #34 on `feat/bonificacao`.
**Scope:** Backend (`variable_income_assets`) + transaction-entry frontend + IRPF report script + dummy-data seeder + tests.

## Problem

B3 "bonificação" events grant a user a quantity of shares at **zero real cost** but with a **company-declared unit price** that the Brazilian IRPF rules require be folded into the asset's reported cost basis. Before this work the system:

- Tracked only `BUY`/`SELL` transaction actions — bonificação had no representation.
- Computed a single avg-price family (`get_avg_price`, `get_current_avg_price`) which was reused for both portfolio display and the IRPF report.
- Skipped B3 `movimentacao.xlsx` rows labeled `"Bonificação"`.

Receita Federal requires the declared price to inflate the cost basis (raising the avg-price the user reports), but real ROI / portfolio metrics must keep cost = 0. The same event therefore needs **two parallel cost bases** with two parallel ROIs on sells.

## Goals

1. Persist bonificação as a first-class transaction.
2. Produce two avg-prices per asset:
   - **Real avg-price** — bonificação contributes 0 to cost-basis numerator, full quantity to denominator. Used for portfolio views, ROI, closed-op real gain.
   - **IRPF avg-price** — bonificação contributes `declared_price × quantity` to cost-basis numerator. Used in the IRPF report (open holdings + closed-op ROI + partial-sell ROI).
3. Surface a "Bonificação" option in the transaction form action dropdown, table, edit dialog, delete dialog, and filters menu.
4. Reflect IRPF-inflated avg-price + total in the IRPF report (`print_irpf_infos`).

## Non-Goals

- B3 `movimentacao.xlsx` parser changes — deferred. The xlsx column layout for bonificação rows is unverified; the parser keeps skipping until layout is confirmed.
- B3 `negociacao.xlsx` parser changes.
- Backfilling historical bonificações not previously entered.

## Architecture decision: Approach C — two stored price columns

After iterating against a SQL-CASE-per-metric variant (Approach A, abandoned because it required `for_irpf` flags on six expression methods, a `bought_strict` filter split for cashflow paths, and a `real_price_factor` helper), the shipped design stores the two prices side-by-side on `Transaction`:

- `Transaction.price` is the **real cost** (zero for BONIFICACAO).
- `Transaction.irpf_price` is the **IRPF cost** (= `price` for BUY/SELL; = company-declared value for BONIFICACAO).

Existing SQL aggregators stay almost untouched; cost-basis methods accept a `price_field` kwarg (default `"price"`) and IRPF callers pass `price_field="irpf_price"`. The widened `bought` filter (now `action__in=(BUY, BONIFICACAO)`) handles quantity-bought + cost-basis filtering uniformly — BONIFICACAO with `price=0` automatically contributes zero to real cashflow sums (`historic`, etc.), so no separate "BUY-only" filter is needed.

## Data model

**`choices.TransactionActions`** gains `bonificacao = ChoiceItem("BONIFICACAO", label="Bonificação")`.

**`models.Transaction`** (`models/write.py`)
- `action` widened to `CharField(max_length=20)` to fit `"BONIFICACAO"`.
- New `irpf_price = DecimalField(decimal_places=8, max_digits=15, default=Decimal())`.

**`models.AssetClosedOperation`** (`models/write.py`) — two new columns:
- `irpf_total_bought = DecimalField(decimal_places=4, max_digits=20, default=Decimal())`
- `irpf_normalized_total_bought = DecimalField(decimal_places=4, max_digits=20, default=Decimal())`

`AssetReadModel` is **not** modified. The cached `avg_price` / `normalized_avg_price` retain real-cost meaning. The IRPF report queries the write model directly via `annotate_irpf_infos`.

## Migration `0029`

1. AlterField `Transaction.action` to `max_length=20`.
2. AddField `Transaction.irpf_price` (default 0).
3. AddField `AssetClosedOperation.irpf_total_bought` (default 0).
4. AddField `AssetClosedOperation.irpf_normalized_total_bought` (default 0).
5. RunPython `backfill_irpf_columns`:
   - `Transaction.objects.update(irpf_price=F("price"))`
   - `AssetClosedOperation.objects.update(irpf_total_bought=F("total_bought"), irpf_normalized_total_bought=F("normalized_total_bought"))`

No historical bonificações exist (per "no backfill"), so real == IRPF for pre-existing rows.

## Expressions (`models/managers/expressions.py`)

- `filters.bought` widens to `Q(action__in=(BUY, BONIFICACAO))`.
- Cost-basis methods accept `price_field: str = "price"`:
  - `get_total_bought`, `get_normalized_total_bought`, `get_normalized_current_total_bought`,
  - `get_avg_price`, `get_current_avg_price`, `get_current_normalized_avg_price`.
- New closed-op helpers: `closed_operations_irpf_total_bought`, and `get_closed_operations_normalized_total_bought(extra_filters, for_irpf=False)` that reads `irpf_normalized_total_bought` when `for_irpf=True`.

Quantity expressions (`get_quantity_bought`, `get_quantity_balance`) need no flag — the widened `bought` filter already counts BONIFICACAO toward holdings.

## Write paths

- `domain/models.py` — `TransactionDTO` gains `irpf_price: Decimal | None = None` and a `__post_init__` that mirrors `irpf_price` from `price` when omitted.
- `serializers.py` — `TransactionSerializer.Meta.fields` exposes `irpf_price` as `read_only` so the frontend can render the declared value on bonifica rows. `TransactionListSerializer._apply_bonificacao_price_split` rewrites `validated_data` for BONIFICACAO submissions: `irpf_price = price`, `price = 0`.
- Direct `Transaction.objects.create` sites (`views.py` simulate rollback, `scripts.py` split/group, `generate_dummy_data.py`) set `irpf_price=price` explicitly to keep IRPF aggregates consistent.
- `models/managers/write.py`:
  - `annotate_irpf_infos` passes `price_field="irpf_price"` to all cost-basis expressions (avg, normalized avg, total, currency-rate avg).
  - `aggregate_normalized_totals` (used by `create_asset_closed_operation`) computes both real and IRPF totals; both flow into `AssetClosedOperation.objects.create` via `**kwargs`.
  - `AssetClosedOperationQuerySet.annotate_irpf_roi`: `roi = normalized_total_sold − irpf_normalized_total_bought`.
  - `TransactionQuerySet.get_partial_sell_roi(asset_id, month, year, for_irpf=False)`: when `for_irpf=True`, widens the acquisition filter to include BONIFICACAO and uses `irpf_price` for the cost basis.

## IRPF script (`scripts.py`)

- `_print_assets_portfolio` already uses `annotate_irpf_infos`, so avg-price / total automatically reflect the IRPF-inflated values once the price_field switch lands.
- `_get_closed_roi` calls `annotate_irpf_roi` (instead of `annotate_roi`) so the closed-op ROI in the report matches Receita's expected basis.
- `_get_partial_sell_roi` calls `get_partial_sell_roi(for_irpf=True)`.
- A `debug > 1` line per asset lists the accumulated bonificação quantity + declared value for the year, computed via `Transaction.objects.filter(action=BONIFICACAO).aggregate(qty=Sum(quantity), declared=Sum(irpf_price * quantity))`.

## Frontend

- `consts.js` — `TransactionsActionsMapping` adds `{label: "Bonificação", value: "BONIFICACAO"}`.
- New + edit + filter forms gain a "Bonificação" radio option.
- `EditTransactionForm` decodes `"Bonificação"` → `"BONIFICACAO"` on initial mount and initializes the form's `price` field from the API response's `irpf_price` for bonifica rows (otherwise the displayed value would be 0, blocking the positive-price Yup rule).
- Table "Preço" cell + delete-dialog confirmation copy display `irpf_price ?? price` for bonifica rows.
- `Transaction` TS type widens `action` to `"Compra" | "Venda" | "Bonificação"` and adds optional `irpf_price?: number`.
- `invalidateReportsQuery` toggle accepts both `BUY` and `BONIFICACAO`.

## Test coverage

`tests/conftest.py` adds shared fixtures (`bonificacao_transaction`, `two_buy_transactions`, `partial_sell_after_bonificacao_transaction`, `closing_sell_after_bonificacao_transaction`, `closed_op_after_bonificacao`). `TransactionFactory.irpf_price` mirrors `price` via `factory.LazyAttribute`, so existing IRPF fixtures keep working without per-fixture changes.

`tests/e2e/test_transactions_endpoints.py` adds five bonificação tests, each asserting `Transaction` columns + `AssetReadModel` deltas + `annotate_irpf_infos`:

1. `test__create__bonificacao` — POST new bonifica on top of a prior BUY; verify split (`price=0`, `irpf_price=declared`), `quantity_balance` delta, IRPF avg/total.
2. `test__update__buy_to_bonificacao_splits_price` — PUT a BUY → BONIFICACAO; verify the splitter applies on update, the read model's real cost basis drops, IRPF avg matches the weighted average across the kept BUY + new bonifica.
3. `test__delete__bonificacao` — DELETE a bonifica; verify the row is gone, `quantity_balance` drops by bonifica qty, real `normalized_total_bought` unchanged, IRPF avg collapses to the remaining BUY price.
4. `test__partial_sell_roi__after_bonificacao` — partial-sell scenario; assert `get_partial_sell_roi` real vs IRPF; sanity-check `irpf_roi < real_roi`.
5. `test__closed_op_irpf_roi__after_bonificacao` — full-close scenario via the `closed_op_after_bonificacao` fixture (which calls `create_asset_closed_operation`); assert `annotate_roi` vs `annotate_irpf_roi`; sanity-check `irpf_roi < real_roi`; IRPF annotation collapses to zero post-close.

Two pre-existing master-branch test failures uncovered during full-suite verification were also fixed in the same PR:
- `test__asset__irp_infos`: `.values()` referenced the renamed `normalized_total_invested` field but only requested `total_invested`.
- `test_existing_td_asset_stale_price_is_updated`: expected value was off by one ULP from the actual `45390.59 / 15.48` quotient.

## Risks and mitigations

- **`filters.bought` widening** — any non-cost-basis caller now includes BONIFICACAO. Verified: `historic()` uses `normalized_total_raw_expression` which multiplies by `price`, so BONIFICACAO contributes 0 to cashflow naturally; `filter_bought_and_group_by_asset_type` groups by asset type and is unaffected.
- **`irpf_price` default = 0 on Transaction** — any direct `Transaction.objects.create(...)` that omits `irpf_price` silently understates IRPF basis. All known direct-create sites (views.py simulate, scripts.py split/group, generate_dummy_data.py) now pass `irpf_price=price`. `TransactionFactory` mirrors via `LazyAttribute`. The DTO mirrors via `__post_init__`.
- **AssetReadModel cache** — bonificações go through `messagebus.handle(CreateTransactions)` → `upsert_asset_read_model(is_aggregate_upsert=True)`. The cached `avg_price` reflects the real path (BONIFICACAO contributes 0 to numerator), matching how the rest of the UI uses the read model.
