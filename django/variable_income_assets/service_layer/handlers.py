from typing import Union

from .unit_of_work import AbstractUnitOfWork
from ..domain import commands, events
from ..models import Transaction
from ..tasks import upsert_assets_read_model


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
    event: Union[events.TransactionsCreated, events.TransactionDeleted, events.TransactionUpdated],
    _: AbstractUnitOfWork,
) -> None:
    upsert_assets_read_model.delay(asset_ids=(event.asset_pk,))
