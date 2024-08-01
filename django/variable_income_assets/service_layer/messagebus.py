from __future__ import annotations

from collections.abc import Callable
from typing import Any

from ..domain import commands, events
from . import handlers
from .unit_of_work import AbstractUnitOfWork

# region: types

Message = commands.Command | events.Event
MessageCallable = Callable[[Any, AbstractUnitOfWork], Any]

# endregion: types

# region: maps

EVENT_HANDLERS: dict[type[events.Event], list[MessageCallable]] = {
    events.TransactionsCreated: [
        handlers.upsert_read_model,
        # handlers.maybe_update_snapshot,
        # handlers.check_monthly_selling_transaction_threshold,
    ],
    events.TransactionUpdated: [
        handlers.upsert_read_model,
        # handlers.maybe_update_snapshot,
        # handlers.check_monthly_selling_transaction_threshold,
    ],
    events.TransactionDeleted: [
        handlers.upsert_read_model,
        # handlers.maybe_update_snapshot,
    ],
    events.PassiveIncomeCreated: [handlers.upsert_read_model],
    events.PassiveIncomeUpdated: [handlers.upsert_read_model],
    events.PassiveIncomeDeleted: [handlers.upsert_read_model],
    events.AssetCreated: [handlers.maybe_create_metadata, handlers.upsert_read_model],
    events.AssetUpdated: [handlers.maybe_create_metadata, handlers.upsert_read_model],
    events.AssetOperationClosed: [handlers.create_asset_operation_closed_record],
}

COMMAND_HANDLERS: dict[type[commands.Command], MessageCallable] = {
    commands.CreateTransactions: handlers.create_transactions,
    commands.UpdateTransaction: handlers.update_transaction,
    commands.DeleteTransaction: handlers.delete_transaction,
}


# endregion: maps


# region: handlers


def handle(message: Message, uow: AbstractUnitOfWork) -> None:
    queue = [message]
    while queue:
        message = queue.pop(0)
        if isinstance(message, events.Event):
            handle_event(event=message, queue=queue, uow=uow)

        elif isinstance(message, commands.Command):
            handle_command(command=message, queue=queue, uow=uow)


def handle_event(event: events.Event, queue: list[Message], uow: AbstractUnitOfWork) -> None:
    for handler in EVENT_HANDLERS[event.__class__]:
        _handle_message(handler=handler, message=event, queue=queue, uow=uow, sync=event.sync)


def handle_command(
    command: commands.Command, queue: list[Message], uow: AbstractUnitOfWork
) -> None:
    _handle_message(
        handler=COMMAND_HANDLERS[command.__class__],
        message=command,
        queue=queue,
        uow=uow,
        sync=True,
    )


def _handle_message(
    handler: MessageCallable,
    message: Message,
    queue: list[Message],
    uow: AbstractUnitOfWork,
    sync: bool,
) -> None:
    if sync:
        handler(message, uow)
    else:
        _dispatch_async(handler, message, uow)
    queue.extend(uow.collect_new_events())
    # TODO: log error


# TODO: implement queue or whatever
def _dispatch_async(handler: MessageCallable, message: Message, uow: AbstractUnitOfWork) -> None:
    handler(message, uow)


# endregion: handlers
