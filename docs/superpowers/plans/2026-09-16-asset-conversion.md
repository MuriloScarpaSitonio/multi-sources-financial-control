# Asset Conversion Row Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a destructive row-level conversion that changes an existing asset's ticker and rebalances its quantity without changing cost basis, ROI, tax totals, or asset identity.

**Architecture:** A detail endpoint validates the request, derives the conversion factor, and dispatches a `ConvertAsset` command through the existing message bus and `DjangoUnitOfWork`. Its handler only updates the existing asset and emits a synchronous `AssetConverted` event carrying the factor and effective date. Ordered event handlers get or create destination metadata, ask the domain asset to rebalance quantity by the factor through the UoW, and fully rebuild the existing `AssetReadModel`; no database model or transaction action is added.

**Tech Stack:** Django, Django REST Framework, PostgreSQL, pytest, React 18, TypeScript, Material React Table, Material UI, React Hook Form, Yup, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-09-16-asset-conversion-design.md`

## Global Constraints

- Do not add a database model, migration, or transaction action.
- Keep the existing `Asset` primary key and all related transactions, incomes, and closed operations.
- When quantity changes, represent the rebalance with one zero-cost existing `BUY` row; it is not an economic purchase. When quantity is unchanged, create no adjustment row.
- Do not rescale or reassign historical transactions.
- Preserve raw and BRL real/IRPF cost bases, sold totals, closed ROI, and credited income.
- Reject conversion when another user-owned asset already has the destination code, type, and currency.
- Dispatch a new `ConvertAsset` command through the existing message bus and UoW; emit a synchronous `AssetConverted` event whose ordered handlers create/reuse metadata, rebalance quantity, and fully rebuild the read model.
- Keep command handling and synchronous event handling inside one Django atomic block.
- Do not trigger closed-operation, sale-threshold, or historical-snapshot side effects.
- Do not commit the spec, plan, code, or tests unless the user explicitly requests a commit.

---

## File Structure

- Modify `django/variable_income_assets/domain/commands.py`: define `ConvertAsset`.
- Modify `django/variable_income_assets/domain/events.py`: define `AssetConverted`.
- Modify `django/variable_income_assets/domain/models.py`: encapsulate factor-based quantity rebalancing.
- Modify `django/variable_income_assets/service_layer/handlers.py`: implement the UoW command handler and event behavior.
- Modify `django/variable_income_assets/service_layer/messagebus.py`: register the command and event.
- Create `django/variable_income_assets/tests/test__asset_conversion.py`: command/event/UoW integration tests.
- Modify `django/variable_income_assets/serializers.py`: conversion request serializer.
- Modify `django/variable_income_assets/views.py`: `POST /assets/{id}/convert`.
- Modify `django/variable_income_assets/tests/e2e/test_asset_endpoints.py`: endpoint tests.
- Modify `react/src/pages/private/Assets/api/index.ts` and `api/types.ts`: client contract.
- Modify `react/src/pages/private/Assets/Table/hooks.ts`: invalidate every cache affected by the ticker change and synthetic adjustment.
- Create `react/src/pages/private/Assets/Table/AssetConversionDialog/logic.ts` and `logic.test.ts`: validation, preview arithmetic, confirmation copy, error extraction, and invalidation orchestration.
- Create `react/src/pages/private/Assets/Table/AssetConversionDialog/index.tsx`: form and confirmation dialog.
- Modify `react/src/pages/private/Assets/Table/index.tsx`: row action and dialog state.

---

### Task 1: Conversion command, event, and UoW handler

**Files:**
- Modify: `django/variable_income_assets/domain/commands.py`
- Modify: `django/variable_income_assets/domain/events.py`
- Modify: `django/variable_income_assets/domain/models.py`
- Modify: `django/variable_income_assets/service_layer/handlers.py`
- Modify: `django/variable_income_assets/service_layer/messagebus.py`
- Create: `django/variable_income_assets/tests/test__asset_conversion.py`

**Interfaces:**
- Consumes: `DjangoUnitOfWork(asset_pk, user_id)`, `AssetRepository.update`, `TransactionRepository.add`, `maybe_create_asset_metadata`, and `upsert_asset_read_model`.
- Produces: `ConvertAsset(asset: AssetDomainModel, db_instance: Asset, factor: Decimal, operation_date: date)`, `AssetConverted(asset: AssetDomainModel, factor: Decimal, operation_date: date, sync: bool = True)`, `Asset.rebalance_quantity(factor, operation_date, current_currency_conversion_rate) -> TransactionDTO | None`, command handler `convert_asset(cmd, uow) -> None`, and ordered synchronous event handling.

- [ ] **Step 1: Write the failing command-flow test**

Create `django/variable_income_assets/tests/test__asset_conversion.py`:

```python
from dataclasses import replace
from datetime import date
from decimal import Decimal

from django.db import transaction as db_transaction

import pytest

