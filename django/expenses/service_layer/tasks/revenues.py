from django.utils import timezone

from ...domain.events import RevenueCreated
from ...models import Revenue
from ...service_layer import messagebus
from ...service_layer.unit_of_work import RevenueUnitOfWork
from .shared import create_fixed_entities_from_last_month


def create_fixed_revenues_from_last_month(user_id: int):
    revenues: list[Revenue] = create_fixed_entities_from_last_month(user_id=user_id, model=Revenue)
    today = timezone.localdate()
    for revenue in revenues:
        if revenue.created_at != today:
            # TODO: how to increment bank account when a future revenue is created?
            continue

        with RevenueUnitOfWork(user_id=user_id) as uow:
            # uow.bank_account.increment(value=revenue.value)
            messagebus.handle(message=RevenueCreated(value=revenue.value), uow=uow)
