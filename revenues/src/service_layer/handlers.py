from dataclasses import asdict

from .unit_of_work import AbstractUnitOfWork
from ..adapters import agilize_client
from ..adapters.email import send as send_email
from ..domain.commands import CreateRevenue
from ..domain.events import RevenueCreated
from ..domain.models import Revenue
from ..settings import ACCOUNTANT_EMAIL


def create_revenue(cmd: CreateRevenue, uow: AbstractUnitOfWork) -> None:
    with uow:
        revenue = Revenue(**cmd.dict())
        uow.revenues.add(revenue)
        uow.commit()


def post_revenues_to_agilize(event: RevenueCreated, **__) -> None:
    agilize_client.post(data=asdict(event))


def send_email_to_accountant(event: RevenueCreated, **__) -> None:
    send_email(
        email=ACCOUNTANT_EMAIL, content=f'Revenue "{event.description}" of R${event.value} created.'
    )
