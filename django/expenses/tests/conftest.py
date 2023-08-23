from random import choice, randint

from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from factory.django import DjangoModelFactory

from authentication.tests.conftest import client, secrets, user
from expenses.choices import ExpenseCategory, ExpenseSource
from expenses.models import Expense


class ExpenseFactory(DjangoModelFactory):
    class Meta:
        model = Expense


@pytest.fixture
def expense(user):
    return ExpenseFactory(
        price=5,
        description="Expense",
        category=ExpenseCategory.house,
        created_at=timezone.now().date(),
        source=ExpenseSource.credit_card,
        is_fixed=True,
        user=user,
    )


@pytest.fixture
def expenses(user):
    today = timezone.now().date()
    for i in range(1, 13):
        ExpenseFactory(
            price=randint(5, 10),
            description=f"Expense {i}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=today - relativedelta(months=i),
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )


@pytest.fixture
def report_data(expenses, user):
    today = timezone.now().date()
    for i in range(1, 7):
        ExpenseFactory(
            price=randint(5, 10),
            description=f"Expense {i}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=today,
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )

    for i in range(14, 30):
        ExpenseFactory(
            price=randint(5, 10),
            description=f"Expense {i}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=today - relativedelta(months=i),
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )


@pytest.fixture
def expenses2(user):
    today = timezone.now().date()
    for i in range(-24, 24):
        ExpenseFactory(
            price=randint(5, 10),
            description=f"Expense {i}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=today - relativedelta(months=i),
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )
