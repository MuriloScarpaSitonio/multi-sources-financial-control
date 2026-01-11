from __future__ import annotations

from typing import TYPE_CHECKING

from dateutil.relativedelta import relativedelta

from ...choices import CREDIT_CARD_SOURCE
from ...models import Expense
from ...service_layer.unit_of_work import ExpenseUnitOfWork

if TYPE_CHECKING:
    from datetime import date

    from ...models import BankAccount


def decrement_credit_card_bill_for_account(bank_account: BankAccount, base_date: date) -> None:
    """Sum credit card expenses for this account and decrement."""
    yesterday = base_date - relativedelta(days=1)
    last_month_date = base_date - relativedelta(months=1)

    qs = Expense.objects.filter(
        bank_account=bank_account,
        source=CREDIT_CARD_SOURCE,
        created_at__range=(last_month_date, yesterday),
    )

    with ExpenseUnitOfWork(user_id=bank_account.user_id, bank_account_id=bank_account.pk) as uow:
        uow.bank_account.decrement(value=qs.sum()["total"])
        uow.commit()
