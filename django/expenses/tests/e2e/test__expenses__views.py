import operator
from datetime import datetime
from decimal import Decimal
from statistics import fmean
from typing import Literal

from django.db.models import Avg, Q, Sum
from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
)

from config.settings.base import BASE_API_URL
from shared.tests import convert_and_quantitize, convert_to_percentage_and_quantitize

from ...choices import ExpenseCategory, ExpenseReportType, ExpenseSource
from ...models import Expense

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
        (None, None, 48),
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
            d = str(timezone.localdate() + relativedelta(months=1))
        elif filter_date_type == "current":
            d = str(timezone.localdate())

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
    f = f"start_date={str(timezone.localdate() + relativedelta(months=1))}"

    # WHEN
    response = client.get(f"{URL}?{f}&page_size=100")

    # THEN
    assert response.status_code == HTTP_200_OK

    for r in response.json()["results"]:
        assert r["id"] == int(r["full_description"].split("(")[-1][0])


def test__create(client, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": 12.00,
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

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - data["value"] == bank_account.amount


def test__create__future__not_credit_card(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2121",
        "source": ExpenseSource.bank_slip,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "created_at__source": "Uma despesa futura só pode ser realizada usando cartão de crédito"
    }


def test__create__future__credit_card(client, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2121",
        "source": ExpenseSource.credit_card,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


def test__create__installments(client, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    installments = 3
    data = {
        "value": 12,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.credit_card,
        "installments": installments,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Expense.objects.filter(installments_id__isnull=False).count() == installments
    for i, expense in enumerate(
        Expense.objects.filter(installments_id__isnull=False).order_by("created_at")
    ):
        assert expense.created_at.month == i + 1
        assert f"({i+1}/{installments})" in expense.full_description
        assert expense.value == data["value"] / installments

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - (data["value"] / installments) == bank_account.amount


def test__create__installments__none(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.credit_card,
        "installments": None,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Expense.objects.count() == 1


def test__create__installments__none__is_fixed(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.credit_card,
        "installments": None,
        "is_fixed": True,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Expense.objects.count() == 1


def test__create__installments__gt_1__is_fixed(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.credit_card,
        "installments": 2,
        "is_fixed": True,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"installments": "Despesas fixas não podem ser parceladas"}


def test__create__installments__source_not_credit_card(client):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.bank_slip,
        "installments": 2,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"installments": "Despesas parceladas devem ser no cartão de crédito"}


@pytest.mark.parametrize("value", (-1, 0))
def test__create__invalid_value(client, value):
    # GIVEN
    data = {
        "value": value,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.bank_slip,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"value": ["Ensure this value is greater than or equal to 0.01."]}


@pytest.mark.parametrize(
    ("value", "operation"), ((10, operator.lt), (-10, operator.gt), (0, operator.eq))
)
def test__update(client, expense, bank_account, value, operation):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": expense.value + value,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2021",
        "source": ExpenseSource.bank_slip,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - value == bank_account.amount
    assert operation(bank_account.amount - previous_bank_account_amount, 0)

    expense.refresh_from_db()
    assert expense.value == Decimal(data["value"])
    assert expense.description == data["description"]
    assert expense.category == data["category"]
    assert expense.created_at == datetime.strptime(data["created_at"], "%d/%m/%Y").date()
    assert expense.source == data["source"]
    assert not expense.is_fixed


def test__update__future__not_credit_card(client, expense):
    # GIVEN
    data = {
        "value": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2121",
        "source": ExpenseSource.bank_slip,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {
        "created_at__source": "Uma despesa futura só pode ser realizada usando cartão de crédito"
    }


def test__update__future__credit_card(client, expense, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": 12.00,
        "description": "Test",
        "category": ExpenseCategory.house,
        "created_at": "01/01/2121",
        "source": ExpenseSource.credit_card,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


@pytest.mark.parametrize(
    ("value", "operation"), ((10, operator.lt), (-10, operator.gt), (0, operator.eq))
)
def test__update__installments__value(
    client, expenses_w_installments, bank_account, value, operation
):
    # GIVEN
    for e in expenses_w_installments:
        e.created_at -= relativedelta(months=2)
        e.save()
    previous_bank_account_amount = bank_account.amount
    e = expenses_w_installments[0]
    data = {
        "value": e.value + value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    already_decremented_expenses_count = Expense.objects.filter(
        installments_id=e.installments_id, created_at__lte=timezone.localdate()
    ).count()

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert (
        previous_bank_account_amount
        - (already_decremented_expenses_count * (data["value"] - e.value))
        == bank_account.amount
    )
    assert operation(bank_account.amount - previous_bank_account_amount, 0)

    assert Expense.objects.filter(
        installments_id=e.installments_id, value=data["value"]
    ).count() == len(expenses_w_installments)


@pytest.mark.parametrize(
    ("value", "operation"), ((10, operator.lt), (-10, operator.gt), (0, operator.eq))
)
def test__update__installments__value__not_1st_expense(
    client, expenses_w_installments, bank_account, value, operation
):
    # GIVEN
    for e in expenses_w_installments:
        e.created_at -= relativedelta(months=2)
        e.save()
    previous_bank_account_amount = bank_account.amount
    e = expenses_w_installments[2]
    data = {
        "value": e.value + value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    already_decremented_expenses_count = Expense.objects.filter(
        installments_id=e.installments_id, created_at__lte=timezone.localdate()
    ).count()

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert (
        previous_bank_account_amount
        - (already_decremented_expenses_count * (data["value"] - e.value))
        == bank_account.amount
    )

    assert Expense.objects.filter(
        installments_id=e.installments_id, value=data["value"]
    ).count() == len(expenses_w_installments)


def test__update__installments__created_at_and_value(client, expenses_w_installments, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    e = expenses_w_installments[0]
    created_at = datetime(year=2021, month=12, day=3)
    data = {
        "value": e.value + 10,
        "description": e.description,
        "category": e.category,
        "created_at": created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    already_decremented_expenses_count = Expense.objects.filter(
        installments_id=e.installments_id, created_at__lte=timezone.localdate()
    ).count()

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert (
        previous_bank_account_amount
        - (already_decremented_expenses_count * (data["value"] - e.value))
        == bank_account.amount
    )

    for i, expense in enumerate(
        Expense.objects.filter(installments_id=e.installments_id, value=data["value"]).order_by(
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
        "value": e.value,
        "description": e.description,
        "category": e.category,
        "created_at": created_at.strftime("%d/%m/%Y"),
        "source": e.source,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"created_at": "Você só pode alterar a data da primeira parcela"}


def test__update__installments__is_fixed(client, expenses_w_installments):
    # GIVEN
    e = expenses_w_installments[2]
    data = {
        "value": e.value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": e.source,
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"installments": "Despesas fixas não podem ser parceladas"}


def test__update__installments__source_not_credit_card(client, expenses_w_installments):
    # GIVEN
    e = expenses_w_installments[4]
    data = {
        "value": e.value,
        "description": e.description,
        "category": e.category,
        "created_at": e.created_at.strftime("%d/%m/%Y"),
        "source": ExpenseSource.bank_slip,
    }

    # WHEN
    response = client.put(f"{URL}/{e.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"installments": "Despesas parceladas devem ser no cartão de crédito"}


@pytest.mark.parametrize("value", (-1, 0))
def test__update__invalid_value(client, expense, value):
    # GIVEN
    data = {
        "value": value,
        "description": expense.description,
        "category": expense.category,
        "created_at": expense.created_at.strftime("%d/%m/%Y"),
        "source": expense.source,
    }

    # WHEN
    response = client.put(f"{URL}/{expense.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"value": ["Ensure this value is greater than or equal to 0.01."]}


def test__delete(client, expense, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{expense.pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount + expense.value == bank_account.amount

    assert not Expense.objects.exists()


def test__delete__installments(client, expenses_w_installments, bank_account):
    # GIVEN
    for e in expenses_w_installments:
        e.created_at -= relativedelta(months=1)
        e.save()

    incremented_value = Expense.objects.filter(
        installments_id=e.installments_id, created_at__lte=timezone.localdate()
    ).aggregate(total=Sum("value"))["total"]
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{e.pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount + incremented_value == bank_account.amount

    assert not Expense.objects.exists()


@pytest.mark.usefixtures("expenses_report_data")
@pytest.mark.parametrize(
    ("filters", "db_filters"),
    (
        ("future=false", {}),
        ("future=true", {}),
        (f"future=false&category={ExpenseCategory.cnpj}", {"category": ExpenseCategory.cnpj}),
    ),
)
def test__historic(client, user, filters, db_filters):
    # GIVEN
    today = timezone.localdate()
    qs = Expense.objects.filter(user_id=user.id, **db_filters)

    # WHEN
    response = client.get(f"{URL}/historic?{filters}")
    response_json = response.json()

    # THEN
    assert response.status_code == HTTP_200_OK

    total = 0
    for result in response_json["historic"]:
        d = datetime.strptime(result["month"], "%d/%m/%Y").date()
        assert convert_and_quantitize(result["total"]) == convert_and_quantitize(
            qs.filter(created_at__month=d.month, created_at__year=d.year).sum()["total"]
        )
        if d == today.replace(day=1):  # we don't evaluate the current month on the avg calculation
            continue
        total += result["total"]

    assert convert_and_quantitize(response_json["avg"]) == convert_and_quantitize(
        qs.monthly_avg()["avg"] if "future=true" not in filters else 0
    )


@pytest.mark.usefixtures("expenses_report_data")
def test__indicators(client, user):
    # GIVEN
    today = timezone.localdate()
    qs = Expense.objects.filter(user_id=user.id)
    avg = (
        qs.since_a_year_ago()
        .exclude(created_at__month=today.month, created_at__year=today.year)
        .trunc_months()
        .aggregate(avg=Avg("total"))["avg"]
    )
    total = Expense.objects.filter(
        created_at__month=today.month, created_at__year=today.year
    ).sum()["total"]
    future = qs.filter(
        Q(created_at__month__gt=today.month, created_at__year=today.year)
        | Q(created_at__year__gt=today.year)
    ).sum()["total"]

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    response_json = response.json()

    assert response.status_code == HTTP_200_OK
    assert response_json == {
        "total": convert_and_quantitize(total),
        "avg": convert_and_quantitize(avg),
        "diff": convert_and_quantitize(((total / avg) - Decimal("1.0")) * Decimal("100.0")),
        "future": convert_and_quantitize(future),
    }


@pytest.mark.usefixtures("expenses_report_data")
def test__indicators_v2(client, user):
    # GIVEN
    today = timezone.localdate()
    one_month_later = today + relativedelta(months=1)
    qs = Expense.objects.filter(user_id=user.id)
    avg = (
        qs.since_a_year_ago()
        .exclude(created_at__month=today.month, created_at__year=today.year)
        .trunc_months()
        .aggregate(avg=Avg("total"))["avg"]
    )
    total = Expense.objects.filter(created_at__range=(today, one_month_later)).sum()["total"]

    # WHEN
    response = client.get(
        f"{URL}/v2/indicators?start_date={today.strftime('%d/%m/%Y')}"
        + f"&end_date={one_month_later.strftime('%d/%m/%Y')}"
    )

    # THEN
    response_json = response.json()

    assert response.status_code == HTTP_200_OK
    assert response_json == {
        "total": convert_and_quantitize(total),
        "avg": convert_and_quantitize(avg),
        "diff": convert_and_quantitize(((total / avg) - Decimal("1.0")) * Decimal("100.0")),
    }


def test__indicators__wo_data(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == {"total": 0.0, "avg": 0.0, "diff": 0.0, "future": 0.0}


def test__forbidden__module_not_enabled(user, client):
    # GIVEN
    user.is_personal_finances_module_enabled = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você não tem acesso ao módulo de finanças pessoais"}


def test__forbidden__subscription_ended(client, user):
    # GIVEN
    user.subscription_ends_at = timezone.now()
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Sua assinatura expirou"}


def test__unauthorized__inactive(client, user):
    # GIVEN
    user.is_active = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED
