from random import choice, randint
from uuid import uuid4

from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from factory.django import DjangoModelFactory

from authentication.tests.conftest import client, secrets, user
from expenses.choices import (
    CREDIT_CARD_SOURCE,
    DEFAULT_CATEGORIES_MAP,
    DEFAULT_SOURCES_MAP,
    MONEY_SOURCE,
)
from expenses.models import BankAccount, Expense, ExpenseCategory, ExpenseSource, Revenue


class ExpenseFactory(DjangoModelFactory):
    class Meta:
        model = Expense


class ExpenseCategoryFactory(DjangoModelFactory):
    class Meta:
        model = ExpenseCategory


class ExpenseSourceFactory(DjangoModelFactory):
    class Meta:
        model = ExpenseSource


class RevenueFactory(DjangoModelFactory):
    class Meta:
        model = Revenue


class BankAccountFactory(DjangoModelFactory):
    class Meta:
        model = BankAccount


@pytest.fixture(autouse=True)
def default_sources(user):
    return [
        ExpenseSourceFactory(name=name, hex_color=color, user=user)
        for name, color in DEFAULT_SOURCES_MAP.items()
    ]


@pytest.fixture
def default_sources_map(default_sources):
    return {source.name: source.id for source in default_sources}


@pytest.fixture(autouse=True)
def default_categories(user):
    return [
        ExpenseCategoryFactory(name=name, hex_color=color, user=user)
        for name, color in DEFAULT_CATEGORIES_MAP.items()
    ]


@pytest.fixture
def default_categories_map(default_categories):
    return {category.name: category.id for category in default_categories}


@pytest.fixture
def bank_account(user) -> BankAccount:
    return BankAccountFactory(amount=10000, description="Nubank", user=user)


@pytest.fixture
def expense(user, default_categories_map, default_sources_map) -> Expense:
    return ExpenseFactory(
        value=50,
        description="Expense",
        category="Casa",
        expanded_category_id=default_categories_map["Casa"],
        created_at=timezone.localdate(),
        source=CREDIT_CARD_SOURCE,
        expanded_source_id=default_sources_map[CREDIT_CARD_SOURCE],
        is_fixed=True,
        user=user,
        recurring_id=uuid4(),
    )


@pytest.fixture
def fixed_expenses(expense) -> list[Expense]:
    expense.created_at = expense.created_at - relativedelta(months=2)
    expense.save()
    expenses = [expense]
    for i in range(1, 12):
        expenses.append(
            ExpenseFactory(
                value=expense.value,
                description="Expense",
                category=expense.category,
                expanded_category_id=expense.expanded_category_id,
                created_at=expense.created_at + relativedelta(months=i),
                source=expense.source,
                expanded_source_id=expense.expanded_source_id,
                is_fixed=True,
                user=expense.user,
                recurring_id=expense.recurring_id,
            )
        )
    return expenses


@pytest.fixture
def fixed_expenses_wo_delta(expense):
    expenses = [expense]
    for i in range(1, 12):
        expenses.append(
            ExpenseFactory(
                value=expense.value,
                description="Expense",
                category=expense.category,
                expanded_category_id=expense.expanded_category_id,
                created_at=expense.created_at + relativedelta(months=i),
                source=expense.source,
                expanded_source_id=expense.expanded_source_id,
                is_fixed=True,
                user=expense.user,
                recurring_id=expense.recurring_id,
            )
        )
    return expenses


@pytest.fixture
def another_expense(user, default_categories_map, default_sources_map) -> Expense:
    return ExpenseFactory(
        value=120,
        description="Test",
        category="Lazer",
        expanded_category_id=default_categories_map["Lazer"],
        created_at=timezone.localdate(),
        source=MONEY_SOURCE,
        expanded_source_id=default_sources_map[MONEY_SOURCE],
        is_fixed=True,
        user=user,
        recurring_id=uuid4(),
    )


@pytest.fixture
def yet_another_expense(user, default_categories_map, default_sources_map) -> Expense:
    return ExpenseFactory(
        value=1200,
        description="Test 2",
        category="Casa",
        expanded_category_id=default_categories_map["Casa"],
        created_at=timezone.localdate(),
        source=CREDIT_CARD_SOURCE,
        expanded_source_id=default_sources_map[CREDIT_CARD_SOURCE],
        is_fixed=False,
        user=user,
    )


@pytest.fixture
def expenses(user, default_categories_map, default_sources_map):
    today = timezone.localdate()
    _expenses = []
    for i in range(1, 13):
        category = next(iter(DEFAULT_CATEGORIES_MAP))
        source = next(iter(DEFAULT_SOURCES_MAP))

        _expenses.append(
            ExpenseFactory(
                value=randint(50, 100),
                description=f"Expense {i}",
                category=category,
                expanded_category_id=default_categories_map[category],
                created_at=today - relativedelta(months=i),
                source=source,
                expanded_source_id=default_sources_map[source],
                is_fixed=bool(i % 2),
                recurring_id=uuid4() if bool(i % 2) else None,
                user=user,
            )
        )


