from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone

from shared.exceptions import NotFirstDayOfMonthException

from ..service_layer.tasks import create_fixed_expenses_from_last_month


def create_fixed_expenses_from_last_month_to_all_users():
    if timezone.localdate().day != 1:
        raise NotFirstDayOfMonthException

    for user_id in (
        get_user_model().objects.filter_personal_finances_active().values_list("pk", flat=True)
    ):
        create_fixed_expenses_from_last_month(user_id=user_id)
