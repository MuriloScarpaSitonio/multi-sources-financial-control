# Asset conversion row action

**Date:** 2026-09-16  
**Status:** Draft — awaiting review  
**Scope:** Assets table, conversion endpoint, domain command/event, unit of work, CQRS read model, and tests.

## Problem

Some corporate actions replace an entire holding with another ticker at a fixed ratio. On 2026-08-19, 163 LBRDA shares became 38.468 CHTR shares, a factor of 0.236.

For this application, conversion is intentionally a destructive correction of the existing asset rather than a separately persisted financial event. It must not create an economic sale or purchase, realized gain/loss, tax result, second asset, transaction action, or corporate-action model. Internally, the existing zero-cost `BUY` representation used for split/group quantity adjustments is reused; it does not represent cash invested.

## Decision

Add a row-level **Convert asset** action to the assets table. The operation keeps the existing `Asset` identity and all related history, changes its ticker, and rebalances its open quantity while preserving its total cost basis.

The user supplies:

- destination ticker;
- resulting quantity; and
- effective date.

The backend derives the conversion factor and quantity adjustment:

```text
factor = resulting_quantity / current_quantity
quantity_adjustment = current_quantity * (factor - 1)
```

For LBRDA:

```text
factor = 38.468 / 163 = 0.236
quantity_adjustment = 163 * (0.236 - 1) = -124.532
```

## Backend behavior

Expose a detail endpoint:

```text
POST /assets/{asset_id}/convert
```

Request:

```json
{
  "code": "CHTR",
  "resulting_quantity": "38.468",
  "operation_date": "2026-08-19"
}
```

The endpoint validates the request with `AssetConversionSerializer`, locks the source asset row, derives `factor = resulting_quantity / current_quantity` from its annotated state, and dispatches a new `ConvertAsset` command through the existing message bus and `DjangoUnitOfWork`. The command handler:

1. Rejects the operation when the user already owns a separate asset with the destination code, type, and currency, using the existing asset-repository rule.
2. Changes the existing `Asset.code` through `uow.assets.update`. The `Asset` primary key, transactions, incomes, closed operations, objective, type, currency, and description remain attached to the same asset.
3. Emits a synchronous `AssetConverted` domain event carrying the destination asset, factor, and effective date.

The `AssetConverted` event handlers, in order:

1. get or create destination `AssetMetaData` using the existing metadata handler, including its current price and sector;
2. call `Asset.rebalance_quantity(factor, operation_date, current_currency_conversion_rate)` and persist its returned DTO through `uow.assets.transactions` when the factor is not `1`:
   - `quantity = resulting_quantity - current_quantity`;
   - equivalently, `quantity = current_quantity * (factor - 1)`;
   - `price = 0`;
   - `irpf_price = 0`;
   - `operation_date = submitted date`;
   - a valid currency-conversion rate is stored even though the zero price makes it value-neutral.
3. completely rebuild `AssetReadModel`, so it points at the destination metadata and exposes the new code, current price, and resulting quantity.

The command and its synchronous event handlers run inside one Django database transaction. When the resulting quantity already equals the current quantity, conversion changes the ticker and metadata without creating a zero-quantity transaction.

No historical transaction is rescaled or reassigned.
The command handler contains no quantity arithmetic and never accesses the domain asset's private transaction collection. The conversion emits `AssetConverted`, not `TransactionsCreated`, so the synthetic adjustment does not trigger purchase-specific threshold, closed-operation, or historical-snapshot handlers.

## Accounting effects

Tests verify that:

- quantity equals the submitted resulting quantity;
- raw and BRL total cost bases are unchanged;
- real and IRPF cost bases are unchanged;
- normalized total sold and closed ROI are unchanged;
- credited income totals are unchanged; and
- no closed operation was created.

Average price per share is expected to change inversely with the quantity factor. Current market value is allowed to change because it uses the destination ticker's live price. These are test assertions, not runtime validations in the command handler.

## Frontend

Enable row actions on the assets table and add **Convert asset** for open, quantity-based assets.

The dialog contains:

- current ticker and quantity, read-only;
- destination ticker;
- resulting quantity; and
- effective date.

Before confirmation it displays the derived factor and adjustment. The confirmation copy warns that this destructively changes the existing asset and has no application-level undo.

After success, invalidate the assets list, indicators, reports, histories, and metadata-dependent price queries. The same row remains because the write-model primary key is unchanged.

## Validation and failure handling

- Resulting quantity must be positive; the serializer owns this validation.
- Resulting quantity may equal the current quantity.
- Destination metadata lookup uses the submitted code together with the asset's unchanged type and currency.
- A conflicting user-owned destination asset is rejected rather than silently consolidated.
- The existing `AssetViewSet` queryset continues to enforce user scoping; conversion adds no ownership validation.
- Metadata lookup failure, transaction creation failure, code update failure, or read-model rebuild failure rolls back the command and synchronous event handlers.

## Tests

Backend tests cover:

1. LBRDA conversion: 163 becomes 38.468 CHTR using factor 0.236.
2. Destination metadata creation and reuse.
3. Preservation of real/IRPF raw and BRL cost bases, sold totals, ROI, and income.
4. Destination current price and metadata appearing after the full read-model rebuild.
5. Command dispatch through the message bus, UoW repository writes, synchronous `AssetConverted` handling, and atomic rollback.
6. Rejection of existing destination assets and non-positive resulting quantities, plus regression coverage for the existing user-scoped queryset.
7. Equal resulting quantity performing a ticker-only conversion with no adjustment row.
8. No `AssetClosedOperation` creation and no SELL transaction.

Frontend tests cover dialog validation, preview arithmetic, confirmation, successful cache invalidation, and surfaced API errors.

## Non-goals

- Persisting corporate-action history.
- Supporting partial conversions.
- Consolidating two user-owned assets.
- Creating a new model or transaction action.
- Reconstructing historical reports under the old ticker after conversion.
- Providing an automatic undo operation.
