from random import choice, randint
from uuid import uuid4

from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from factory.django import DjangoModelFactory

from authentication.tests.conftest import client, secrets, user
from expenses.choices import ExpenseCategory, ExpenseSource
from expenses.models import Expense, Revenue


class ExpenseFactory(DjangoModelFactory):
    class Meta:
        model = Expense


class RevenueFactory(DjangoModelFactory):
    class Meta:
        model = Revenue


@pytest.fixture
def expense(user):
    return ExpenseFactory(
        value=5,
        description="Expense",
        category=ExpenseCategory.house,
        created_at=timezone.now().date(),
        source=ExpenseSource.credit_card,
        is_fixed=True,
        user=user,
    )


@pytest.fixture
def another_expense(user):
    return ExpenseFactory(
        value=12,
        description="Test",
        category=ExpenseCategory.recreation,
        created_at=timezone.now().date(),
        source=ExpenseSource.money,
        is_fixed=True,
        user=user,
    )


@pytest.fixture
def expenses(user):
    today = timezone.now().date()
    for i in range(1, 13):
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=today - relativedelta(months=i),
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )


@pytest.fixture
def expenses_report_data(expenses, user):
    today = timezone.now().date()
    for i in range(1, 7):
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=today,
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )

    for i in range(14, 30):
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=today - relativedelta(months=i),
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )

    for i in range(1, 8):
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i+30}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=today + relativedelta(months=i),
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )


@pytest.fixture
def expenses2(user):
    today = timezone.now().date()
    for i in range(-24, 24):
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i}",
            category=choice(ExpenseCategory.choices)[0],
            created_at=today - relativedelta(months=i),
            source=choice(ExpenseSource.choices)[0],
            is_fixed=bool(i % 2),
            user=user,
        )


@pytest.fixture
def expenses_w_installments(user):
    today = timezone.now().date()
    installments_id, installments_qty = uuid4(), 5
    category = choice(ExpenseCategory.choices)[0]
    source = choice(ExpenseSource.choices)[0]
    return [
        ExpenseFactory(
            value=200,
            description="Expense",
            created_at=today + relativedelta(months=i),
            installments_id=installments_id,
            installments_qty=installments_qty,
            installment_number=i + 1,
            category=category,
            source=source,
            user=user,
            is_fixed=False,
        )
        for i in range(installments_qty)
    ]


@pytest.fixture
def revenue(user):
    today = timezone.now().date()
    return RevenueFactory(
        value=3902,
        description="Revenue",
        created_at=today,
        is_fixed=True,
        user=user,
    )


@pytest.fixture
def revenues(user):
    today = timezone.now().date()
    for i in range(1, 13):
        RevenueFactory(
            value=randint(5000, 10000),
            description=f"Revenue {i}",
            created_at=today - relativedelta(months=i),
            is_fixed=bool(i % 2),
            user=user,
        )


@pytest.fixture
def revenues_historic_data(revenues, user):
    today = timezone.now().date()
    for i in range(1, 7):
        RevenueFactory(
            value=randint(5000, 10000),
            description=f"Revenue {i}",
            created_at=today,
            is_fixed=bool(i % 2),
            user=user,
        )

    for i in range(14, 30):
        ExpenseFactory(
            value=randint(5000, 10000),
            description=f"Revenue {i}",
            created_at=today - relativedelta(months=i),
            is_fixed=bool(i % 2),
            user=user,
        )
