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
    events.ExpenseCreated: [handlers.maybe_decrement_bank_account],
    events.ExpenseUpdated: [handlers.maybe_change_bank_account],
    events.ExpenseDeleted: [handlers.maybe_increment_bank_account],
    events.RevenueCreated: [handlers.increment_bank_account],
    events.RevenueUpdated: [handlers.decrement_bank_account],
    events.RevenueDeleted: [handlers.decrement_bank_account],
    events.ExpenseCategoryUpdated: [handlers.change_all_expenses_categories],
    events.ExpenseSourceUpdated: [handlers.change_all_expenses_sources],
    events.RevenueCategoryUpdated: [handlers.change_all_revenues_categories],
}

COMMAND_HANDLERS: dict[type[commands.Command], MessageCallable] = {
    commands.CreateExpense: handlers.create_expense,
    commands.UpdateExpense: handlers.update_expense,
    commands.DeleteExpense: handlers.delete_expense,
    commands.CreateFutureFixedRevenues: handlers.create_future_fixed_revenues,
    commands.UpdateFutureFixedRevenues: handlers.update_future_fixed_revenues,
    commands.DeleteFutureFixedRevenues: handlers.delete_future_fixed_revenues,
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
        _handle_message(handler=handler, message=event, queue=queue, uow=uow, sync=True)


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
def _dispatch_async(
    handler: MessageCallable,
    message: Message,
    uow: AbstractUnitOfWork,
) -> None:
    handler(message, uow)


# endregion: handlers