from ..choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    Currencies,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
)
from ..domain import commands
from ..models import (
    Asset,
    AssetClosedOperation,
    AssetMetaData,
    AssetReadModel,
    Transaction,
)
from ..service_layer import messagebus
from ..service_layer.unit_of_work import DjangoUnitOfWork
from .conftest import (
    AssetFactory,
    AssetMetaDataFactory,
    PassiveIncomeFactory,
    TransactionFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def lbrda(user):
    asset = AssetFactory(
        code="LBRDA",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        objective=AssetObjectives.growth,
        user=user,
    )
    AssetMetaDataFactory(
        code="LBRDA",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        sector=AssetSectors.communication,
        current_price=Decimal("35.99"),
    )
    TransactionFactory(
        asset=asset,
        action=TransactionActions.buy,
        quantity=Decimal("163"),
        price=Decimal("59.39964531"),
        irpf_price=Decimal("59.39964531"),
        current_currency_conversion_rate=Decimal("5.59"),
        operation_date=date(2024, 1, 10),
    )
    PassiveIncomeFactory(
        asset=asset,
        type=PassiveIncomeTypes.dividend,
        event_type=PassiveIncomeEventTypes.credited,
        amount=Decimal("12.34"),
        current_currency_conversion_rate=Decimal("5.50"),
        operation_date=date(2025, 6, 20),
    )
    from ..service_layer.tasks import upsert_asset_read_model

    upsert_asset_read_model(asset_id=asset.pk)
    return asset


def make_command(asset, resulting_quantity=Decimal("38.468")):
    annotated = Asset.objects.annotate_for_domain().get(pk=asset.pk)
    destination = replace(annotated.to_domain(), code="CHTR")
    return commands.ConvertAsset(
        asset=destination,
        db_instance=asset,
        factor=resulting_quantity / annotated.quantity_balance,
        operation_date=date(2026, 8, 19),
    )


def test_convert_asset_command_changes_existing_asset(lbrda, mocker):
    mocker.patch(
        "variable_income_assets.integrations.helpers.fetch_asset_sector",
        return_value=AssetSectors.communication,
    )
    mocker.patch(
        "variable_income_assets.integrations.helpers.fetch_asset_current_price",
        return_value=Decimal("250"),
    )

    with db_transaction.atomic():
        messagebus.handle(
            message=make_command(lbrda),
            uow=DjangoUnitOfWork(asset_pk=lbrda.pk, user_id=lbrda.user_id),
        )

    lbrda.refresh_from_db()
    converted = AssetReadModel.objects.get(write_model_pk=lbrda.pk)
    assert lbrda.code == converted.code == "CHTR"
    assert converted.write_model_pk == lbrda.pk
    assert converted.quantity_balance == Decimal("38.468")
    assert converted.metadata.code == "CHTR"
    assert converted.metadata.current_price == Decimal("250")
    assert Asset.objects.filter(user=lbrda.user).count() == 1

    adjustment = Transaction.objects.get(
        asset=lbrda,
        operation_date=date(2026, 8, 19),
    )
    assert adjustment.action == TransactionActions.buy
    assert adjustment.quantity == Decimal("-124.532")
    assert adjustment.price == adjustment.irpf_price == 0
    assert not Transaction.objects.filter(
        asset=lbrda,
        action=TransactionActions.sell,
    ).exists()
    assert not AssetClosedOperation.objects.filter(asset=lbrda).exists()
```

- [ ] **Step 2: Run the test and verify RED**

```bash
cd django
USE_POSTGRES=1 uv run pytest variable_income_assets/tests/test__asset_conversion.py::test_convert_asset_command_changes_existing_asset -v
```

Expected: collection fails because `ConvertAsset` does not exist.

- [ ] **Step 3: Define the command and event**

Append to `django/variable_income_assets/domain/commands.py`:

```python
@dataclass
class ConvertAsset(Command):
    asset: AssetDomainModel
    db_instance: Asset
    factor: Decimal
    operation_date: date
```

Add the missing imports:

```python
from datetime import date
from decimal import Decimal
```

Add a keyword-only `AssetEvent` subtype to `django/variable_income_assets/domain/events.py`; keyword-only fields keep the required conversion fields compatible with `AssetEvent.sync`'s default value:

```python
@dataclass(kw_only=True)
class AssetConverted(AssetEvent):
    factor: Decimal
    operation_date: date
    sync: bool = True
```

The command carries the destination write-side state. The event carries everything its ordered handlers need to create destination metadata, rebalance quantity, and rebuild the complete read model.

- [ ] **Step 4: Register the message-bus routes**

Update `django/variable_income_assets/service_layer/messagebus.py`:

```python
events.AssetConverted: [
    handlers.maybe_create_metadata,
    handlers.rebalance_asset_quantity,
    handlers.upsert_read_model,
],

commands.ConvertAsset: handlers.convert_asset,
```

Keep this exact order: destination metadata must exist first, the quantity adjustment must be persisted second, and only then can the full read model be rebuilt.

- [ ] **Step 5: Implement the UoW command handler**

Add the handler:

```python
def convert_asset(cmd: commands.ConvertAsset, uow: AbstractUnitOfWork) -> None:
    with uow:
        cmd.asset.validate()
        if uow.assets.exists(cmd.asset):
            raise AssetCodeTypeCurrencyAlreadyExistsException

        uow.assets.update(cmd.asset, cmd.db_instance)
        cmd.asset.events.append(
            events.AssetConverted(
                asset=cmd.asset,
                factor=cmd.factor,
                operation_date=cmd.operation_date,
            )
        )
        uow.commit()
```

The command handler only validates destination identity, updates the asset through the UoW, and emits the conversion event. It contains no quantity arithmetic, transaction construction, private `_transactions` access, metadata work, or CQRS work.

- [ ] **Step 6: Add factor-based rebalancing to the domain asset**

Add this method to `Asset` in `django/variable_income_assets/domain/models.py`:

```python
def rebalance_quantity(
    self,
    *,
    factor: Decimal,
    operation_date: date,
    current_currency_conversion_rate: Decimal,
) -> TransactionDTO | None:
    if factor == Decimal("1"):
        return None

    dto = TransactionDTO(
        action=TransactionActions.buy,
        quantity=self.quantity_balance * (factor - Decimal("1")),
        price=Decimal(),
        irpf_price=Decimal(),
        operation_date=operation_date,
        current_currency_conversion_rate=current_currency_conversion_rate,
    )
    self.add_transaction(dto)
    return dto
```

This method owns the conversion arithmetic and reuses the domain's existing transaction validation. Returning the DTO gives the event handler a public persistence interface; it must not inspect `_transactions`.

- [ ] **Step 7: Implement the ordered AssetConverted event handlers**

Add `Decimal` and `get_dollar_conversion_rate`, and extend the existing choices import in `django/variable_income_assets/service_layer/handlers.py`:

```python
from decimal import Decimal

from ..adapters.key_value_store import get_dollar_conversion_rate
from ..choices import AssetTypes, Currencies
```

Add the quantity handler:

```python
def rebalance_asset_quantity(
    event: events.AssetConverted,
    uow: AbstractUnitOfWork,
) -> None:
    dto = event.asset.rebalance_quantity(
        factor=event.factor,
        operation_date=event.operation_date,
        current_currency_conversion_rate=(
            Decimal("1")
            if event.asset.currency == Currencies.real
            else get_dollar_conversion_rate()
        ),
    )
    if dto is not None:
        uow.assets.transactions.add(dto=dto)
```

Broaden the metadata handler:

Broaden `maybe_create_metadata`:

```python
def maybe_create_metadata(
    event: events.AssetCreated | events.AssetUpdated | events.AssetConverted,
    _: AbstractUnitOfWork,
) -> None:
    maybe_create_asset_metadata(event.asset)
```

Replace `upsert_read_model` with the same existing behavior plus the explicit `AssetConverted` full-rebuild branch:

```python
def upsert_read_model(
    event: (
        events.TransactionsCreated
        | events.TransactionDeleted
        | events.TransactionUpdated
        | events.PassiveIncomeCreated
        | events.PassiveIncomeUpdated
        | events.PassiveIncomeDeleted
        | events.AssetCreated
        | events.AssetUpdated
        | events.AssetConverted
    ),
    _: AbstractUnitOfWork,
) -> None:
    is_held_in_self_custody = getattr(event, "is_held_in_self_custody", False)
    if isinstance(event, events.AssetConverted):
        is_aggregate_upsert = None
    elif not getattr(event, "new_asset", False):
        if isinstance(event, events.AssetUpdated):
            is_aggregate_upsert = False
        elif isinstance(event, events.AssetCreated):
            is_held_in_self_custody = event.asset.is_held_in_self_custody
            is_aggregate_upsert = None if is_held_in_self_custody else False
        else:
            is_aggregate_upsert = True
    else:
        is_aggregate_upsert = None

    upsert_asset_read_model(
        asset_id=event.asset_pk,
        is_aggregate_upsert=is_aggregate_upsert,
        is_held_in_self_custody=is_held_in_self_custody,
    )
```

Do not add `AssetConverted` to purchase, sale-threshold, closed-operation, or snapshot handlers. The only ordered handlers are metadata creation, factor-based rebalance, and the full read-model rebuild.

- [ ] **Step 8: Run the happy-path test and verify GREEN**

```bash
cd django
USE_POSTGRES=1 uv run pytest variable_income_assets/tests/test__asset_conversion.py::test_convert_asset_command_changes_existing_asset -v
```

Expected: PASS.

- [ ] **Step 9: Test ticker-only conversion when quantity is unchanged**

Append:

```python
def test_convert_asset_allows_unchanged_quantity(lbrda):
    metadata = AssetMetaDataFactory(
        code="CHTR",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        sector=AssetSectors.communication,
        current_price=Decimal("250"),
    )

    with db_transaction.atomic():
        messagebus.handle(
            message=make_command(lbrda, resulting_quantity=Decimal("163")),
            uow=DjangoUnitOfWork(asset_pk=lbrda.pk, user_id=lbrda.user_id),
        )

    lbrda.refresh_from_db()
    converted = AssetReadModel.objects.get(write_model_pk=lbrda.pk)
    assert lbrda.code == converted.code == "CHTR"
    assert converted.quantity_balance == Decimal("163")
    assert converted.metadata_id == metadata.pk
    assert lbrda.transactions.count() == 1
```

- [ ] **Step 10: Test accounting preservation instead of checking it at runtime**

Extend the happy-path test by capturing these values before dispatch:

```python
before = AssetReadModel.objects.get(write_model_pk=lbrda.pk)
read_model_fields = (
    "normalized_total_bought",
    "normalized_total_sold",
    "normalized_closed_roi",
    "credited_incomes",
    "normalized_credited_incomes",
)
before_read_values = {
    field: getattr(before, field)
    for field in read_model_fields
}
before_transaction_totals = Transaction.objects.filter(
    asset=lbrda
).aggregate_normalized_totals()
original_transaction = Transaction.objects.get(
    asset=lbrda,
    operation_date=date(2024, 1, 10),
)
original_values = (
    original_transaction.pk,
    original_transaction.quantity,
    original_transaction.price,
    original_transaction.irpf_price,
    original_transaction.current_currency_conversion_rate,
)
```

After dispatch, assert:

```python
assert {
    field: getattr(converted, field)
    for field in read_model_fields
} == before_read_values

after_transaction_totals = Transaction.objects.filter(
    asset=lbrda
).aggregate_normalized_totals()
for field in (
    "total_bought",
    "normalized_total_bought",
    "irpf_total_bought",
    "irpf_normalized_total_bought",
    "normalized_total_sold",
):
    assert after_transaction_totals[field] == before_transaction_totals[field]

original_transaction.refresh_from_db()
assert (
    original_transaction.pk,
    original_transaction.quantity,
    original_transaction.price,
    original_transaction.irpf_price,
    original_transaction.current_currency_conversion_rate,
) == original_values
```

These are test assertions, not validations performed by the command handler.

- [ ] **Step 11: Test collision handling and atomic rollback**

Append:

```python
def test_convert_asset_rejects_destination_collision(lbrda, user):
    AssetFactory(
        code="CHTR",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        objective=AssetObjectives.growth,
        user=user,
    )

    with pytest.raises(AssetCodeTypeCurrencyAlreadyExistsException):
        with db_transaction.atomic():
            messagebus.handle(
                message=make_command(lbrda),
                uow=DjangoUnitOfWork(asset_pk=lbrda.pk, user_id=lbrda.user_id),
            )

    lbrda.refresh_from_db()
    assert lbrda.code == "LBRDA"
    assert lbrda.transactions.count() == 1


def test_convert_asset_rolls_back_when_sync_event_fails(lbrda, mocker):
    mocker.patch(
        "variable_income_assets.integrations.helpers.fetch_asset_sector",
        return_value=AssetSectors.communication,
    )
    mocker.patch(
        "variable_income_assets.integrations.helpers.fetch_asset_current_price",
        return_value=Decimal("250"),
    )
    mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model",
        side_effect=RuntimeError("rebuild failed"),
    )

    with pytest.raises(RuntimeError, match="rebuild failed"):
        with db_transaction.atomic():
            messagebus.handle(
                message=make_command(lbrda),
                uow=DjangoUnitOfWork(asset_pk=lbrda.pk, user_id=lbrda.user_id),
            )

    lbrda.refresh_from_db()
    assert lbrda.code == "LBRDA"
    assert lbrda.transactions.count() == 1
    assert not AssetMetaData.objects.filter(
        code="CHTR",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
    ).exists()
```

Import `AssetCodeTypeCurrencyAlreadyExistsException` from `..domain.exceptions`. The outer Django atomic block is required because synchronous event handlers run after the command handler asks the UoW to commit; it keeps the command and `AssetConverted` handlers in one database transaction.

- [ ] **Step 12: Run the complete command-flow tests**

```bash
cd django
USE_POSTGRES=1 uv run pytest variable_income_assets/tests/test__asset_conversion.py -v
```

Expected: all tests PASS.

- [ ] **Step 13: Review the task diff**

```bash
git diff -- django/variable_income_assets/domain/commands.py django/variable_income_assets/domain/events.py django/variable_income_assets/domain/models.py django/variable_income_assets/service_layer/handlers.py django/variable_income_assets/service_layer/messagebus.py django/variable_income_assets/tests/test__asset_conversion.py
```

Verify the command handler contains no rebalance implementation, `Asset.rebalance_quantity` owns the factor arithmetic, the ordered event handler persists the returned DTO through the UoW, unchanged quantity creates no adjustment, and neither `TransactionsCreated` nor any new transaction action is used.

- [ ] **Step 14: Commit only if explicitly authorized**

```bash
git add django/variable_income_assets/domain/commands.py django/variable_income_assets/domain/events.py django/variable_income_assets/domain/models.py django/variable_income_assets/service_layer/handlers.py django/variable_income_assets/service_layer/messagebus.py django/variable_income_assets/tests/test__asset_conversion.py
git commit -m "feat: add asset conversion command"
```

Skip this step unless the user explicitly asks for a commit.
---

### Task 2: Conversion serializer and detail endpoint

**Files:**
- Modify: `django/variable_income_assets/serializers.py`
- Modify: `django/variable_income_assets/views.py`
- Modify: `django/variable_income_assets/tests/e2e/test_asset_endpoints.py`

**Interfaces:**
- Consumes: `ConvertAsset`, `messagebus.handle`, and `DjangoUnitOfWork` from Task 1.
- Produces: `AssetConversionSerializer` and `POST /api/assets/{asset_id}/convert` accepting `{code: string, resulting_quantity: positive decimal string, operation_date: YYYY-MM-DD}` and returning HTTP 204.

- [ ] **Step 1: Write the failing endpoint test**

Add `TransactionActions` to the existing choices import; import `AssetFactory`, `AssetMetaDataFactory`, and `TransactionFactory` from `..conftest`; and import `upsert_asset_read_model` from `...service_layer.tasks`. Then append:

```python
def test__convert_asset(client, user, mocker):
    asset = AssetFactory(
        code="LBRDA",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        objective=AssetObjectives.growth,
        user=user,
    )
    AssetMetaDataFactory(
        code="LBRDA",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        sector=AssetSectors.communication,
        current_price=Decimal("35.99"),
    )
    TransactionFactory(
        asset=asset,
        action=TransactionActions.buy,
        quantity=Decimal("163"),
        price=Decimal("59.39964531"),
        irpf_price=Decimal("59.39964531"),
        current_currency_conversion_rate=Decimal("5.59"),
        operation_date=timezone.localdate() - relativedelta(days=10),
    )
    upsert_asset_read_model(asset_id=asset.pk)
    mocker.patch(
        "variable_income_assets.integrations.helpers.fetch_asset_sector",
        return_value=AssetSectors.communication,
    )
    mocker.patch(
        "variable_income_assets.integrations.helpers.fetch_asset_current_price",
        return_value=Decimal("250"),
    )

    response = client.post(
        f"{URL}/{asset.pk}/convert",
        data={
            "code": "chtr",
            "resulting_quantity": "38.468",
            "operation_date": timezone.localdate().isoformat(),
        },
    )

    assert response.status_code == HTTP_204_NO_CONTENT
    asset.refresh_from_db()
    converted = AssetReadModel.objects.get(write_model_pk=asset.pk)
    assert asset.code == converted.code == "CHTR"
    assert converted.quantity_balance == Decimal("38.468")
    assert converted.metadata.code == "CHTR"
```

- [ ] **Step 2: Run the endpoint test and verify RED**

```bash
cd django
USE_POSTGRES=1 uv run pytest variable_income_assets/tests/e2e/test_asset_endpoints.py::test__convert_asset -v
```

Expected: HTTP 404 because the detail action does not exist.

- [ ] **Step 3: Add the serializer**

Add these imports to `django/variable_income_assets/serializers.py`:

```python
from dataclasses import replace

from django.db import transaction as djtransaction
```

Add this class immediately before `AssetSerializer`:

```python
class AssetConversionSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=200)
    resulting_quantity = serializers.DecimalField(
        max_digits=15,
        decimal_places=8,
        min_value=Decimal("0.00000001"),
    )
    operation_date = serializers.DateField()

    def validate_code(self, value: str) -> str:
        code = value.strip().upper()
        if not code:
            raise serializers.ValidationError("O código de destino é obrigatório")
        if any(character.isspace() for character in code):
            raise serializers.ValidationError("O código não pode conter espaços")
        if self.instance is not None and code == self.instance.code:
            raise serializers.ValidationError("Informe um código diferente do atual")
        return code

    def validate(self, attrs: dict) -> dict:
        if self.instance is None:
            return attrs

        read_model = AssetReadModel.objects.select_related("metadata").get(
            write_model_pk=self.instance.pk
        )
        if (
            self.instance.type == choices.AssetTypes.fixed_br
            or read_model.is_held_in_self_custody
            or read_model.quantity_balance <= 0
        ):
            raise serializers.ValidationError(
                {"asset": "Apenas posições abertas com quantidade podem ser convertidas"}
            )
        return attrs

    def update(self, instance: Asset, validated_data: dict) -> Asset:
        try:
            with djtransaction.atomic():
                locked_source = Asset.objects.select_for_update().get(
                    pk=instance.pk
                )
                source = Asset.objects.annotate_for_domain().get(
                    pk=locked_source.pk
                )
                destination = replace(
                    source.to_domain(),
                    code=validated_data["code"],
                )
                messagebus.handle(
                    message=commands.ConvertAsset(
                        asset=destination,
                        db_instance=locked_source,
                        factor=(
                            validated_data["resulting_quantity"]
                            / source.quantity_balance
                        ),
                        operation_date=validated_data["operation_date"],
                    ),
                    uow=DjangoUnitOfWork(
                        asset_pk=instance.pk,
                        user_id=instance.user_id,
                    ),
                )
        except DomainValidationError as exc:
            raise serializers.ValidationError(exc.detail) from exc

        instance.refresh_from_db()
        return instance
```

Positive resulting quantity is enforced here, and the serializer translates it into the command's factor. Equality with the current quantity produces factor `1`; the rebalance event handler then creates no adjustment transaction.
The source row is locked before reading its current quantity, so the factor, code update, synchronous event handlers, and read-model rebuild all use one atomic database state.

- [ ] **Step 4: Add the detail action**

Update `AssetViewSet` in `django/variable_income_assets/views.py`:

```python
def _is_write_action(self) -> bool:
    return self.action in (
        "create",
        "update",
        "destroy",
        "update_price",
        "convert",
    )

def get_serializer_class(self):
    if self.action == "list":
        return serializers.AssetReadModelSerializer
    if self.action == "convert":
        return serializers.AssetConversionSerializer
    return serializers.AssetSerializer

