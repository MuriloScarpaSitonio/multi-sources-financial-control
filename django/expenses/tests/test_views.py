from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from statistics import fmean
from typing import Literal

from django.db.models import Avg, Q
from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
)

from config.settings.base import BASE_API_URL
from expenses.choices import ExpenseCategory, ExpenseReportType, ExpenseSource
from expenses.models import Expense

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "expenses"


def _convert_and_quantize(
    value: str | float | int | Decimal | None, precision: int = 1, cast: type = Decimal
) -> Decimal | None:
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
        ("is_fixed=False", 6),
        ("is_fixed=True", 6),
    ],
)
def test__list(client, filter_by, count):
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
def test__list__filter_by_choice(client, field, value):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{field}={value}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert (
        response.json()["count"]
        == Expense.objects.current_month_and_past().filter(**{field: value}).count()
    )


@pytest.mark.usefixtures("expenses2")
@pytest.mark.parametrize(
    "filter_date_type, filter_field, count",
    (
        (None, None, 24),
        ("future", "start", 24),
        ("current", "start", 25),
        ("future", "end", 25),
        ("current", "end", 24),
    ),
)
def test__list__filter_by_date(
    client,
    filter_date_type: Literal["future", "current"] | None,
    filter_field: Literal["start", "end"] | None,
    count,
):
    # GIVEN
    if filter_date_type is None or filter_field is None:
        f = ""
        order_by = "-created_at"
    else:
        if filter_date_type == "future":
            d = str(timezone.now().date() + relativedelta(months=1))
        elif filter_date_type == "current":
            d = str(timezone.now().date())

        if filter_field == "start":
            f = f"start_date={d}"
            order_by = "created_at"
        elif filter_field == "end":
            f = f"end_date={d}"
            order_by = "-created_at"

    # WHEN
    response = client.get(f"{URL}?{f}&page_size=100")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count
    assert (
        Expense.objects.order_by(order_by).only("id").last().id
        == response.json()["results"][-1]["id"]
    )


@pytest.mark.parametrize("is_fixed", (True, False))
def test__list__include_date_fixed_expense(client, expense, is_fixed):
    # GIVEN
    expense.is_fixed = is_fixed
    expense.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    if is_fixed:
        assert response.json()["results"][0]["full_description"] == expense.full_description
    else:
        assert response.json()["results"][0]["full_description"] == expense.description


@pytest.mark.usefixtures("expenses_w_installments")
def test__list__installments(client):
    # GIVEN
    f = f"start_date={str(timezone.now().date() + relativedelta(months=1))}"

    # WHEN
    response = client.get(f"{URL}?{f}&page_size=100")

    # THEN
    assert response.status_code == HTTP_200_OK

    for r in response.json()["results"]:
        assert r["id"] == int(r["full_description"].split("(")[-1][0])


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


def test__update(client, expense):
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


def test__update__installments(client, expenses_w_installments):
    # GIVEN
    e = expenses_w_installments[0]
    data = {
        "price": e.price + 10,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    assert Expense.objects.filter(
        installments_id=e.installments_id, price=data["price"]
    ).count() == len(expenses_w_installments)


def test__update__installments__created_at(client, expenses_w_installments):
    # GIVEN
    e = expenses_w_installments[0]
    created_at = datetime(year=2021, month=12, day=3)
    data = {
        "price": e.price,
        "description": e.description,
        "category": e.category,
        "created_at": created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    for i, expense in enumerate(
        Expense.objects.filter(installments_id=e.installments_id, price=data["price"]).order_by(
            "created_at"
        )
    ):
        assert expense.created_at == (created_at + relativedelta(months=i)).date()
        assert expense.id == expense.installment_number


def test__update__installments__created_at__not_1st_installment(client, expenses_w_installments):
    # GIVEN
    e = expenses_w_installments[3]
    created_at = datetime(year=2021, month=12, day=3)
    data = {
        "price": e.price,
        "description": e.description,
        "category": e.category,
        "created_at": created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "created_at": ["You can only update the date of the first installment"]
    }


def test_should_partial_update_expense(client, expense):
    # GIVEN
    data = {"price": 12.00}

    # WHEN
    response = client.patch(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    expense.refresh_from_db()
    assert expense.price == Decimal(data["price"])


def test__delete(client, expense):
    # GIVEN

    # WHEN
    response = client.delete(f"{URL}/{expense.pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert not Expense.objects.exists()


def test__delete__installments(client, expenses_w_installments):
    # GIVEN

    # WHEN
    response = client.delete(f"{URL}/{expenses_w_installments[3].pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert not Expense.objects.exists()


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


@pytest.mark.parametrize("of", list(ExpenseReportType.values))
def test__report__wo_data(client, of):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/report?of={of}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == []


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


@pytest.mark.usefixtures("report_data")
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
        "future": _convert_and_quantize(future, precision=2, cast=float),
    }


def test__indicators__wo_data(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == {"total": 0.0, "avg": 0.0, "diff": 0.0, "future": 0.0}


def test__create__installments(client):
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
    assert Expense.objects.filter(installments_id__isnull=False).count() == INSTALLMENTS
    for i, expense in enumerate(
        Expense.objects.filter(installments_id__isnull=False).order_by("created_at")
    ):
        assert expense.created_at.month == i + 1
        assert f"({i+1}/{INSTALLMENTS})" in expense.full_description
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
