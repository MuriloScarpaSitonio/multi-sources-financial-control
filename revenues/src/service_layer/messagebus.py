from __future__ import annotations
import logging
from typing import List, Dict, Callable, Type, Union, TYPE_CHECKING
from ..domain import commands
from . import handlers

if TYPE_CHECKING:
    from . import unit_of_work

logger = logging.getLogger(__name__)

Message = commands.Command


def handle(message: Message, uow: unit_of_work.AbstractUnitOfWork):
    queue = [message]
    while queue:
        message = queue.pop(0)
        # if isinstance(message, events.Event):
        #     handle_event(message, queue, uow)
        if False:
            pass
        elif isinstance(message, commands.Command):
            handle_command(message, queue, uow)
        else:
            raise Exception(f"{message} was not an Event or Command")


# def handle_event(
#     event: events.Event,
#     queue: List[Message],
#     uow: unit_of_work.AbstractUnitOfWork,
# ):
#     for handler in EVENT_HANDLERS[type(event)]:
#         try:
#             logger.debug("handling event %s with handler %s", event, handler)
#             handler(event, uow=uow)
#             queue.extend(uow.collect_new_events())
#         except Exception:
#             logger.exception("Exception handling event %s", event)
#             continue


def handle_command(
    command: commands.Command,
    queue: List[Message],
    uow: unit_of_work.AbstractUnitOfWork,
):
    try:
        handler = COMMAND_HANDLERS[type(command)]
        handler(command, uow=uow)
        # queue.extend(uow.collect_new_events())
    except Exception:
        logger.exception("Exception handling command %s", command)
        raise


# EVENT_HANDLERS = {
#     events.Allocated: [
#         handlers.publish_allocated_event,
#         handlers.add_allocation_to_read_model,
#     ],
#     events.Deallocated: [
#         handlers.remove_allocation_from_read_model,
#         handlers.reallocate,
#     ],
#     events.OutOfStock: [handlers.send_out_of_stock_notification],
# }  # type: Dict[Type[events.Event], List[Callable]]

COMMAND_HANDLERS: Dict[Type[commands.Command], Callable] = {
    commands.CreateRevenue: handlers.create_revenue
}
