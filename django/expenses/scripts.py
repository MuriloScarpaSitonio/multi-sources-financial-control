import calendar

from django.contrib.auth import get_user_model
from django.utils import timezone

from shared.exceptions import NotFirstDayOfMonthException

from .service_layer.tasks import (
    create_fixed_expenses_from_last_month,
    create_fixed_revenues_from_last_month,
    decrement_credit_card_bill,
)

UserModel = get_user_model()


def create_all_fixed_entities_from_last_month():
    if timezone.localdate().day != 1:
        raise NotFirstDayOfMonthException

    for user_id in UserModel.objects.filter_personal_finances_active().values_list("pk", flat=True):
        create_fixed_expenses_from_last_month(user_id=user_id)
        create_fixed_revenues_from_last_month(user_id=user_id)


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
