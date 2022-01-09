from random import randint, choice
from datetime import date

import pytest
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
        created_at=date(2021, 1, 1),
        source=ExpenseSource.credit_card,
        is_fixed=True,
        user=user,
    )


@pytest.fixture
def expenses(user):
    for i in range(1, 13):
        ExpenseFactory(
            price=randint(5, 10),
            description=f"Expense {i}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=date(2021, i, 1),
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )
