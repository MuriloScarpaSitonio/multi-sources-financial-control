from decimal import Decimal

import pytest
from django.utils import timezone

from ...choices import CREDIT_CARD_SOURCE, MONEY_SOURCE
from ...domain import events
from ...domain.models import Expense as ExpenseDomain
from ...service_layer.handlers import (
    decrement_bank_account,
    increment_bank_account,
    maybe_change_bank_account,
    maybe_decrement_bank_account,
    maybe_increment_bank_account,
)
from ...service_layer.unit_of_work import ExpenseUnitOfWork, RevenueUnitOfWork

pytestmark = pytest.mark.django_db


class TestMaybeDecrementBankAccount:
    def test__decrements_specific_bank_account(self, user, bank_account, second_bank_account):
        # GIVEN
        today = timezone.localdate()
        expense = ExpenseDomain(
            description="Test",
            value=Decimal("100"),
            category="Casa",
            created_at=today,
            source=MONEY_SOURCE,
            installments_qty=1,
            extra_data={"bank_account_id": bank_account.id},
        )
        event = events.ExpenseCreated(expense=expense)
        uow = ExpenseUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount
        second_previous_amount = second_bank_account.amount

        # WHEN
        maybe_decrement_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        second_bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount - Decimal("100")
        assert second_bank_account.amount == second_previous_amount  # unchanged

    def test__does_not_decrement_without_bank_account_id(self, user, bank_account):
        # GIVEN
        today = timezone.localdate()
        expense = ExpenseDomain(
            description="Test",
            value=Decimal("100"),
            category="Casa",
            created_at=today,
            source=MONEY_SOURCE,
            installments_qty=1,
            extra_data={},  # No bank_account_id
        )
        event = events.ExpenseCreated(expense=expense)
        uow = ExpenseUnitOfWork(user_id=user.id)  # No bank_account_id
        previous_amount = bank_account.amount

        # WHEN
        maybe_decrement_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount  # unchanged

    def test__decrements_for_credit_card_source_current_month(self, user, bank_account):
        # GIVEN - credit card expenses in current month do change bank account
        today = timezone.localdate()
        expense = ExpenseDomain(
            description="Test",
            value=Decimal("100"),
            category="Casa",
            created_at=today,
            source=CREDIT_CARD_SOURCE,
            installments_qty=1,
            extra_data={"bank_account_id": bank_account.id},
        )
        event = events.ExpenseCreated(expense=expense)
        uow = ExpenseUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount

        # WHEN
        maybe_decrement_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount - Decimal("100")


class TestMaybeIncrementBankAccount:
    def test__increments_specific_bank_account(self, user, bank_account, second_bank_account):
        # GIVEN
        today = timezone.localdate()
        expense = ExpenseDomain(
            description="Test",
            value=Decimal("100"),
            category="Casa",
            created_at=today,
            source=MONEY_SOURCE,
            installments_qty=1,
            extra_data={"bank_account_id": bank_account.id},
        )
        event = events.ExpenseDeleted(expense=expense)
        uow = ExpenseUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount
        second_previous_amount = second_bank_account.amount

        # WHEN
        maybe_increment_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        second_bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount + Decimal("100")
        assert second_bank_account.amount == second_previous_amount  # unchanged

    def test__increments_for_credit_card_source_current_month(self, user, bank_account):
        # GIVEN - credit card expenses in current month do change bank account
        today = timezone.localdate()
        expense = ExpenseDomain(
            description="Test",
            value=Decimal("100"),
            category="Casa",
            created_at=today,
            source=CREDIT_CARD_SOURCE,
            installments_qty=1,
            extra_data={"bank_account_id": bank_account.id},
        )
        event = events.ExpenseDeleted(expense=expense)
        uow = ExpenseUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount

        # WHEN
        maybe_increment_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount + Decimal("100")


