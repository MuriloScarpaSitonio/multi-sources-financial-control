from functools import partial
from random import choice, randint
from uuid import uuid4

from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from factory import post_generation
from factory.django import DjangoModelFactory

from authentication.tests.conftest import client, secrets, user
from expenses.choices import (
    CREDIT_CARD_SOURCE,
    DEFAULT_CATEGORIES_MAP,
    DEFAULT_REVENUE_CATEGORIES_MAP,
    DEFAULT_SOURCES_MAP,
    MONEY_SOURCE,
)
from expenses.models import (
    BankAccount,
    BankAccountSnapshot,
    Expense,
    ExpenseCategory,
    ExpenseSource,
    ExpenseTag,
    Revenue,
    RevenueCategory,
)


class ExpenseTagFactory(DjangoModelFactory):
    class Meta:
        model = ExpenseTag


class ExpenseFactory(DjangoModelFactory):
    class Meta:
        model = Expense

    @post_generation
    def _tags(self, create: bool, tags: list[str]):
        if not create:
            return

        if tags:
            self.tags.set([ExpenseTagFactory(name=tag, user=self.user) for tag in tags])


class ExpenseCategoryFactory(DjangoModelFactory):
    class Meta:
        model = ExpenseCategory


class ExpenseSourceFactory(DjangoModelFactory):
    class Meta:
        model = ExpenseSource


class RevenueCategoryFactory(DjangoModelFactory):
    class Meta:
        model = RevenueCategory


class RevenueFactory(DjangoModelFactory):
    class Meta:
        model = Revenue


class BankAccountFactory(DjangoModelFactory):
    class Meta:
        model = BankAccount


class BankAccountSnapshotFactory(DjangoModelFactory):
    operation_date = timezone.localdate().replace(day=1)

    class Meta:
        model = BankAccountSnapshot


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


@pytest.fixture(autouse=True)
def default_revenue_categories(user):
    return [
        RevenueCategoryFactory(name=name, hex_color=color, user=user)
        for name, color in DEFAULT_REVENUE_CATEGORIES_MAP.items()
    ]


@pytest.fixture
def default_revenue_categories_map(default_revenue_categories):
    return {category.name: category.id for category in default_revenue_categories}


@pytest.fixture
def bank_account(user) -> BankAccount:
    return BankAccountFactory(
        amount=10000, description="Nubank", user=user, is_default=True, is_active=True
    )


@pytest.fixture
def second_bank_account(user) -> BankAccount:
    return BankAccountFactory(
        amount=5000, description="Itaú", user=user, is_default=False, is_active=True
    )


@pytest.fixture
def expense(user, default_categories_map, default_sources_map, bank_account) -> Expense:
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
        bank_account=bank_account,
    )


@pytest.fixture
def expense_w_tags(user, default_categories_map, default_sources_map, bank_account) -> Expense:
    return ExpenseFactory(
        value=50,
        description="Expense",
        category="Casa",
        expanded_category_id=default_categories_map["Casa"],
        created_at=timezone.localdate(),
        source=CREDIT_CARD_SOURCE,
        expanded_source_id=default_sources_map[CREDIT_CARD_SOURCE],
        is_fixed=False,
        user=user,
        recurring_id=None,
        _tags=["abc"],
        bank_account=bank_account,
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
                bank_account=expense.bank_account,
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
def another_expense(user, default_categories_map, default_sources_map, bank_account) -> Expense:
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
        bank_account=bank_account,
        recurring_id=uuid4(),
    )


@pytest.fixture
def yet_another_expense(user, default_categories_map, default_sources_map, bank_account) -> Expense:
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
        bank_account=bank_account,
    )


@pytest.fixture
def expenses(user, default_categories_map, default_sources_map, bank_account):
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
                bank_account=bank_account,
            )
        )


@pytest.fixture
def expenses_report_data(expenses, user, default_categories_map, default_sources_map, bank_account):
    today = timezone.localdate()
    for i in range(1, 7):
        category1 = choice(list(DEFAULT_CATEGORIES_MAP))
        source1 = choice(list(DEFAULT_SOURCES_MAP))
        is_fixed = bool(i % 2)
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i}",
            category=category1,
            expanded_category_id=default_categories_map[category1],
            created_at=today,
            source=source1,
            expanded_source_id=default_sources_map[source1],
            is_fixed=is_fixed,
            recurring_id=uuid4() if is_fixed else None,
            user=user,
            bank_account=bank_account,
        )

    for i in range(14, 30):
        category2 = choice(list(DEFAULT_CATEGORIES_MAP))
        source2 = choice(list(DEFAULT_SOURCES_MAP))
        is_fixed = bool(i % 2)
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i}",
            category=category2,
            expanded_category_id=default_categories_map[category2],
            created_at=today - relativedelta(months=i),
            source=source2,
            expanded_source_id=default_sources_map[source2],
            is_fixed=is_fixed,
            recurring_id=uuid4() if is_fixed else None,
            user=user,
            bank_account=bank_account,
        )

    for i in range(1, 8):
        category3 = choice(list(DEFAULT_CATEGORIES_MAP))
        source3 = choice(list(DEFAULT_SOURCES_MAP))
        is_fixed = bool(i % 2)
        ExpenseFactory(
            value=randint(5, 10),
            description=f"Expense {i + 30}",
            category=category3,
            expanded_category_id=default_categories_map[category3],
            created_at=today + relativedelta(months=i),
            source=source3,
            expanded_source_id=default_sources_map[source3],
            is_fixed=is_fixed,
            recurring_id=uuid4() if is_fixed else None,
            user=user,
            bank_account=bank_account,
        )


