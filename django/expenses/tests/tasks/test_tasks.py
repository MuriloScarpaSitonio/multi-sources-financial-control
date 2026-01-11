from datetime import date

from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta

from authentication.choices import SubscriptionStatus

from ...models import Expense, Revenue
from ...service_layer.tasks import (
    create_fixed_expenses_from_last_month,
    create_fixed_revenues_from_last_month,
    decrement_credit_card_bill_for_account,
)
from ...tasks.bank_account import decrement_credit_card_bill_today

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


class TestDecrementCreditCardBillForAccount:
    def test__decrements_bank_account(self, user, bank_account, expenses_w_installments):
        # GIVEN
        previous_bank_account_amount = bank_account.amount
        expense1, expense2, expense3, expense4, expense5 = expenses_w_installments
        base_date = date(year=2023, month=3, day=5)

        # Associate expenses with bank account
        for exp in expenses_w_installments:
            exp.bank_account = bank_account
            exp.save()

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
        decrement_credit_card_bill_for_account(bank_account=bank_account, base_date=base_date)

        # THEN
        bank_account.refresh_from_db()
        assert (
            previous_bank_account_amount - (expense1.value + expense2.value) == bank_account.amount
        )

    def test__end_of_march(self, user, bank_account, expenses_w_installments):
        # GIVEN
        previous_bank_account_amount = bank_account.amount
        expense1, expense2, expense3, expense4, expense5 = expenses_w_installments
        base_date = date(year=2023, month=3, day=30)

        # Associate expenses with bank account
        for exp in expenses_w_installments:
            exp.bank_account = bank_account
            exp.save()

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
        decrement_credit_card_bill_for_account(bank_account=bank_account, base_date=base_date)

        # THEN
        bank_account.refresh_from_db()
        assert (
            previous_bank_account_amount - (expense1.value + expense2.value) == bank_account.amount
        )

    def test__january(self, user, bank_account, expenses_w_installments):
        # GIVEN
        previous_bank_account_amount = bank_account.amount
        expense1, expense2, expense3, expense4, expense5 = expenses_w_installments
        base_date = date(year=2023, month=1, day=2)

        # Associate expenses with bank account
        for exp in expenses_w_installments:
            exp.bank_account = bank_account
            exp.save()

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
        decrement_credit_card_bill_for_account(bank_account=bank_account, base_date=base_date)

        # THEN
        bank_account.refresh_from_db()
        assert (
            previous_bank_account_amount - (expense1.value + expense2.value + expense3.value)
            == bank_account.amount
        )

    def test__only_decrements_expenses_for_specific_account(
        self, user, bank_account, second_bank_account, expenses_w_installments
    ):
        # GIVEN
        previous_bank_account_amount = bank_account.amount
        previous_second_account_amount = second_bank_account.amount
        expense1, expense2, expense3, expense4, expense5 = expenses_w_installments
        base_date = date(year=2023, month=3, day=5)

        # Associate some expenses with bank_account, some with second_bank_account
        expense1.bank_account = bank_account
        expense1.created_at = base_date - relativedelta(days=1)
        expense1.save()

        expense2.bank_account = second_bank_account  # Different account
        expense2.created_at = base_date - relativedelta(days=1)
        expense2.save()

        # WHEN
        decrement_credit_card_bill_for_account(bank_account=bank_account, base_date=base_date)

        # THEN
        bank_account.refresh_from_db()
        second_bank_account.refresh_from_db()

        # Only bank_account should be decremented
        assert previous_bank_account_amount - expense1.value == bank_account.amount
        # second_bank_account should be unchanged
        assert previous_second_account_amount == second_bank_account.amount