@pytest.fixture
def expenses_report_data(expenses, user, default_categories_map, default_sources_map):
    today = timezone.localdate()
    for i in range(1, 7):
        category1 = next(iter(DEFAULT_CATEGORIES_MAP))
        source1 = next(iter(DEFAULT_SOURCES_MAP))
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i}",
            category=category1,
            expanded_category_id=default_categories_map[category1],
            created_at=today,
            source=source1,
            expanded_source_id=default_sources_map[source1],
            is_fixed=bool(i % 2),
            recurring_id=uuid4() if bool(i % 2) else None,
            user=user,
        )

    for i in range(14, 30):
        category2 = next(iter(DEFAULT_CATEGORIES_MAP))
        source2 = next(iter(DEFAULT_SOURCES_MAP))
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i}",
            category=category2,
            expanded_category_id=default_categories_map[category2],
            created_at=today - relativedelta(months=i),
            source=source2,
            expanded_source_id=default_sources_map[source2],
            is_fixed=bool(i % 2),
            recurring_id=uuid4() if bool(i % 2) else None,
            user=user,
        )

    for i in range(1, 8):
        category3 = next(iter(DEFAULT_CATEGORIES_MAP))
        source3 = next(iter(DEFAULT_SOURCES_MAP))
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i+30}",
            category=category3,
            expanded_category_id=default_categories_map[category3],
            created_at=today + relativedelta(months=i),
            source=source3,
            expanded_source_id=default_sources_map[source3],
            is_fixed=bool(i % 2),
            recurring_id=uuid4() if bool(i % 2) else None,
            user=user,
        )


@pytest.fixture
def expenses2(user, default_categories_map, default_sources_map):
    today = timezone.localdate()
    for i in range(-24, 24):
        category = next(iter(DEFAULT_CATEGORIES_MAP))
        source = next(iter(DEFAULT_SOURCES_MAP))
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i}",
            category=category,
            expanded_category_id=default_categories_map[category],
            created_at=today - relativedelta(months=i),
            source=source,
            expanded_source_id=default_sources_map[source],
            is_fixed=bool(i % 2),
            recurring_id=uuid4() if bool(i % 2) else None,
            user=user,
        )


@pytest.fixture
def expenses_w_installments(user, default_categories_map, default_sources_map) -> list[Expense]:
    today = timezone.localdate()
    installments_id, installments_qty = uuid4(), 5
    category = next(iter(DEFAULT_CATEGORIES_MAP))
    return [
        ExpenseFactory(
            value=200,
            description="Expense",
            created_at=today + relativedelta(months=i),
            installments_id=installments_id,
            installments_qty=installments_qty,
            installment_number=i + 1,
            category=category,
            expanded_category_id=default_categories_map[category],
            source=CREDIT_CARD_SOURCE,
            expanded_source_id=default_sources_map[CREDIT_CARD_SOURCE],
            user=user,
            is_fixed=False,
        )
        for i in range(installments_qty)
    ]


@pytest.fixture
def revenue(user) -> Revenue:
    today = timezone.localdate()
    return RevenueFactory(
        value=3902,
        description="Revenue",
        created_at=today,
        is_fixed=True,
        user=user,
        recurring_id=uuid4(),
    )


@pytest.fixture
def revenues(user):
    today = timezone.localdate()
    for i in range(1, 13):
        RevenueFactory(
            value=randint(5000, 10000),
            description=f"Revenue {i}",
            created_at=today - relativedelta(months=i),
            is_fixed=bool(i % 2),
            recurring_id=uuid4() if bool(i % 2) else None,
            user=user,
        )


@pytest.fixture
def revenues_historic_data(revenues, user):
    today = timezone.localdate()
    for i in range(1, 7):
        RevenueFactory(
            value=randint(5000, 10000),
            description=f"Revenue {i}",
            created_at=today,
            is_fixed=bool(i % 2),
            recurring_id=uuid4() if bool(i % 2) else None,
            user=user,
        )

    for i in range(14, 30):
        ExpenseFactory(
            value=randint(5000, 10000),
            description=f"Revenue {i}",
            created_at=today - relativedelta(months=i),
            is_fixed=bool(i % 2),
            recurring_id=uuid4() if bool(i % 2) else None,
            user=user,
        )


@pytest.fixture
def fixed_revenues(revenue) -> list[Revenue]:
    revenue.created_at = revenue.created_at - relativedelta(months=2)
    revenue.save()
    revenues = [revenue]
    for i in range(1, 12):
        revenues.append(
            RevenueFactory(
                value=revenue.value,
                description=revenue.description,
                created_at=revenue.created_at + relativedelta(months=i),
                is_fixed=True,
                user=revenue.user,
                recurring_id=revenue.recurring_id,
            )
        )
    return revenues