@pytest.fixture
def expenses2(user, default_categories_map, default_sources_map, bank_account):
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
            bank_account=bank_account,
        )


@pytest.fixture
def expenses_w_installments(
    user, default_categories_map, default_sources_map, bank_account
) -> list[Expense]:
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
            bank_account=bank_account,
        )
        for i in range(installments_qty)
    ]


@pytest.fixture
def revenue(user, default_revenue_categories_map, bank_account) -> Revenue:
    return RevenueFactory(
        value=3902,
        description="Revenue",
        created_at=timezone.localdate(),
        is_fixed=True,
        user=user,
        recurring_id=uuid4(),
        category="Salário",
        expanded_category_id=default_revenue_categories_map["Salário"],
        bank_account=bank_account,
    )


@pytest.fixture
def another_revenue(user, default_revenue_categories_map, bank_account) -> Revenue:
    return RevenueFactory(
        value=1000,
        description="Revenue bonus",
        created_at=timezone.localdate(),
        is_fixed=False,
        user=user,
        category="Bônus",
        expanded_category_id=default_revenue_categories_map["Bônus"],
        bank_account=bank_account,
    )


@pytest.fixture
def yet_another_revenue(user, revenue, default_revenue_categories_map, bank_account) -> Revenue:
    return RevenueFactory(
        value=4000,
        description="Revenue",
        created_at=timezone.localdate() - relativedelta(months=1),
        is_fixed=True,
        user=user,
        recurring_id=revenue.recurring_id,
        category="Salário",
        expanded_category_id=default_revenue_categories_map["Salário"],
        bank_account=bank_account,
    )


@pytest.fixture
def revenues(user, default_revenue_categories_map, bank_account):
    today = timezone.localdate()
    for i in range(1, 13):
        is_fixed = bool(i % 2)
        RevenueFactory(
            value=randint(5000, 10000),
            description=f"Revenue {i}",
            created_at=today - relativedelta(months=i),
            is_fixed=is_fixed,
            recurring_id=uuid4() if is_fixed else None,
            user=user,
            category="Salário",
            expanded_category_id=default_revenue_categories_map["Salário"],
            bank_account=bank_account,
        )


@pytest.fixture
def revenues_historic_data(revenues, user, bank_account):
    today = timezone.localdate()
    for i in range(1, 7):
        is_fixed = bool(i % 2)
        RevenueFactory(
            value=randint(5000, 10000),
            description=f"Revenue {i}",
            created_at=today,
            is_fixed=is_fixed,
            recurring_id=uuid4() if is_fixed else None,
            user=user,
            bank_account=bank_account,
        )

    for i in range(14, 30):
        is_fixed = bool(i % 2)
        RevenueFactory(
            value=randint(5000, 10000),
            description=f"Revenue {i}",
            created_at=today - relativedelta(months=i),
            is_fixed=is_fixed,
            recurring_id=uuid4() if is_fixed else None,
            user=user,
            bank_account=bank_account,
        )


@pytest.fixture
def revenues_report_data(revenues, user, default_revenue_categories_map, bank_account):
    today = timezone.localdate()
    for i in range(1, 7):
        category1 = choice(list(DEFAULT_REVENUE_CATEGORIES_MAP))
        is_fixed = bool(i % 2)
        RevenueFactory(
            value=randint(500, 1000000),
            description=f"Revenue {i}",
            category=category1,
            expanded_category_id=default_revenue_categories_map[category1],
            created_at=today,
            is_fixed=is_fixed,
            recurring_id=uuid4() if is_fixed else None,
            user=user,
            bank_account=bank_account,
        )

    for i in range(14, 30):
        category2 = choice(list(DEFAULT_REVENUE_CATEGORIES_MAP))
        is_fixed = bool(i % 2)
        RevenueFactory(
            value=randint(500, 1000000),
            description=f"Revenue {i}",
            category=category2,
            expanded_category_id=default_revenue_categories_map[category2],
            created_at=today - relativedelta(months=i),
            is_fixed=is_fixed,
            recurring_id=uuid4() if is_fixed else None,
            user=user,
            bank_account=bank_account,
        )

    for i in range(1, 8):
        category3 = choice(list(DEFAULT_REVENUE_CATEGORIES_MAP))
        is_fixed = bool(i % 2)
        RevenueFactory(
            value=randint(500, 1000000),
            description=f"Revenue {i + 30}",
            category=category3,
            expanded_category_id=default_revenue_categories_map[category3],
            created_at=today + relativedelta(months=i),
            is_fixed=is_fixed,
            recurring_id=uuid4() if is_fixed else None,
            user=user,
            bank_account=bank_account,
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
                bank_account=revenue.bank_account,
            )
        )
    return revenues


@pytest.fixture
def bank_account_snapshot_factory(user):
    return partial(BankAccountSnapshotFactory, user=user)