class TestDecrementCreditCardBillToday:
    @pytest.fixture(autouse=True)
    def set_user_subscription_active(self, user):
        """Task requires user to have ACTIVE subscription status."""
        user.subscription_status = SubscriptionStatus.ACTIVE
        user.save(update_fields=["subscription_status"])

    def test__processes_accounts_with_matching_billing_day(
        self, user, bank_account, expenses_w_installments
    ):
        # GIVEN
        today = timezone.localdate()
        bank_account.credit_card_bill_day = today.day
        bank_account.save()
        previous_amount = bank_account.amount

        expense = expenses_w_installments[0]
        expense.bank_account = bank_account
        expense.created_at = today - relativedelta(days=1)
        expense.save()

        # WHEN
        decrement_credit_card_bill_today()

        # THEN
        bank_account.refresh_from_db()
        assert previous_amount - expense.value == bank_account.amount

    def test__does_not_process_accounts_without_billing_day(
        self, user, bank_account, expenses_w_installments
    ):
        # GIVEN
        today = timezone.localdate()
        bank_account.credit_card_bill_day = None
        bank_account.save()
        previous_amount = bank_account.amount

        expense = expenses_w_installments[0]
        expense.bank_account = bank_account
        expense.created_at = today - relativedelta(days=1)
        expense.save()

        # WHEN
        decrement_credit_card_bill_today()

        # THEN
        bank_account.refresh_from_db()
        assert previous_amount == bank_account.amount

    def test__does_not_process_accounts_with_different_billing_day(
        self, user, bank_account, expenses_w_installments
    ):
        # GIVEN
        today = timezone.localdate()
        different_day = (today.day % 28) + 1  # A different day than today
        bank_account.credit_card_bill_day = different_day
        bank_account.save()
        previous_amount = bank_account.amount

        expense = expenses_w_installments[0]
        expense.bank_account = bank_account
        expense.created_at = today - relativedelta(days=1)
        expense.save()

        # WHEN
        decrement_credit_card_bill_today()

        # THEN
        bank_account.refresh_from_db()
        assert previous_amount == bank_account.amount

    def test__does_not_process_inactive_accounts(self, user, bank_account, expenses_w_installments):
        # GIVEN
        today = timezone.localdate()
        bank_account.credit_card_bill_day = today.day
        bank_account.is_active = False
        bank_account.save()
        previous_amount = bank_account.amount

        expense = expenses_w_installments[0]
        expense.bank_account = bank_account
        expense.created_at = today - relativedelta(days=1)
        expense.save()

        # WHEN
        decrement_credit_card_bill_today()

        # THEN
        bank_account.refresh_from_db()
        assert previous_amount == bank_account.amount

    def test__handles_end_of_month_billing_days(
        self, user, bank_account, expenses_w_installments, mocker
    ):
        # GIVEN
        # Mock today as Feb 28 (last day of Feb in non-leap year)
        mock_date = date(year=2023, month=2, day=28)
        mocker.patch("expenses.tasks.bank_account.timezone.localdate", return_value=mock_date)

        # Account with billing day 31 should be processed on Feb 28
        bank_account.credit_card_bill_day = 31
        bank_account.save()
        previous_amount = bank_account.amount

        expense = expenses_w_installments[0]
        expense.bank_account = bank_account
        expense.created_at = mock_date - relativedelta(days=1)
        expense.save()

        # WHEN
        decrement_credit_card_bill_today()

        # THEN
        bank_account.refresh_from_db()
        assert previous_amount - expense.value == bank_account.amount

    def test__processes_multiple_accounts(
        self, user, bank_account, second_bank_account, expenses_w_installments
    ):
        # GIVEN
        today = timezone.localdate()
        bank_account.credit_card_bill_day = today.day
        bank_account.save()
        second_bank_account.credit_card_bill_day = today.day
        second_bank_account.save()

        previous_amount1 = bank_account.amount
        previous_amount2 = second_bank_account.amount

        expense1 = expenses_w_installments[0]
        expense1.bank_account = bank_account
        expense1.created_at = today - relativedelta(days=1)
        expense1.save()

        expense2 = expenses_w_installments[1]
        expense2.bank_account = second_bank_account
        expense2.created_at = today - relativedelta(days=1)
        expense2.save()

        # WHEN
        decrement_credit_card_bill_today()

        # THEN
        bank_account.refresh_from_db()
        second_bank_account.refresh_from_db()
        assert previous_amount1 - expense1.value == bank_account.amount
        assert previous_amount2 - expense2.value == second_bank_account.amount
