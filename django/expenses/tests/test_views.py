from datetime import datetime
from decimal import Decimal
from django.db.models.functions.datetime import TruncMonth

import pytest

from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
)

from config.settings.base import BASE_API_URL
from expenses.models import Expense, ExpenseCategory, ExpenseSource

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "expenses"


@pytest.mark.usefixtures("expenses")
@pytest.mark.parametrize(
    "filter_by, count",
    [
        ("", 12),
        ("description=Expense", 12),
        ("description=pense", 12),
        ("description=wrong", 0),
        ("start_date=2021-01-01&end_date=2021-12-01", 12),
        ("start_date=2021-01-01&end_date=2021-01-01", 1),
        ("start_date=2020-01-01&end_date=2020-12-01", 0),
        ("is_fixed=False", 6),
        ("is_fixed=True", 6),
    ],
)
def test_should_filter_expenses(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count


@pytest.mark.usefixtures("expenses")
@pytest.mark.parametrize(
    "field, value",
    [("source", "MONEY"), ("category", "HOUSE")],
)
def test_should_filter_expenses_by_choice(client, field, value):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{field}={value}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == Expense.objects.filter(**{field: value}).count()


def test_should_create_expense(client):
    # GIVEN
    data = {
        "price": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.bank_slip,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert (
        response.json()["category"]
        == ExpenseCategory.get_choice(ExpenseCategory.house).label
    )
    assert (
        response.json()["source"]
        == ExpenseSource.get_choice(ExpenseSource.bank_slip).label
    )

    assert Expense.objects.count() == 1


def test_should_update_expense(client, expense):
    # GIVEN
    data = {
        "price": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.bank_slip,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    expense.refresh_from_db()
    assert expense.price == Decimal(data["price"])
    assert expense.description == data["description"]
    assert expense.category == data["category"]
    assert (
        expense.created_at == datetime.strptime(data["created_at"], "%d/%m/%Y").date()
    )
    assert expense.source == data["source"]


def test_should_partial_update_expense(client, expense):
    # GIVEN
    data = {"price": 12.00}

    # WHEN
    response = client.patch(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    expense.refresh_from_db()
    assert expense.price == Decimal(data["price"])


def test_should_delete_expense(client, expense):
    # GIVEN

    # WHEN
    response = client.delete(f"{URL}/{expense.pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert Expense.objects.count() == 0


@pytest.mark.usefixtures("expenses")
def test_should_get_report_data(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/report")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["total"] == float(Expense.objects.sum()["total"])

    for data_name, field_name in (
        ("categories", "category"),
        ("sources", "source"),
        ("type", "is_fixed"),
    ):
        for data_info in response.json()[data_name]:
            for qs_info in Expense.objects.aggregate_field(field_name=field_name):
                if data_info[field_name] == qs_info[field_name]:
                    assert data_info["total"] == float(qs_info["total"])


@pytest.mark.usefixtures("expenses")
def test_should_filter_report_data(client):
    # GIVEN
    month, year = 3, 2021
    qs = Expense.objects.filter_by_month_and_year(month=month, year=year)

    # WHEN
    response = client.get(f"{URL}/report?month={month}&year={year}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["total"] == float(qs.sum()["total"])

    for data_name, field_name in (
        ("categories", "category"),
        ("sources", "source"),
        ("type", "is_fixed"),
    ):
        for data_info in response.json()[data_name]:
            for qs_info in qs.aggregate_field(field_name=field_name):
                if data_info[field_name] == qs_info[field_name]:
                    assert data_info["total"] == float(qs_info["total"])


@pytest.mark.parametrize("month, year", [(0, 2021), (1, 0)])
def test_should_raise_error_if_month_or_year_are_out_of_range(client, month, year):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/report?month={month}&year={year}")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert list(response.json().values())[0][0] == "Out of range"


@pytest.mark.usefixtures("expenses")
def test_should_get_historic_data(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/historic")

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        month = datetime.strptime(result["month"], "%d/%m/%Y").date().month
        assert result["total"] == float(
            Expense.objects.filter(created_at__month=month).sum()["total"]
        )
