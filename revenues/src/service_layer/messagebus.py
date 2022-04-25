from __future__ import annotations

from typing import List, Dict, Callable, Type, Union, TYPE_CHECKING

from ..domain.commands import Command, CreateRevenue
from ..domain.events import Event, RevenueCreated
from .handlers import create_revenue, post_revenues_to_agilize, send_email_to_accountant

if TYPE_CHECKING:  # pragma: no cover
    from .unit_of_work import AbstractUnitOfWork

# region: types

Message = Union[Command, Event]

# endregion: types

# region: maps

EVENT_HANDLERS: Dict[Type[Event], List[Callable]] = {
    RevenueCreated: [post_revenues_to_agilize, send_email_to_accountant]
}

COMMAND_HANDLERS: Dict[Type[Command], Callable] = {CreateRevenue: create_revenue}

# endregion: maps

# region: handlers


def handle(message: Message, uow: AbstractUnitOfWork) -> None:
    queue = [message]
    while queue:
        message = queue.pop(0)
        if isinstance(message, Event):
            handle_event(event=message, queue=queue, uow=uow)

        elif isinstance(message, Command):
            handle_command(command=message, queue=queue, uow=uow)


def handle_event(event: Event, queue: List[Message], uow: AbstractUnitOfWork) -> None:
    for handler in EVENT_HANDLERS[type(event)]:
        _handle_message(handler=handler, message=event, queue=queue, uow=uow)


def handle_command(command: Command, queue: List[Message], uow: AbstractUnitOfWork) -> None:
    _handle_message(handler=COMMAND_HANDLERS[type(command)], message=command, queue=queue, uow=uow)


def _handle_message(
    handler: Callable, message: Message, queue: List[Message], uow: AbstractUnitOfWork
) -> None:
    try:
        handler(message, uow=uow)
        queue.extend(uow.collect_new_events())
    except Exception as e:  # pragma: no cover
        print(f"Exception handling message {message}: {e.__class__}, {e}")


# endregion: handlers