@action(methods=("POST",), detail=True)
def convert(self, request: Request, pk: int | None = None) -> Response:
    serializer = self.get_serializer(
        instance=self.get_object(),
        data=request.data,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(status=HTTP_204_NO_CONTENT)
```

Do not add conversion-specific ownership logic. The existing write-action queryset already scopes `self.get_object()` to the authenticated user's assets.

- [ ] **Step 5: Run the successful endpoint test**

```bash
cd django
USE_POSTGRES=1 uv run pytest variable_income_assets/tests/e2e/test_asset_endpoints.py::test__convert_asset -v
```

Expected: PASS.

- [ ] **Step 6: Test serializer validation and ticker-only conversion**

Append:

```python
@pytest.fixture
def convertible_asset(user):
    asset = AssetFactory(
        code="LBRDA",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        objective=AssetObjectives.growth,
        user=user,
    )
    AssetMetaDataFactory(
        code="LBRDA",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        sector=AssetSectors.communication,
        current_price=Decimal("35.99"),
    )
    TransactionFactory(
        asset=asset,
        action=TransactionActions.buy,
        quantity=Decimal("163"),
        price=Decimal("59.39964531"),
        current_currency_conversion_rate=Decimal("5.59"),
        operation_date=timezone.localdate(),
    )
    upsert_asset_read_model(asset_id=asset.pk)
    return asset


@pytest.mark.parametrize("resulting_quantity", ("0", "-1"))
def test__convert_asset__requires_positive_resulting_quantity(
    convertible_asset,
    client,
    resulting_quantity,
):
    response = client.post(
        f"{URL}/{convertible_asset.pk}/convert",
        data={
            "code": "CHTR",
            "resulting_quantity": resulting_quantity,
            "operation_date": timezone.localdate().isoformat(),
        },
    )

    assert response.status_code == HTTP_400_BAD_REQUEST
    assert "resulting_quantity" in response.json()


def test__convert_asset__allows_same_quantity(convertible_asset, client):
    AssetMetaDataFactory(
        code="CHTR",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        sector=AssetSectors.communication,
        current_price=Decimal("250"),
    )

    response = client.post(
        f"{URL}/{convertible_asset.pk}/convert",
        data={
            "code": "CHTR",
            "resulting_quantity": "163",
            "operation_date": timezone.localdate().isoformat(),
        },
    )

    assert response.status_code == HTTP_204_NO_CONTENT
    convertible_asset.refresh_from_db()
    assert convertible_asset.code == "CHTR"
    assert convertible_asset.transactions.count() == 1
```

- [ ] **Step 7: Test existing queryset scoping without adding ownership code**

Append:

```python
def test__convert_asset__does_not_expose_another_users_asset(
    convertible_asset,
    kucoin_client,
):
    response = kucoin_client.post(
        f"{URL}/{convertible_asset.pk}/convert",
        data={
            "code": "CHTR",
            "resulting_quantity": "38.468",
            "operation_date": timezone.localdate().isoformat(),
        },
    )

    assert response.status_code == HTTP_404_NOT_FOUND
```

This is a regression test for the existing `AssetViewSet.get_queryset()` behavior, not a conversion validation.

- [ ] **Step 8: Run the endpoint module**

```bash
cd django
USE_POSTGRES=1 uv run pytest variable_income_assets/tests/e2e/test_asset_endpoints.py -v
```

Expected: all tests PASS.

- [ ] **Step 9: Review the task diff**

```bash
git diff -- django/variable_income_assets/serializers.py django/variable_income_assets/views.py django/variable_income_assets/tests/e2e/test_asset_endpoints.py
```

Verify positive quantity is serializer-owned, equal quantity is accepted, no latest-transaction-date rule exists, and the view contains no new ownership validation.

- [ ] **Step 10: Commit only if explicitly authorized**

```bash
git add django/variable_income_assets/serializers.py django/variable_income_assets/views.py django/variable_income_assets/tests/e2e/test_asset_endpoints.py
git commit -m "feat: expose asset conversion endpoint"
```

Skip this step unless the user explicitly asks for a commit.
---

### Task 3: Frontend contract, validation, preview math, and invalidation

**Files:**
- Modify: `react/src/pages/private/Assets/api/types.ts`
- Modify: `react/src/pages/private/Assets/api/index.ts`
- Modify: `react/src/pages/private/Assets/Table/hooks.ts`
- Create: `react/src/pages/private/Assets/Table/AssetConversionDialog/logic.ts`
- Create: `react/src/pages/private/Assets/Table/AssetConversionDialog/logic.test.ts`

**Interfaces:**
- Consumes: `POST /api/assets/{asset_id}/convert` from Task 2 and the existing asset/report/history invalidation hooks.
- Produces: `AssetConversionInput`, `convertAsset({id, data}): Promise<void>`, `AssetConversionFormValues`, `buildAssetConversionSchema(currentCode)`, `buildConversionPreview(currentQuantity, resultingQuantity)`, `buildConversionConfirmation(currentCode, destinationCode, currentQuantity, resultingQuantity)`, `toRawDateString(date)`, `getAssetConversionErrorMessage(error)`, and `useInvalidateAssetConversionQueries()`.

- [ ] **Step 1: Write the failing pure-logic test**

Create `react/src/pages/private/Assets/Table/AssetConversionDialog/logic.test.ts`:

```typescript
import {
  buildAssetConversionSchema,
  buildConversionConfirmation,
  buildConversionPreview,
  getAssetConversionErrorMessage,
  runAssetConversionInvalidations,
  toRawDateString,
} from "./logic";

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
};

const assertRejects = async (
  action: () => Promise<unknown>,
  expectedMessage: string,
) => {
  try {
    await action();
  } catch (error) {
    assertEqual((error as Error).message, expectedMessage, "validation message");
    return;
  }
  throw new Error(`expected rejection: ${expectedMessage}`);
};

const preview = buildConversionPreview(163, 38.468);
assertEqual(preview.factor, 0.236, "conversion factor");
assertEqual(preview.adjustment, -124.532, "quantity adjustment");
assertEqual(
  buildConversionConfirmation("LBRDA", "CHTR", 163, 38.468),
  "LBRDA será alterado permanentemente para CHTR e a quantidade mudará de 163 para 38.468. O aplicativo não oferece desfazer.",
  "confirmation copy",
);
assertEqual(toRawDateString(new Date(2026, 7, 19)), "2026-08-19", "local date");

