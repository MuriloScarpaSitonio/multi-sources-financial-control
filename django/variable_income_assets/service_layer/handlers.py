from datetime import date
from uuid import uuid4

from django.utils import timezone

from dateutil.relativedelta import relativedelta

from tasks.choices import TaskStates
from tasks.models import TaskHistory

from ..choices import AssetTypes
from ..domain import commands, events
from ..models import Transaction
from .tasks import (
    create_asset_closed_operation,
    maybe_create_asset_metadata,
    update_total_invested_snapshot_from_diff,
    upsert_asset_read_model,
)
from .unit_of_work import AbstractUnitOfWork


def create_transactions(cmd: commands.CreateTransactions, uow: AbstractUnitOfWork) -> None:
    with uow:
        for dto in cmd.asset._transactions:
            uow.assets.transactions.add(dto=dto)

        if cmd.dispatch_event:
            cmd.asset.events.append(
                events.TransactionsCreated(
                    asset_pk=uow.asset_pk,
                    operation_date=dto.operation_date,
                    quantity_diff=dto.quantity,
                )
            )

        uow.assets.seen.add(cmd.asset)
        uow.commit()


def update_transaction(cmd: commands.UpdateTransaction, uow: AbstractUnitOfWork) -> Transaction:
    with uow:
        dto = cmd.asset._transactions[0]
        uow.assets.transactions.update(dto=dto, entity=cmd.transaction)
        cmd.asset.events.append(
            events.TransactionUpdated(
                asset_pk=uow.asset_pk,
                operation_date=dto.operation_date,
                quantity_diff=dto.quantity - cmd.transaction.quantity,
            )
        )
        uow.assets.seen.add(cmd.asset)
        uow.commit()
    return cmd.transaction


def delete_transaction(cmd: commands.DeleteTransaction, uow: AbstractUnitOfWork) -> None:
    with uow:
        uow.assets.transactions.delete(entity=cmd.transaction)
        cmd.asset.events.append(
            events.TransactionDeleted(
                asset_pk=uow.asset_pk,
                operation_date=cmd.transaction.operation_date,
                quantity_diff=-cmd.transaction.quantity,
            )
        )
        uow.assets.seen.add(cmd.asset)
        uow.commit()


# TODO: convert to async
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
    ),
    _: AbstractUnitOfWork,
) -> None:
    upsert_asset_read_model(
        asset_id=event.asset_pk,
        is_aggregate_upsert=(
            not isinstance(event, (events.AssetCreated | events.AssetUpdated))
            # It's possible that the `Asset` is created together with the first
            # `Transaction` or `PassiveIncome` via an integration.
            # If that's the case then we need to use `None` so all fields are updated.
            # I prefered to do this together with these events other than emiting
            # an specific event (i.e. `events.AssetCreated`) which would call this
            # function with `is_aggregate_upsert=False` - and would thus update the
            # `Asset`'s specific fields first because, in a production environment,
            # these events would be processed asynchronously which means that
            # unless we use some sort of `FIFO` queue we might process
            # `events.TransactionsCreated | events.PassiveIncomeCreated` before
            # `events.AssetCreated` even if the latter was emitted first
            if not getattr(event, "new_asset", False)
            else None
        ),
    )


# TODO: convert to async
def check_monthly_selling_transaction_threshold(
    _: events.TransactionsCreated, uow: AbstractUnitOfWork
) -> None:  # pragma: no cover
    transaction = next(iter(uow.assets.transactions.seen))
    total_sold = next(
        iter(
            Transaction.objects.filter(
                asset__user_id=transaction.asset.user_id,
                created_at__year=transaction.created_at.year,
                created_at__month=transaction.created_at.month,
            )
            .aggregate_total_sold_per_type(only={transaction.asset.type})
            .values()
        )
    )

    choice = AssetTypes.get_choice(transaction.asset.type)
    if total_sold > choice.monthly_sell_threshold:
        TaskHistory.objects.create(
            id=uuid4(),
            name=f"above_monthly_sell_threshold_for_{choice.value.lower()}",
            state=TaskStates.success,
            finished_at=timezone.now(),
            created_by_id=transaction.asset.user_id,
        )


# TODO: convert to async
def maybe_create_metadata(event: events.AssetCreated, _: AbstractUnitOfWork) -> None:
    maybe_create_asset_metadata(event.asset_pk)


# TODO: convert to async
def create_asset_operation_closed_record(
    event: events.AssetOperationClosed, _: AbstractUnitOfWork
) -> None:
    create_asset_closed_operation(asset_pk=event.asset_pk)


# TODO: convert to async
def maybe_update_snapshot(
    event: events.TransactionsCreated | events.TransactionUpdated | events.TransactionDeleted,
    _: AbstractUnitOfWork,
):

    first_day_of_month = timezone.localdate() - relativedelta(day=1)
    if event.operation_date.month != first_day_of_month.month:
        if isinstance(event, events.TransactionUpdated) and not event.quantity_diff:
            return
        update_total_invested_snapshot_from_diff(
            asset_pk=event.asset_pk,
            snapshot_operation_date=date(event.operation_date.year, event.operation_date.month, 1),
            quantity_diff=event.quantity_diff,
        )
