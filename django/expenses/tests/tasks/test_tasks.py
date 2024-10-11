from datetime import date

from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta

from ...choices import ExpenseSource
from ...models import Expense, Revenue
from ...service_layer.tasks import (
    create_fixed_expenses_from_last_month,
    create_fixed_revenues_from_last_month,
    decrement_credit_card_bill,
)

pytestmark = pytest.mark.django_db


@pytest.mark.usefixtures("expenses_w_installments", "fixed_expenses_wo_delta")
def test__create_fixed_expenses_from_last_month(user):
    # GIVEN
    today = timezone.localdate()
    fixed_qs = Expense.objects.filter(is_fixed=True)
    fixed_count = fixed_qs.count()
    non_fixed_qs = Expense.objects.filter(is_fixed=False)
    non_fixed_count = non_fixed_qs.count()

    # WHEN
    create_fixed_expenses_from_last_month(user_id=user.pk)

    # THEN
    latest_created_at = Expense.objects.only("created_at").latest("created_at").created_at
    assert latest_created_at.replace(day=1) == (today + relativedelta(years=1)).replace(day=1)

    assert fixed_qs.count() == fixed_count + 1

    assert non_fixed_count > 0
    assert non_fixed_count == non_fixed_qs.count()


@pytest.mark.skip("Skip while we don't have properly fixed revenues flow")
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


def test__decrement_credit_card_bill(user, bank_account, expenses_w_installments):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    expense1, expense2, expense3, expense4, expense5 = expenses_w_installments
    base_date = date(year=2023, month=3, day=5)

    expense1.created_at = base_date - relativedelta(days=1)
    expense1.save()

    expense2.created_at = base_date - relativedelta(months=1)
    expense2.save()

    # should not include the current day because it'll be included in the next month
    expense3.created_at = base_date
    expense3.save()

    expense4.created_at = base_date
    expense4.save()

    expense5.created_at = base_date
    expense5.save()

    # WHEN
    decrement_credit_card_bill(user_id=user.pk, base_date=base_date)

    # THEN
    bank_account.refresh_from_db()
    assert previous_bank_account_amount - (expense1.value + expense2.value) == bank_account.amount


def test__decrement_credit_card_bill__end_of_march(user, bank_account, expenses_w_installments):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    expense1, expense2, expense3, expense4, expense5 = expenses_w_installments
    base_date = date(year=2023, month=3, day=30)

    expense1.created_at = base_date - relativedelta(days=1)
    expense1.save()

    # should include even as 30 > 28
    expense2.created_at = date(year=2023, month=2, day=28)
    expense2.save()

    # should not include the current day because it'll be included in the next month
    expense3.created_at = base_date
    expense3.save()

    expense4.created_at = base_date
    expense4.save()

    expense5.created_at = base_date
    expense5.save()

    # WHEN
    decrement_credit_card_bill(user_id=user.pk, base_date=base_date)

    # THEN
    bank_account.refresh_from_db()
    assert previous_bank_account_amount - (expense1.value + expense2.value) == bank_account.amount


def test__decrement_credit_card_bill__january(user, bank_account, expenses_w_installments):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    expense1, expense2, expense3, expense4, expense5 = expenses_w_installments
    base_date = date(year=2023, month=1, day=2)

    expense1.created_at = base_date - relativedelta(days=1)
    expense1.save()

    # should include even if another year
    expense2.created_at = date(year=2022, month=12, day=2)
    expense2.save()

    expense3.created_at = date(year=2022, month=12, day=31)
    expense3.save()

    # should not include the current day because it'll be included in the next month
    expense4.created_at = base_date
    expense4.save()

    expense5.created_at = date(year=2022, month=12, day=1)
    expense5.save()

    # WHEN
    decrement_credit_card_bill(user_id=user.pk, base_date=base_date)

    # THEN
    bank_account.refresh_from_db()
    assert (
        previous_bank_account_amount - (expense1.value + expense2.value + expense3.value)
        == bank_account.amount
    )