const schema = buildAssetConversionSchema("LBRDA");
await assertRejects(
  () =>
    schema.validate({
      code: "lbrda",
      resulting_quantity: 38.468,
      operation_date: new Date(2026, 7, 19),
    }),
  "Informe um código diferente do atual",
);
const sameQuantity = await schema.validate({
  code: "CHTR",
  resulting_quantity: 163,
  operation_date: new Date(2026, 7, 19),
});
assertEqual(
  sameQuantity.resulting_quantity,
  163,
  "ticker-only conversion allows unchanged quantity",
);

assertEqual(
  getAssetConversionErrorMessage({
    response: { data: { operation_date: "A data da conversão é inválida" } },
  }),
  "A data da conversão é inválida",
  "API field error",
);

const calls: string[] = [];
await runAssetConversionInvalidations([
  async () => {
    calls.push("assets");
  },
  async () => {
    calls.push("minimal-data");
  },
  async () => {
    calls.push("transactions");
  },
  async () => {
    calls.push("incomes");
  },
  async () => {
    calls.push("asset-history");
  },
]);
assertEqual(calls.join(","), "assets,minimal-data,transactions,incomes,asset-history", "cache invalidations");

// eslint-disable-next-line no-console
console.log("logic.test.ts passed");
```

- [ ] **Step 2: Run the logic test and verify RED**

```bash
cd react
yarn dlx tsx src/pages/private/Assets/Table/AssetConversionDialog/logic.test.ts
```

Expected: FAIL because `./logic` does not exist.

- [ ] **Step 3: Implement validation, preview, date, error, and invalidation helpers**

Create `react/src/pages/private/Assets/Table/AssetConversionDialog/logic.ts`:

```typescript
import * as yup from "yup";

import type { RawDateString } from "../../../../../types";

export type AssetConversionFormValues = {
  code: string;
  resulting_quantity: number;
  operation_date: Date;
};

const roundToEightPlaces = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000;

export const buildConversionPreview = (
  currentQuantity: number,
  resultingQuantity: number,
): { factor: number; adjustment: number } => ({
  factor: roundToEightPlaces(resultingQuantity / currentQuantity),
  adjustment: roundToEightPlaces(resultingQuantity - currentQuantity),
});

export const buildConversionConfirmation = (
  currentCode: string,
  destinationCode: string,
  currentQuantity: number,
  resultingQuantity: number,
): string =>
  `${currentCode} será alterado permanentemente para ${destinationCode.toUpperCase()} ` +
  `e a quantidade mudará de ${currentQuantity} para ${resultingQuantity}. ` +
  "O aplicativo não oferece desfazer.";

export const buildAssetConversionSchema = (
  currentCode: string,
) =>
  yup.object({
    code: yup
      .string()
      .trim()
      .uppercase()
      .required("O código de destino é obrigatório")
      .notOneOf(
        [currentCode.toUpperCase()],
        "Informe um código diferente do atual",
      ),
    resulting_quantity: yup
      .number()
      .typeError("Quantidade inválida")
      .required("A quantidade resultante é obrigatória")
      .positive("A quantidade resultante deve ser positiva"),
    operation_date: yup
      .date()
      .typeError("Data inválida")
      .required("A data efetiva é obrigatória"),
  });

export const toRawDateString = (date: Date): RawDateString => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as RawDateString;
};

type ApiError = {
  response?: { data?: Record<string, string | string[]> };
};

export const getAssetConversionErrorMessage = (error: unknown): string => {
  const data = (error as ApiError)?.response?.data;
  const firstValue = data ? Object.values(data)[0] : undefined;
  if (Array.isArray(firstValue)) return firstValue.join("; ");
  return firstValue ?? "Não foi possível converter o ativo";
};

export const runAssetConversionInvalidations = async (
  invalidators: ReadonlyArray<() => Promise<unknown>>,
): Promise<void> => {
  await Promise.all(invalidators.map((invalidate) => invalidate()));
};
```

- [ ] **Step 4: Add the API request type and function**

Replace `react/src/pages/private/Assets/api/types.ts` with:

```typescript
import type { RawDateString } from "../../../../types";

import type { SimulatedAsset } from "./models";

export type SimulatedAssetResponse = {
  old: SimulatedAsset;
  new: SimulatedAsset;
};

export type AssetConversionInput = {
  code: string;
  resulting_quantity: number;
  operation_date: RawDateString;
};
```

Add the type import and function to `react/src/pages/private/Assets/api/index.ts`:

```typescript
import type { AssetConversionInput } from "./types";

