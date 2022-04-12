from dataclasses import asdict

from .unit_of_work import AbstractUnitOfWork
from ..domain.commands import CreateRevenue as CreateRevenueCommand
from ..domain.models import Revenue


def create_revenue(cmd: CreateRevenueCommand, uow: AbstractUnitOfWork) -> None:
    with uow:
        d = asdict(cmd)
        user_id = d.pop("user_id")
        revenue = Revenue(**d)
        revenue.user_id = user_id
        uow.session.add(revenue)
        uow.commit()
