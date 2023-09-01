from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta

from ..models import Expense, Revenue
from ..tasks import (
    create_fixed_expenses_from_last_month,
    create_fixed_revenues_from_last_month,
)

pytestmark = pytest.mark.django_db


def test__create_fixed_expenses_from_last_month(user, expense, another_expense):
    # GIVEN
    today = timezone.localdate()

    expense.created_at = expense.created_at - relativedelta(months=1)
    expense.save()

    another_expense.created_at = another_expense.created_at - relativedelta(months=1)
    another_expense.save()

    # WHEN
    create_fixed_expenses_from_last_month(user_id=user.pk)

    # THEN
    assert Expense.objects.count() == 4
    assert (
        Expense.objects.filter(
            user_id=user.pk,
            is_fixed=True,
            created_at__month=today.month,
            created_at__year=today.year,
        ).count()
        == 2
    )


def test__create_fixed_revenues_from_last_month(user, revenue):
    # GIVEN
    today = timezone.localdate()

    revenue.created_at = revenue.created_at - relativedelta(months=1)
    revenue.save()

    # WHEN
    create_fixed_revenues_from_last_month(user_id=user.pk)

    # THEN
    assert Revenue.objects.count() == 2
    assert (
        Revenue.objects.filter(
            user_id=user.pk,
            is_fixed=True,
            created_at__month=today.month,
            created_at__year=today.year,
        ).count()
        == 1
    )
