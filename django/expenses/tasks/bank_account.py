from __future__ import annotations

import calendar
from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.utils import timezone

from authentication.choices import SubscriptionStatus
from shared.exceptions import NotFirstDayOfMonthException

from ..models import BankAccount, BankAccountSnapshot
from ..service_layer.tasks import decrement_credit_card_bill_for_account

if TYPE_CHECKING:
    from datetime import date


UserModel = get_user_model()


def decrement_credit_card_bill_today() -> None:
    """Runs daily. Processes each bank account with billing_day matching today."""
    today = timezone.localdate()
    last_day_of_month = calendar.monthrange(year=today.year, month=today.month)[1]

    # Handle month-end edge case (e.g., billing_day=31 on a 28-day month)
    if today.day == last_day_of_month and last_day_of_month < 31:
        bill_days = tuple(range(today.day, 32))
    else:
        bill_days = (today.day,)

    # Find accounts with billing_day matching today and user has active subscription
    accounts = BankAccount.objects.filter(
        credit_card_bill_day__in=bill_days,
        is_active=True,
        user__is_active=True,
        user__is_personal_finances_module_enabled=True,
        user__subscription_status=SubscriptionStatus.ACTIVE,
    )

    for account in accounts:
        decrement_credit_card_bill_for_account(bank_account=account, base_date=today)


def create_bank_account_snapshot_for_all_users() -> None:
    """Creates aggregate snapshot of all active bank accounts per user on 1st of month."""
    operation_date = timezone.localdate()
    if operation_date.day != 1:
        raise NotFirstDayOfMonthException

    for user_id in UserModel.objects.filter_personal_finances_active().values_list("pk", flat=True):
        _create_bank_account_snapshot(user_id=user_id, operation_date=operation_date)


def _create_bank_account_snapshot(user_id: int, operation_date: date) -> None:
    """Create aggregate snapshot (sum of all active accounts for user)."""
    total = BankAccount.objects.get_total(user_id=user_id)
    BankAccountSnapshot.objects.create(user_id=user_id, operation_date=operation_date, total=total)
