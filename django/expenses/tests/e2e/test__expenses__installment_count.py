from datetime import date
from decimal import Decimal

import pytest
from dateutil.relativedelta import relativedelta

from config.settings.base import BASE_API_URL
from expenses.models import Expense

pytestmark = [pytest.mark.django_db, pytest.mark.freeze_time("2026-05-15")]
URL = f"/{BASE_API_URL}expenses"


@pytest.mark.parametrize("selected_index", [0, 4])
@pytest.mark.parametrize(
    ("count", "first_date", "value", "balance_change"),
    [
        (7, date(2026, 1, 31), 200, 0),
        (3, date(2026, 1, 31), 200, 200),
        (1, date(2026, 1, 31), 200, 600),
        (7, date(2025, 1, 31), 200, -400),
        (7, date(2025, 1, 31), 250, -750),
    ],
)
def test__resize_installments(
    client,
    expenses_w_installments,
    bank_account,
    selected_index,
    count,
    first_date,
    value,
    balance_change,
):
    for i, expense in enumerate(expenses_w_installments):
        expense.created_at = first_date + relativedelta(months=i)
        expense.save()
    selected = expenses_w_installments[selected_index]
    previous_balance = bank_account.amount
    response = client.put(
        f"{URL}/{selected.pk}",
        data={
            "value": value,
            "description": selected.description,
            "category": selected.category,
            "created_at": selected.created_at.strftime("%d/%m/%Y"),
            "source": selected.source,
            "installments": count,
            "tags": ["purchase"],
            "bank_account_description": bank_account.description,
        },
    )

    assert response.status_code == 200, response.json()
    remaining = list(Expense.objects.order_by("created_at"))
    assert len(remaining) == count
    assert [expense.pk for expense in remaining[: min(count, 5)]] == [
        expense.pk for expense in expenses_w_installments[: min(count, 5)]
    ]
    for i, expense in enumerate(remaining):
        assert expense.value == Decimal(value)
        assert expense.expanded_category_id == selected.expanded_category_id
        assert expense.expanded_source_id == selected.expanded_source_id
        assert expense.bank_account_id == bank_account.pk
        assert expense.created_at == first_date + relativedelta(months=i)
        assert list(expense.tags.values_list("name", flat=True)) == ["purchase"]
        assert expense.installments_qty == (count if count > 1 else None)
        assert expense.installment_number == (i + 1 if count > 1 else None)
        assert expense.installments_id == (selected.installments_id if count > 1 else None)
    assert response.json()["installments"] == count
    assert response.json()["id"] in [expense.pk for expense in remaining]
    bank_account.refresh_from_db()
    assert bank_account.amount == previous_balance + balance_change


def test__add_installments_to_single_expense(client, expense, bank_account):
    expense.is_fixed = False
    expense.recurring_id = None
    expense.save()
    previous_balance = bank_account.amount
    response = client.put(
        f"{URL}/{expense.pk}",
        data={
            "value": 50,
            "description": expense.description,
            "category": expense.category,
            "created_at": expense.created_at.strftime("%d/%m/%Y"),
            "source": expense.source,
            "installments": 3,
            "bank_account_description": bank_account.description,
        },
    )
    assert response.status_code == 200, response.json()
    assert list(Expense.objects.order_by("created_at").values_list("value", flat=True)) == [
        Decimal("50"),
        Decimal("50"),
        Decimal("50"),
    ]
    bank_account.refresh_from_db()
    assert bank_account.amount == previous_balance


def test__list_returns_installment_count(client, expenses_w_installments):
    response = client.get(URL)
    assert response.status_code == 200
    assert {expense["installments"] for expense in response.json()["results"]} == {5}


@pytest.mark.parametrize("source", ["Cartão de débito", "Boleto"])
def test__collapse_future_installments_to_immediately_paid_source(
    client, expenses_w_installments, bank_account, source
):
    for i, expense in enumerate(expenses_w_installments):
        expense.created_at = date(2026, 6, 15) + relativedelta(months=i)
        expense.save()
    selected = expenses_w_installments[-1]
    previous_balance = bank_account.amount
    response = client.put(
        f"{URL}/{selected.pk}",
        data={
            "value": selected.value,
            "description": selected.description,
            "category": selected.category,
            "created_at": selected.created_at.strftime("%d/%m/%Y"),
            "source": source,
            "installments": 1,
            "bank_account_description": bank_account.description,
        },
    )
    assert response.status_code == 200, response.json()
    assert Expense.objects.count() == 1
    bank_account.refresh_from_db()
    assert bank_account.amount == previous_balance - 200


def test__resize_and_move_installments_to_another_account(
    client, expenses_w_installments, bank_account, second_bank_account
):
    for i, expense in enumerate(expenses_w_installments):
        expense.created_at = date(2026, 1, 31) + relativedelta(months=i)
        expense.save()
    selected = expenses_w_installments[-1]
    previous_balance = bank_account.amount
    previous_destination_balance = second_bank_account.amount
    response = client.put(
        f"{URL}/{selected.pk}",
        data={
            "value": selected.value,
            "description": selected.description,
            "category": selected.category,
            "created_at": selected.created_at.strftime("%d/%m/%Y"),
            "source": selected.source,
            "installments": 3,
            "bank_account_description": second_bank_account.description,
        },
    )
    assert response.status_code == 200, response.json()
    assert Expense.objects.filter(bank_account=second_bank_account).count() == 3
    bank_account.refresh_from_db()
    second_bank_account.refresh_from_db()
    assert bank_account.amount == previous_balance + 800
    assert second_bank_account.amount == previous_destination_balance - 600


@pytest.mark.parametrize("count", [0, -1, 1.5, 32768])
def test__invalid_installment_count(client, expenses_w_installments, bank_account, count):
    selected = expenses_w_installments[0]
    response = client.put(
        f"{URL}/{selected.pk}",
        data={
            "value": selected.value,
            "description": selected.description,
            "category": selected.category,
            "created_at": selected.created_at.strftime("%d/%m/%Y"),
            "source": selected.source,
            "installments": count,
            "bank_account_description": bank_account.description,
        },
    )
    assert response.status_code == 400
    assert "installments" in response.json()
    assert Expense.objects.count() == 5
