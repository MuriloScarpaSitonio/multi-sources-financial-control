from __future__ import annotations

from typing import Any, List, Dict, Callable, Type, Union

from . import handlers
from .unit_of_work import AbstractUnitOfWork
from ..domain import commands, events

# region: types

Message = Union[commands.Command, events.Event]
MessageCallable = Callable[[Any, AbstractUnitOfWork], Any]

# endregion: types

# region: maps

EVENT_HANDLERS: Dict[Type[events.Event], List[MessageCallable]] = {
    events.TransactionsCreated: [
        handlers.upsert_read_model,
        # handlers.check_monthly_selling_transaction_threshold,
    ],
    events.TransactionUpdated: [
        handlers.upsert_read_model,
        # handlers.check_monthly_selling_transaction_threshold,
    ],
    events.TransactionDeleted: [handlers.upsert_read_model],
    events.PassiveIncomeCreated: [handlers.upsert_read_model],
    events.PassiveIncomeUpdated: [handlers.upsert_read_model],
    events.PassiveIncomeDeleted: [handlers.upsert_read_model],
    events.AssetCreated: [handlers.upsert_read_model],
    events.AssetUpdated: [handlers.upsert_read_model],
}

COMMAND_HANDLERS: Dict[Type[commands.Command], MessageCallable] = {
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


def handle_event(event: events.Event, queue: List[Message], uow: AbstractUnitOfWork) -> None:
    for handler in EVENT_HANDLERS[event.__class__]:
        _handle_message(handler=handler, message=event, queue=queue, uow=uow)


def handle_command(
    command: commands.Command, queue: List[Message], uow: AbstractUnitOfWork
) -> None:
    _handle_message(
        handler=COMMAND_HANDLERS[command.__class__], message=command, queue=queue, uow=uow
    )


def _handle_message(
    handler: MessageCallable, message: Message, queue: List[Message], uow: AbstractUnitOfWork
) -> None:
    handler(message, uow)
    queue.extend(uow.collect_new_events())
    # TODO: log error


# endregion: handlers
