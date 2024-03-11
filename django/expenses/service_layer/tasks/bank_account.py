from __future__ import annotations

from typing import TYPE_CHECKING

from dateutil.relativedelta import relativedelta

from ...choices import ExpenseSource
from ...models import Expense
from ...service_layer.unit_of_work import ExpenseUnitOfWork

if TYPE_CHECKING:
    from datetime import date


# TODO: run this every day for every eligble users
def decrement_credit_card_bill(user_id: int, base_date: date) -> None:
    yesterday = base_date - relativedelta(days=1)
    last_month_date = base_date - relativedelta(months=1)
    qs = Expense.objects.filter(
        user_id=user_id,
        source=ExpenseSource.credit_card,
        created_at__range=(last_month_date, yesterday),
    )
    with ExpenseUnitOfWork(user_id=user_id) as uow:
        uow.bank_account.decrement(value=qs.sum()["total"])
        uow.commit()