export const convertAsset = async ({
  id,
  data,
}: {
  id: number;
  data: AssetConversionInput;
}): Promise<void> => {
  await apiProvider.post(`${RESOURCE}/${id}/convert`, data);
};
```

- [ ] **Step 5: Add the complete conversion invalidation hook**

Add imports to `react/src/pages/private/Assets/Table/hooks.ts`:

```typescript
import { useInvalidateAssetsTotalInvestedHistory } from "../Reports/AssetTotalInvestedSnapshots/hooks";
import { useInvalidateAssetsMinimalDataQueries } from "../forms/hooks";
import { INCOMES_QUERY_KEY } from "../../Incomes/consts";
import { useInvalidateTransactionsQueries } from "../../Transactions/Table/hooks";
import { runAssetConversionInvalidations } from "./AssetConversionDialog/logic";
```

Then append:

```typescript
export const useInvalidateAssetConversionQueries = () => {
  const queryClient = useQueryClient();
  const { invalidate: invalidateAssets } = useInvalidateAssetsQueries();
  const { invalidate: invalidateMinimalData } =
    useInvalidateAssetsMinimalDataQueries();
  const { invalidate: invalidateTransactions } =
    useInvalidateTransactionsQueries();
  const { invalidate: invalidateAssetHistory } =
    useInvalidateAssetsTotalInvestedHistory();
  const invalidateIncomes = useCallback(
    () => queryClient.invalidateQueries({ queryKey: [INCOMES_QUERY_KEY] }),
    [queryClient],
  );

  const invalidate = useCallback(
    () =>
      runAssetConversionInvalidations([
        invalidateAssets,
        invalidateMinimalData,
        () => invalidateTransactions({}),
        invalidateIncomes,
        invalidateAssetHistory,
      ]),
    [
      invalidateAssetHistory,
      invalidateAssets,
      invalidateIncomes,
      invalidateMinimalData,
      invalidateTransactions,
    ],
  );

  return { invalidate };
};
```

`invalidateAssets` covers the assets list and its nested tables, reports, and indicators. `invalidateTransactions` covers the global transaction table, transaction reports, histories, and indicators; the explicit incomes invalidation refreshes rows whose serialized asset code changed. Reloading the assets list also retrieves the destination metadata and current price.

- [ ] **Step 6: Run the pure-logic test and verify GREEN**

```bash
cd react
yarn dlx tsx src/pages/private/Assets/Table/AssetConversionDialog/logic.test.ts
```

Expected output: `logic.test.ts passed`.

- [ ] **Step 7: Type-check and lint the frontend changes**

```bash
cd react
yarn lint
yarn build
```

Expected: both commands exit 0.

- [ ] **Step 8: Review the task diff**

```bash
git diff -- react/src/pages/private/Assets/api/types.ts react/src/pages/private/Assets/api/index.ts react/src/pages/private/Assets/Table/hooks.ts react/src/pages/private/Assets/Table/AssetConversionDialog/logic.ts react/src/pages/private/Assets/Table/AssetConversionDialog/logic.test.ts
```

Verify date serialization uses the local calendar date, the example produces factor `0.236` and adjustment `-124.532`, and all conversion-dependent query families are invalidated.

- [ ] **Step 9: Commit only if explicitly authorized**

```bash
git add react/src/pages/private/Assets/api/types.ts react/src/pages/private/Assets/api/index.ts react/src/pages/private/Assets/Table/hooks.ts react/src/pages/private/Assets/Table/AssetConversionDialog/logic.ts react/src/pages/private/Assets/Table/AssetConversionDialog/logic.test.ts
git commit -m "feat: add asset conversion client contract"
```

Skip this step unless the user explicitly asks for a commit.

---

### Task 4: Conversion dialog and asset-table row action

**Files:**
- Create: `react/src/pages/private/Assets/Table/AssetConversionDialog/index.tsx`
- Modify: `react/src/pages/private/Assets/Table/index.tsx`

**Interfaces:**
- Consumes: `convertAsset`, `AssetConversionFormValues`, `buildAssetConversionSchema`, `buildConversionPreview`, `buildConversionConfirmation`, `toRawDateString`, `getAssetConversionErrorMessage`, and `useInvalidateAssetConversionQueries` from Task 3.
- Produces: `AssetConversionDialog({asset, open, onClose})` and a `Convert asset` row action for eligible open quantity-based assets.

- [ ] **Step 1: Create the conversion dialog**

Create `react/src/pages/private/Assets/Table/AssetConversionDialog/index.tsx`:

```tsx
import { useMemo } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";

import { DateInput } from "../../../../../design-system";
import useFormPlus from "../../../../../hooks/useFormPlus";
import { convertAsset } from "../../api";
import type { Asset } from "../../api/models";
import { useInvalidateAssetConversionQueries } from "../hooks";
import {
  type AssetConversionFormValues,
  buildAssetConversionSchema,
  buildConversionConfirmation,
  buildConversionPreview,
  getAssetConversionErrorMessage,
  toRawDateString,
} from "./logic";

const FORM_ID = "asset-conversion-form";

