from datetime import datetime
from decimal import Decimal

import pytest
from freezegun import freeze_time

from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
)

from expenses.choices import ExpenseCategory, ExpenseSource, ExpenseReportType
from expenses.models import Expense
from config.settings.base import BASE_API_URL

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

    assert response.json()["category"] == ExpenseCategory.get_choice(ExpenseCategory.house).label
    assert response.json()["source"] == ExpenseSource.get_choice(ExpenseSource.bank_slip).label

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
    assert expense.created_at == datetime.strptime(data["created_at"], "%d/%m/%Y").date()
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


def test_should_not_get_report_without_of_parameter(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/report")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"of": ["Required to define the type of report"]}


def test_should_not_get_report_if_of_parameter_is_invalid_choice(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/report?of=wrong")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "of": ["Select a valid choice. wrong is not one of the available choices."]
    }


@pytest.mark.usefixtures("expenses")
@pytest.mark.parametrize(
    "of, field_name",
    [(value, ExpenseReportType.get_choice(value).field_name) for value in ExpenseReportType.values],
)
def test_should_get_reports(client, of, field_name):
    # GIVEN
    qs = Expense.objects.all()

    # WHEN
    response = client.get(f"{URL}/report?of={of}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert all(
        result["total"] == float(result_qs["total"])
        for result, result_qs in zip(response.json(), qs.aggregate_field(field_name=field_name))
    )


@pytest.mark.usefixtures("expenses")
@pytest.mark.parametrize(
    "of, field_name",
    [(value, ExpenseReportType.get_choice(value).field_name) for value in ExpenseReportType.values],
)
def test_should_filter_report_data(client, of, field_name):
    # GIVEN
    month, year = 3, 2021
    qs = Expense.objects.filter_by_month_and_year(month=month, year=year)

    # WHEN
    response = client.get(f"{URL}/report?of={of}&month={month}&year={year}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert all(
        result["total"] == float(result_qs["total"])
        for result, result_qs in zip(response.json(), qs.aggregate_field(field_name=field_name))
    )


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


@freeze_time("2021-10-01")
@pytest.mark.usefixtures("expenses")
def test_should_get_indicators(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    response_json = response.json()
    past_month_total = float(Expense.objects.filter(created_at__month=9).sum()["total"])

    assert response.status_code == HTTP_200_OK
    assert response_json["total"] == float(
        Expense.objects.filter(created_at__month=10).sum()["total"]
    )
    assert response_json["diff"] == response_json["total"] - past_month_total
    # assert (
    #     response_json["diff_percentage"]
    #     == (((past_month_total + response_json["diff"]) / past_month_total) - 1) * 100
    # )
