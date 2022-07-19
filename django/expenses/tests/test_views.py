from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from statistics import fmean
from typing import Optional, Union

from django.db.models import Avg, Q
from django.utils import timezone

import pytest
from freezegun import freeze_time
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
)
from authentication.models import CustomUser

from expenses.choices import ExpenseCategory, ExpenseSource, ExpenseReportType
from expenses.models import Expense
from config.settings.base import BASE_API_URL

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "expenses"


def _convert_and_quantize(
    value: Union[str, float, int, Decimal, None], precision: int = 1, cast: type = Decimal
) -> Optional[Decimal]:
    if value is None:
        return
    result = Decimal(str(value)).quantize(
        Decimal(f"0.{'0' * (precision - 1)}1"), rounding=ROUND_HALF_UP
    )
    return cast(result)


@pytest.mark.usefixtures("expenses")
@pytest.mark.parametrize(
    "filter_by, count",
    [
        ("", 12),
        ("description=Expense", 12),
        ("description=pense", 12),
        ("description=wrong", 0),
        ("start_date=2021-01-01&end_date=2021-12-01", 5),
        ("start_date=2021-10-01&end_date=2021-10-01", 0),
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
    assert (
        response.json()["count"]
        == Expense.objects.since_a_year_ago().filter(**{field: value}).count()
    )


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
    assert response.json() == {"of": ["This field is required."]}


def test_should_not_get_report_if_of_parameter_is_invalid_choice(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/report?of=wrong")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "of": ["Select a valid choice. wrong is not one of the available choices."]
    }


@pytest.mark.usefixtures("report_data")
@pytest.mark.parametrize(
    "of, field_name",
    [(value, ExpenseReportType.get_choice(value).field_name) for value in ExpenseReportType.values],
)
def test_should_get_reports(client, of, field_name):
    # GIVEN
    choices_class_map = {"category": ExpenseCategory, "source": ExpenseSource}
    choices_class = choices_class_map.get(field_name)
    qs = Expense.objects.since_a_year_ago()
    today = timezone.now().date()
    current_month = {}
    since_a_year_ago = {}
    for e in qs:
        f = (
            choices_class.get_choice(getattr(e, field_name)).label
            if choices_class is not None
            else field_name
        )
        if e.created_at.month == today.month and e.created_at.year == today.year:
            current_month.setdefault(f, []).append(e.price)
        else:
            since_a_year_ago.setdefault(f, []).append(e.price)
    result_brute_force = [
        {
            "total": sum(current_month.get(k)) if current_month.get(k) is not None else None,
            "avg": _convert_and_quantize(fmean(v)),
            field_name: k,
        }
        for k, v in since_a_year_ago.items()
    ]

    # WHEN
    response = client.get(f"{URL}/report?of={of}")

    # THEN
    for result in response.json():
        for brute_force in result_brute_force:
            if result[field_name] == brute_force[field_name]:
                assert _convert_and_quantize(result["total"]) == brute_force["total"]
                assert _convert_and_quantize(result["avg"]) == brute_force["avg"]
    assert response.status_code == HTTP_200_OK


@pytest.mark.usefixtures("report_data")
@pytest.mark.parametrize(
    "of, field_name",
    [(value, ExpenseReportType.get_choice(value).field_name) for value in ExpenseReportType.values],
)
def test_should_get_reports_all_period(client, of, field_name):
    # GIVEN
    choices_class_map = {"category": ExpenseCategory, "source": ExpenseSource}
    choices_class = choices_class_map.get(field_name)
    qs = Expense.objects.current_month_and_past()
    today = timezone.now().date()
    current_month = {}
    past = {}
    for e in qs:
        f = (
            choices_class.get_choice(getattr(e, field_name)).label
            if choices_class is not None
            else field_name
        )
        if e.created_at.month == today.month and e.created_at.year == today.year:
            current_month.setdefault(f, []).append(e.price)
        else:
            past.setdefault(f, []).append(e.price)
    result_brute_force = [
        {
            "total": sum(current_month.get(k)) if current_month.get(k) is not None else None,
            "avg": _convert_and_quantize(fmean(v)),
            field_name: k,
        }
        for k, v in past.items()
    ]

    # WHEN
    response = client.get(f"{URL}/report?of={of}&all=true")

    # THEN
    for result in response.json():
        for brute_force in result_brute_force:
            if result[field_name] == brute_force[field_name]:
                assert _convert_and_quantize(result["total"]) == brute_force["total"]
                assert _convert_and_quantize(result["avg"]) == brute_force["avg"]
    assert response.status_code == HTTP_200_OK


@pytest.mark.usefixtures("report_data")
@pytest.mark.parametrize("filters", ("", "future=true"))
def test_should_get_historic_data(client, filters):
    # GIVEN
    today = timezone.now().date()

    # WHEN
    response = client.get(f"{URL}/historic?{filters}")
    response_json = response.json()

    # THEN
    assert response.status_code == HTTP_200_OK

    total = 0
    for result in response_json["historic"]:
        d = datetime.strptime(result["month"], "%d/%m/%Y").date()
        assert _convert_and_quantize(result["total"]) == _convert_and_quantize(
            Expense.objects.filter(created_at__month=d.month, created_at__year=d.year).sum()[
                "total"
            ]
        )
        if d == today.replace(day=1):  # we don't evaluate the current month on the avg calculation
            continue
        total += result["total"]

    if filters:
        assert response_json["avg"] is None
    else:
        assert _convert_and_quantize(
            total / (len(response_json["historic"]) - 1)
        ) == _convert_and_quantize(response_json["avg"])


@pytest.mark.usefixtures("expenses")
def test_should_get_indicators(client):
    # GIVEN
    today = timezone.now().date()
    qs = Expense.objects.since_a_year_ago()
    avg = (
        qs.exclude(created_at__month=today.month, created_at__year=today.year)
        .trunc_months()
        .aggregate(avg=Avg("total"))["avg"]
    )
    total = (
        Expense.objects.filter(created_at__month=today.month, created_at__year=today.year).sum()[
            "total"
        ]
        or Decimal()
    )
    future = (
        qs.filter(
            Q(created_at__month__gt=today.month, created_at__year=today.year)
            | Q(created_at__year__gt=today.year)
        ).sum()["total"]
        or Decimal()
    )

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    response_json = response.json()

    assert response.status_code == HTTP_200_OK
    assert Decimal(response_json["total"]) == total
    assert response_json == {
        "total": _convert_and_quantize(total, precision=2, cast=float),
        "avg": _convert_and_quantize(avg, precision=2, cast=float),
        "diff": _convert_and_quantize(
            ((total / avg) - Decimal("1.0")) * Decimal("100.0"), precision=2, cast=float
        ),
        "future": future,
    }


def test_should_create_multiple_expenses_if_installments(client):
    # GIVEN
    INSTALLMENTS = 3
    data = {
        "price": 10.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.bank_slip,
        "installments": INSTALLMENTS,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Expense.objects.count() == INSTALLMENTS
    for i, expense in enumerate(Expense.objects.all().order_by("created_at")):
        assert expense.created_at.month == i + 1
        assert f"({i+1}/{INSTALLMENTS})" in expense.description
        assert round(float(expense.price), 2) == round(data["price"] / INSTALLMENTS, 2)


def test_should_create_one_expenses_if_installments_is_none(client):
    # GIVEN
    data = {
        "price": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.bank_slip,
        "installments": None,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Expense.objects.count() == 1


def test_should_raise_error_if_installments_gt_1_and_is_fixed(client):
    # GIVEN
    data = {
        "price": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.bank_slip,
        "installments": 2,
        "is_fixed": True,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "non_field_errors": ["Fixed expense with installments is not permitted"]
    }


def test_should_create_expense_if_installments_none_and_is_fixed(client):
    # GIVEN
    data = {
        "price": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.bank_slip,
        "installments": None,
        "is_fixed": True,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Expense.objects.count() == 1


from dateutil.relativedelta import relativedelta


@pytest.mark.usefixtures("expenses")
def test_should_create_fixed_expenses_from_last_month(client, user):
    # GIVEN
    today = timezone.now().date()
    one_month_before = today - relativedelta(months=1)

    Expense.objects.create(
        price=12,
        description=f"Test expense ({one_month_before.month:02}/{str(one_month_before.year)[2:]})",
        category=ExpenseCategory.recreation,
        source=ExpenseSource.money,
        is_fixed=True,
        created_at=one_month_before.replace(day=1),
        user=user,
    )
    qs = Expense.objects.filter_by_month_and_year(
        month=one_month_before.month, year=one_month_before.year
    ).filter(is_fixed=True)

    # WHEN
    response = client.post(f"{URL}/fixed_from_last_month")

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert len(response.json()) == qs.count()
    assert response.json()[0]["created_at"] == today.strftime("%Y-%m-%d")
    assert response.json()[1]["created_at"] == today.replace(day=1).strftime("%Y-%m-%d")
    assert all(
        f"({today.month:02}/{str(today.year)[2:]})" in expense["description"]
        for expense in response.json()
    )