const AssetConversionDialog = ({
  asset,
  open,
  onClose,
}: {
  asset: Asset;
  open: boolean;
  onClose: () => void;
}) => {
  const schema = useMemo(
    () => buildAssetConversionSchema(asset.code),
    [asset.code],
  );
  const { invalidate } = useInvalidateAssetConversionQueries();
  const {
    control,
    handleSubmit,
    mutate,
    isPending,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
    watch,
  } = useFormPlus({
    mutationFn: convertAsset,
    schema,
    defaultValues: {
      code: "",
      resulting_quantity: asset.quantity_balance,
      operation_date: new Date(),
    },
    onSuccess: async () => {
      await invalidate();
      enqueueSnackbar("Ativo convertido com sucesso", { variant: "success" });
      onClose();
    },
    onError: (error) => {
      enqueueSnackbar(getAssetConversionErrorMessage(error), {
        variant: "error",
      });
    },
  });

  const destinationCode = String(watch("code") || "").trim().toUpperCase();
  const resultingQuantity = Number(watch("resulting_quantity"));
  const hasPreview =
    Number.isFinite(resultingQuantity) && resultingQuantity > 0;
  const preview = hasPreview
    ? buildConversionPreview(asset.quantity_balance, resultingQuantity)
    : null;

  const submit = (values: AssetConversionFormValues) => {
    mutate({
      id: asset.write_model_pk,
      data: {
        code: values.code.trim().toUpperCase(),
        resulting_quantity: values.resulting_quantity,
        operation_date: toRawDateString(values.operation_date),
      },
    });
  };

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Converter ativo</DialogTitle>
      <DialogContent>
        <Stack
          id={FORM_ID}
          component="form"
          spacing={2}
          sx={{ pt: 1 }}
          noValidate
          onSubmit={handleSubmit(submit)}
        >
          <Stack direction="row" spacing={2}>
            <TextField
              label="Código atual"
              value={asset.code}
              variant="standard"
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Quantidade atual"
              value={asset.quantity_balance}
              variant="standard"
              fullWidth
              InputProps={{ readOnly: true }}
            />
          </Stack>
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Código de destino"
                variant="standard"
                required
                error={isFieldInvalid(field)}
                helperText={getErrorMessage(field.name)}
                inputProps={{ sx: { textTransform: "uppercase" } }}
              />
            )}
          />
          <Controller
            name="resulting_quantity"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Quantidade resultante"
                type="number"
                variant="standard"
                required
                error={isFieldInvalid(field)}
                helperText={getErrorMessage(field.name)}
                inputProps={{ min: 0, step: "any" }}
              />
            )}
          />
          <DateInput
            control={control}
            name="operation_date"
            label="Data efetiva"
          />
          {getFieldHasError("operation_date") && (
            <FormHelperText error>
              {getErrorMessage("operation_date")}
            </FormHelperText>
          )}
          {preview && (
            <Stack spacing={0.5}>
              <Typography>{`Fator: ${preview.factor.toLocaleString("pt-br", {
                maximumFractionDigits: 8,
              })}`}</Typography>
              <Typography>{`Ajuste: ${preview.adjustment.toLocaleString("pt-br", {
                maximumFractionDigits: 8,
              })}`}</Typography>
            </Stack>
          )}
          {preview && destinationCode && (
            <Alert severity="warning">
              {buildConversionConfirmation(
                asset.code,
                destinationCode,
                asset.quantity_balance,
                resultingQuantity,
              )}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="brand-text" disabled={isPending} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="danger-text"
          type="submit"
          form={FORM_ID}
          disabled={isPending}
        >
          {isPending ? <CircularProgress size={24} /> : "Converter ativo"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetConversionDialog;
```

- [ ] **Step 2: Add the row-action state and icon**

In `react/src/pages/private/Assets/Table/index.tsx`, add:

```tsx
import TransformIcon from "@mui/icons-material/Transform";

import AssetConversionDialog from "./AssetConversionDialog";
```

Add the selected-asset state beside `assetToUpdatePrice`:

```tsx
const [assetToConvert, setAssetToConvert] = useState<Asset>();
```

- [ ] **Step 3: Configure the table row action**

Add these properties to the existing `useTable({...})` call in `react/src/pages/private/Assets/Table/index.tsx`:

```tsx
enableRowActions: true,
positionActionsColumn: "last",
displayColumnDefOptions: {
  "mrt-row-expand": { size: 10 },
  "mrt-row-actions": { size: 40 },
},
```

Add `actions: ""` to the existing `localization` object. Add this callback beside `renderDetailPanel`:

```tsx
renderRowActions: ({ row }) => {
  const asset = row.original as Asset;
  const canConvert =
    !asset.is_held_in_self_custody &&
    asset.type !== "Renda fixa BR" &&
    asset.quantity_balance > 0;

  return canConvert ? (
    <Tooltip title="Converter ativo">
      <IconButton
        aria-label={`Converter ${asset.code}`}
        sx={{ color: getColor(Colors.neutral300) }}
        onClick={() => setAssetToConvert(asset)}
      >
        <TransformIcon />
      </IconButton>
    </Tooltip>
  ) : null;
},
```

- [ ] **Step 4: Render and close the dialog**

Render this next to `AssetUpdatePriceDrawer` at the bottom of `react/src/pages/private/Assets/Table/index.tsx`:

```tsx
{assetToConvert && (
  <AssetConversionDialog
    asset={assetToConvert}
    open={!!assetToConvert}
    onClose={() => setAssetToConvert(undefined)}
  />
)}
```

- [ ] **Step 5: Run frontend verification**

```bash
cd react
yarn dlx tsx src/pages/private/Assets/Table/AssetConversionDialog/logic.test.ts
yarn lint
yarn build
```

Expected: the logic test prints `logic.test.ts passed`; lint and build exit 0.

- [ ] **Step 6: Verify the interaction locally**

Run the existing application stack, sign in, and open the Assets table. On an open LBRDA row:

1. Confirm the **Convert asset** icon is shown; confirm it is absent for fixed-income/self-custody rows.
2. Enter `CHTR`, `38.468`, and `19/08/2026`.
3. Confirm the preview displays factor `0,236` and adjustment `-124,532`.
4. Confirm the warning names LBRDA, CHTR, both quantities, and the lack of application-level undo.
5. Submit once and verify the same table row changes to CHTR with quantity 38.468.
6. Submit invalid data and verify both inline validation and an API error snackbar are visible.

Do not perform this verification against production data. Use a local database fixture or disposable development record.

- [ ] **Step 7: Review the task diff**

```bash
git diff -- react/src/pages/private/Assets/Table/AssetConversionDialog/index.tsx react/src/pages/private/Assets/Table/index.tsx
```

Verify the action appears only for eligible rows, pending submission cannot be repeated, cancel is disabled during submission, and success closes the dialog only after all caches are invalidated.

- [ ] **Step 8: Commit only if explicitly authorized**

```bash
git add react/src/pages/private/Assets/Table/AssetConversionDialog/index.tsx react/src/pages/private/Assets/Table/index.tsx
git commit -m "feat: add asset conversion row action"
```

Skip this step unless the user explicitly asks for a commit.

---

### Task 5: End-to-end regression and scope verification

**Files:**
- Verify: all files changed in Tasks 1–4
- Verify unchanged: `django/variable_income_assets/models/`, `django/variable_income_assets/choices.py`, and all migration directories

**Interfaces:**
- Consumes: the conversion command/event/UoW flow, endpoint, frontend client, invalidation hook, dialog, and row action from Tasks 1–4.
- Produces: evidence that the full feature satisfies the design without a schema change, new transaction action, new asset, economic sale, or accounting drift.

- [ ] **Step 1: Run focused backend tests**

```bash
cd django
USE_POSTGRES=1 uv run pytest variable_income_assets/tests/test__asset_conversion.py variable_income_assets/tests/e2e/test_asset_endpoints.py -v
```

Expected: all focused command/event/UoW and endpoint tests PASS.

- [ ] **Step 2: Run the complete variable-income test suite**

```bash
cd django
USE_POSTGRES=1 uv run pytest variable_income_assets/tests -v
```

Expected: all tests PASS.

- [ ] **Step 3: Verify Django detects no schema change**

```bash
cd django
uv run python manage.py makemigrations --check --dry-run
```

Expected: exit 0 and `No changes detected`.

- [ ] **Step 4: Run complete frontend checks**

```bash
cd react
yarn dlx tsx src/pages/private/Assets/Table/AssetConversionDialog/logic.test.ts
yarn lint
yarn build
```

Expected: `logic.test.ts passed`; lint and build exit 0.

- [ ] **Step 5: Audit the final diff against the non-goals**

```bash
git diff --check
git status --short
git diff --stat
git diff -- django/variable_income_assets/models django/variable_income_assets/choices.py django/variable_income_assets/migrations
```

Expected:

- `git diff --check` has no output.
- The models, choices, and migrations diff has no output.
- There is no corporate-action model, conversion transaction action, automatic undo, second user asset, or historical-transaction rewrite.
- The only new transaction is the zero-cost `BUY` quantity delta attached to the existing asset primary key.
- The design spec and implementation plan remain uncommitted unless the user has explicitly requested a commit.

- [ ] **Step 6: Re-run the exact LBRDA acceptance test**

```bash
cd django
USE_POSTGRES=1 uv run pytest variable_income_assets/tests/test__asset_conversion.py::test_convert_asset_command_changes_existing_asset -v
```

Expected: PASS, demonstrating one asset with the same primary key, ticker `CHTR`, resulting quantity `38.468`, adjustment `-124.532`, factor `0.236`, destination metadata/current price, and unchanged raw/BRL/IRPF cost and ROI/income totals.

- [ ] **Step 7: Report completion without committing**

Report the exact verification commands and results, list the changed files, and call out that no commit or database mutation was performed by the implementation workflow. Only create commits if the user separately and explicitly authorizes them.
