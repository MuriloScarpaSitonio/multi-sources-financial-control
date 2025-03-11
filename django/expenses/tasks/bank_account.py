from __future__ import annotations

import calendar
from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.utils import timezone

from shared.exceptions import NotFirstDayOfMonthException

from ..models import BankAccount, BankAccountSnapshot
from ..service_layer.tasks import decrement_credit_card_bill

if TYPE_CHECKING:
    from datetime import date


UserModel = get_user_model()


def decrement_credit_card_bill_today() -> None:
    today = timezone.localdate()
    last_day_of_month = calendar.monthrange(year=today.year, month=today.month)[1]
    if today.day == last_day_of_month and last_day_of_month < 31:
        query = {"credit_card_bill_day__in": tuple(range(today.day, 32))}
    else:
        query = {"credit_card_bill_day": today.day}

    for user_id in (
        UserModel.objects.filter_personal_finances_active()
        .filter(**query)
        .values_list("pk", flat=True)
    ):
        decrement_credit_card_bill(user_id=user_id, base_date=today)


def create_bank_account_snapshot_for_all_users() -> None:
    operation_date = timezone.localdate()
    if operation_date.day != 1:
        raise NotFirstDayOfMonthException

    for user_id in UserModel.objects.filter_personal_finances_active().values_list("pk", flat=True):
        _create_bank_account_snapshot(user_id=user_id, operation_date=operation_date)


def _create_bank_account_snapshot(user_id: int, operation_date: date) -> None:
    bank_account = BankAccount.objects.only("amount").get(user_id=user_id)
    BankAccountSnapshot.objects.create(
        user_id=user_id, operation_date=operation_date, total=bank_account.amount
    )