class TestMaybeChangeBankAccount:
    def test__decrements_for_value_increase(self, user, bank_account):
        # GIVEN
        today = timezone.localdate()
        expense = ExpenseDomain(
            description="Test",
            value=Decimal("150"),  # increased from 100
            category="Casa",
            created_at=today,
            source=MONEY_SOURCE,
            installments_qty=1,
            extra_data={"bank_account_id": bank_account.id},
        )
        event = events.ExpenseUpdated(expense=expense, previous_value=Decimal("100"))
        uow = ExpenseUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount

        # WHEN
        maybe_change_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount - Decimal("50")  # 150 - 100 = 50

    def test__increments_for_value_decrease(self, user, bank_account):
        # GIVEN
        today = timezone.localdate()
        expense = ExpenseDomain(
            description="Test",
            value=Decimal("50"),  # decreased from 100
            category="Casa",
            created_at=today,
            source=MONEY_SOURCE,
            installments_qty=1,
            extra_data={"bank_account_id": bank_account.id},
        )
        event = events.ExpenseUpdated(expense=expense, previous_value=Decimal("100"))
        uow = ExpenseUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount

        # WHEN
        maybe_change_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount + Decimal("50")  # 50 - 100 = -50

    def test__targets_correct_bank_account(self, user, bank_account, second_bank_account):
        # GIVEN
        today = timezone.localdate()
        expense = ExpenseDomain(
            description="Test",
            value=Decimal("150"),
            category="Casa",
            created_at=today,
            source=MONEY_SOURCE,
            installments_qty=1,
            extra_data={"bank_account_id": second_bank_account.id},  # Target second account
        )
        event = events.ExpenseUpdated(expense=expense, previous_value=Decimal("100"))
        uow = ExpenseUnitOfWork(user_id=user.id, bank_account_id=second_bank_account.id)
        previous_amount1 = bank_account.amount
        previous_amount2 = second_bank_account.amount

        # WHEN
        maybe_change_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        second_bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount1  # unchanged
        assert second_bank_account.amount == previous_amount2 - Decimal("50")


class TestIncrementBankAccountForRevenue:
    def test__increments_specific_bank_account(self, user, bank_account, second_bank_account):
        # GIVEN
        event = events.RevenueCreated(value=Decimal("5000"), bank_account_id=bank_account.id)
        uow = RevenueUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount
        second_previous_amount = second_bank_account.amount

        # WHEN
        increment_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        second_bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount + Decimal("5000")
        assert second_bank_account.amount == second_previous_amount  # unchanged

    def test__does_not_increment_without_bank_account_id(self, user, bank_account):
        # GIVEN
        event = events.RevenueCreated(value=Decimal("5000"), bank_account_id=None)
        uow = RevenueUnitOfWork(user_id=user.id)  # No bank_account_id
        previous_amount = bank_account.amount

        # WHEN
        increment_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount  # unchanged


class TestDecrementBankAccountForRevenue:
    def test__decrements_on_delete(self, user, bank_account, second_bank_account):
        # GIVEN
        event = events.RevenueDeleted(value=Decimal("5000"), bank_account_id=bank_account.id)
        uow = RevenueUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount
        second_previous_amount = second_bank_account.amount

        # WHEN
        decrement_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        second_bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount - Decimal("5000")
        assert second_bank_account.amount == second_previous_amount  # unchanged

    def test__handles_value_increase_on_update(self, user, bank_account):
        # GIVEN - revenue value decreased from 5000 to 4000, need to decrement diff
        event = events.RevenueUpdated(diff=Decimal("-1000"), bank_account_id=bank_account.id)
        uow = RevenueUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount

        # WHEN
        decrement_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount + Decimal("1000")  # decrement -1000 = +1000

    def test__handles_value_decrease_on_update(self, user, bank_account):
        # GIVEN - revenue value increased from 5000 to 6000, need to decrement negative diff
        event = events.RevenueUpdated(diff=Decimal("1000"), bank_account_id=bank_account.id)
        uow = RevenueUnitOfWork(user_id=user.id, bank_account_id=bank_account.id)
        previous_amount = bank_account.amount

        # WHEN
        decrement_bank_account(event, uow)

        # THEN
        bank_account.refresh_from_db()
        assert bank_account.amount == previous_amount - Decimal("1000")
