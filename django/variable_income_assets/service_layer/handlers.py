from typing import Union
from uuid import uuid4

from django.utils import timezone

from tasks.choices import TaskStates
from tasks.models import TaskHistory

from .unit_of_work import AbstractUnitOfWork
from ..choices import AssetTypes
from ..domain import commands, events
from ..models import Transaction
from ..tasks import upsert_asset_read_model


def create_transactions(cmd: commands.CreateTransactions, uow: AbstractUnitOfWork) -> Transaction:
    with uow:
        for dto in cmd.asset._transactions:
            uow.assets.transactions.add(dto=dto)

        cmd.asset.events.append(events.TransactionsCreated(asset_pk=uow.asset_pk))
        uow.assets.seen.add(cmd.asset)
        uow.commit()


def update_transaction(cmd: commands.UpdateTransaction, uow: AbstractUnitOfWork) -> Transaction:
    with uow:
        uow.assets.transactions.update(dto=cmd.asset._transactions[0], transaction=cmd.transaction)
        cmd.asset.events.append(events.TransactionUpdated(asset_pk=uow.asset_pk))
        uow.assets.seen.add(cmd.asset)
        uow.commit()
    return cmd.transaction


def delete_transaction(cmd: commands.DeleteTransaction, uow: AbstractUnitOfWork) -> None:
    with uow:
        uow.assets.transactions.delete(transaction=cmd.transaction)
        cmd.asset.events.append(events.TransactionUpdated(asset_pk=uow.asset_pk))
        uow.assets.seen.add(cmd.asset)
        uow.commit()


def upsert_read_model(
    event: Union[
        events.TransactionsCreated,
        events.TransactionDeleted,
        events.TransactionUpdated,
        events.PassiveIncomeCreated,
        events.PassiveIncomeUpdated,
        events.PassiveIncomeDeleted,
        events.AssetCreated,
        events.AssetUpdated,
    ],
    _: AbstractUnitOfWork,
) -> None:
    upsert_asset_read_model.delay(
        asset_id=event.asset_pk,
        is_aggregate_upsert=not isinstance(event, (events.AssetCreated, events.AssetUpdated)),
    )


def check_monthly_selling_transaction_threshold(
    _: events.TransactionsCreated, uow: AbstractUnitOfWork
):
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
