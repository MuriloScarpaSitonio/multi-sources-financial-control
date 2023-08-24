from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta

from expenses.models import Expense
from expenses.tasks import create_fixed_expenses_from_last_month

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
