from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest

from authentication.tests.conftest import IntegrationSecretFactory, UserFactory
from expenses.choices import CREDIT_CARD_SOURCE, MONEY_SOURCE
from expenses.tests.conftest import (
    BankAccountFactory,
    ExpenseFactory,
    ExpenseTagFactory,
    RevenueFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(params=["expenses", "revenues"])
def totals_rows(request, user, bank_account):
    resource = request.param
    factory = ExpenseFactory if resource == "expenses" else RevenueFactory
    other_bank = BankAccountFactory(user=user, description="Other bank", amount=100)
    common = {"user": user, "category": "Casa", "bank_account": bank_account}
    if resource == "expenses":
        common["source"] = CREDIT_CARD_SOURCE
    rows = [
        factory(
            **common,
            description="Compra no supermercado",
            value=Decimal("10.10"),
            created_at=date(2020, 1, 15),
        ),
        factory(
            **common,
            description="Supermercado",
            value=Decimal("20.20"),
            created_at=date(2030, 1, 15),
        ),
        factory(
            **{
                **common,
                "category": "Transporte",
                **({"source": MONEY_SOURCE} if resource == "expenses" else {}),
            },
            description="Salário",
            value=Decimal("30.30"),
            created_at=date(2025, 1, 15),
        ),
        factory(
            **{**common, "bank_account": other_bank},
            description="Compra no supermercado",
            value=Decimal("40.40"),
            created_at=date(2020, 1, 15),
        ),
    ]
    other_user = UserFactory(
        email="totals-other@example.com",
        username="totals-other",
        secrets=IntegrationSecretFactory(cpf="52245911040"),
    )
    foreign_bank = BankAccountFactory(
        user=other_user, description=bank_account.description, amount=100
    )
    factory(
        **{**common, "user": other_user, "bank_account": foreign_bank},
        description="Compra no supermercado",
        value=Decimal("999.99"),
        created_at=date(2020, 1, 15),
    )
    return resource, rows, common


@pytest.mark.parametrize(
    "params,total",
    [
        ({}, 101.0),
        ({"description": "SUPER"}, 70.7),
        ({"description": "comp super"}, 50.5),
        ({"description": "!!!"}, 0),
        ({"description": "no match"}, 0),
        ({"description": "   "}, 0),
        ({"start_date": "01/01/2026"}, 20.2),
        ({"end_date": "31/12/2021"}, 50.5),
        ({"start_date": "01/01/2020", "end_date": "31/12/2020"}, 50.5),
    ],
)
def test_total_applies_description_and_optional_bounds(client, totals_rows, params, total):
    resource, _, _ = totals_rows
    response = client.get(f"/api/v1/{resource}/sum", params)
    assert response.status_code == 200
    assert response.json() == {"total": total}


def test_total_composes_bank_description_and_date_filters(client, totals_rows, bank_account):
    resource, _, _ = totals_rows
    response = client.get(
        f"/api/v1/{resource}/sum",
        {
            "description": "super",
            "bank_account_description": bank_account.description,
            "start_date": "01/01/2026",
        },
    )
    assert response.status_code == 200
    assert response.json() == {"total": 20.2}


def test_total_includes_every_page_and_expense_type(client, totals_rows):
    resource, _, common = totals_rows
    factory = ExpenseFactory if resource == "expenses" else RevenueFactory
    group = uuid4()
    for i in range(201):
        kind = {"is_fixed": i % 3 == 1, "recurring_id": group if i % 3 == 1 else None}
        if resource == "expenses" and i % 3 == 2:
            kind.update(installments_id=group, installment_number=i // 3 + 1, installments_qty=67)
        factory(
            **common,
            **kind,
            description="needle",
            created_at=date(2020, 1, 15),
            value=Decimal("1.23"),
        )
    response = client.get(
        f"/api/v1/{resource}/sum", {"description": "needle", "page": 2, "page_size": 100}
    )
    assert response.status_code == 200
    assert response.json() == {"total": 247.23}
    page = client.get(
        f"/api/v1/{resource}", {"description": "needle", "page": 2, "page_size": 100}
    ).json()
    assert page["count"] == 201
    assert len(page["results"]) == 100


def test_total_rejects_invalid_date_bounds(client, totals_rows):
    resource, _, _ = totals_rows
    response = client.get(f"/api/v1/{resource}/sum", {"start_date": "not-a-date"})
    assert response.status_code == 400


def test_expense_total_counts_each_expense_once_with_overlapping_tag_filters(
    client, user, bank_account
):
    tags = [ExpenseTagFactory(user=user, name=name) for name in ["red", "blue"]]
    for _ in range(2):
        expense = ExpenseFactory(
            user=user,
            bank_account=bank_account,
            category="Casa",
            source=CREDIT_CARD_SOURCE,
            description="supermarket",
            value=Decimal("10.10"),
            created_at=date(2020, 1, 15),
        )
        expense.tags.set(tags)
    ExpenseFactory(
        user=user,
        bank_account=bank_account,
        category="Transporte",
        source=MONEY_SOURCE,
        description="supermarket",
        value=100,
        created_at=date(2020, 1, 15),
    )
    response = client.get(
        "/api/v1/expenses/sum",
        {
            "description": "super",
            "category": ["Casa", "Transporte"],
            "source": [CREDIT_CARD_SOURCE],
            "tag": ["red", "blue"],
            "start_date": "01/01/2020",
            "end_date": "31/12/2020",
        },
    )
    assert response.status_code == 200
    assert response.json() == {"total": 20.2}
