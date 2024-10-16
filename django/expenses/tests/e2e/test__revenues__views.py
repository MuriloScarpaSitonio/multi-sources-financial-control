import operator
from datetime import datetime
from decimal import Decimal

from django.db.models import Avg
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
from shared.tests import convert_and_quantitize

from ...models import Revenue

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "revenues"


@pytest.mark.usefixtures("revenues")
@pytest.mark.parametrize(
    "filter_by, count",
    [
        ("", 12),
        ("description=Revenue", 12),
        ("description=rev", 12),
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


@pytest.mark.parametrize("is_fixed", (True, False))
def test__list__include_date_fixed_revenue(client, revenue, is_fixed):
    # GIVEN
    revenue.is_fixed = is_fixed
    revenue.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    if is_fixed:
        assert response.json()["results"][0]["full_description"] == revenue.full_description
    else:
        assert response.json()["results"][0]["full_description"] == revenue.description


def test__create__past(client, bank_account):
    # GIVEN
    data = {"value": 1200, "description": "Test", "created_at": "01/01/2021"}
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert Revenue.objects.count() == 1

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


def test__create__current(client, bank_account):
    # GIVEN
    today = timezone.localdate()
    data = {"value": 1200, "description": "Test", "created_at": today.strftime("%d/%m/%Y")}
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert Revenue.objects.count() == 1

    bank_account.refresh_from_db()
    assert previous_bank_account_amount + data["value"] == bank_account.amount


def test__create__future(client, bank_account):
    # GIVEN
    today = timezone.localdate()
    data = {
        "value": 1200,
        "description": "Test",
        "created_at": (today + relativedelta(months=1)).strftime("%d/%m/%Y"),
    }
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert Revenue.objects.count() == 1

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


@pytest.mark.parametrize("value", (-1, 0))
def test__create__invalid_value(client, value):
    # GIVEN
    data = {"value": value, "description": "Test", "created_at": "01/01/2021"}

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"value": ["Ensure this value is greater than or equal to 0.01."]}


def test__create__future(client, bank_account):
    # GIVEN
    data = {"value": 1000, "description": "Test", "created_at": "01/01/2121"}
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


@pytest.mark.parametrize("value", (1000, -1000, 0))
def test__update__past(client, revenue, bank_account, value):
    # GIVEN
    revenue.is_fixed = False
    revenue.save()

    previous_bank_account_amount = bank_account.amount
    data = {
        "value": revenue.value + value,
        "description": revenue.description + "abc",
        "created_at": "01/01/2021",
        "is_fixed": revenue.is_fixed,
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    revenue.refresh_from_db()
    assert revenue.value == Decimal(data["value"])
    assert revenue.description == data["description"]
    assert revenue.created_at == datetime.strptime(data["created_at"], "%d/%m/%Y").date()


@pytest.mark.parametrize(
    ("value", "operation"), ((1000, operator.gt), (-1000, operator.lt), (0, operator.eq))
)
def test__update__current(client, revenue, bank_account, value, operation):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": revenue.value + value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": revenue.is_fixed,
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount + value == bank_account.amount
    assert operation(bank_account.amount - previous_bank_account_amount, 0)

    revenue.refresh_from_db()
    assert revenue.value == Decimal(data["value"])
    assert revenue.description == data["description"]
    assert revenue.created_at == datetime.strptime(data["created_at"], "%d/%m/%Y").date()


@pytest.mark.parametrize("value", (1000, -1000, 0))
def test__update__future(client, revenue, bank_account, value):
    # GIVEN
    revenue.is_fixed = False
    revenue.save()

    previous_bank_account_amount = bank_account.amount
    data = {
        "value": revenue.value + value,
        "description": revenue.description,
        "created_at": revenue.created_at + relativedelta(months=1),
        "is_fixed": revenue.is_fixed,
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    revenue.refresh_from_db()
    assert revenue.value == Decimal(data["value"])
    assert revenue.created_at == datetime.strptime(data["created_at"], "%d/%m/%Y").date()


@pytest.mark.parametrize("value", (-1, 0))
def test__update__invalid_value(client, revenue, value):
    # GIVEN
    data = {"value": value, "description": "Test", "created_at": "01/01/2021"}

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"value": ["Ensure this value is greater than or equal to 0.01."]}


def test__update__future(client, revenue, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount
    data = {
        "value": 1222,
        "description": "Test",
        "created_at": "01/01/2221",
        "is_fixed": False,
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


def test__delete(client, revenue, bank_account):
    # GIVEN
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{revenue.pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert not Revenue.objects.exists()

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - revenue.value == bank_account.amount


@pytest.mark.usefixtures("revenues_historic_data")
@pytest.mark.parametrize(
    ("filters", "db_filters"),
    (
        ("is_fixed=false", {"is_fixed": False}),
        ("is_fixed=true", {"is_fixed": True}),
        ("", {}),
    ),
)
def test__historic(client, user, filters, db_filters):
    # GIVEN
    today = timezone.now().date()
    qs = Revenue.objects.filter(user_id=user.id, **db_filters)

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
        qs.monthly_avg()["avg"]
    )


@pytest.mark.usefixtures("revenues_historic_data")
def test__indicators(client, user):
    # GIVEN
    today = timezone.localdate()
    qs = Revenue.objects.filter(user_id=user.id)
    avg = (
        qs.since_a_year_ago()
        .exclude(created_at__month=today.month, created_at__year=today.year)
        .trunc_months()
        .aggregate(avg=Avg("total"))["avg"]
    )
    total = Revenue.objects.filter(
        created_at__month=today.month, created_at__year=today.year
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
    }


@pytest.mark.usefixtures("revenues_historic_data")
def test__sum(client, user):
    # GIVEN
    today = timezone.localdate()
    one_month_later = today + relativedelta(months=1)
    total = Revenue.objects.filter(
        user_id=user.id, created_at__range=(today, one_month_later)
    ).sum()["total"]

    # WHEN
    response = client.get(
        f"{URL}/sum?start_date={today.strftime('%d/%m/%Y')}"
        + f"&end_date={one_month_later.strftime('%d/%m/%Y')}"
    )

    # THEN
    response_json = response.json()

    assert response.status_code == HTTP_200_OK
    assert response_json == {"total": convert_and_quantitize(total)}


@pytest.mark.usefixtures("revenues_historic_data")
def test__avg(client, user):
    # GIVEN
    today = timezone.localdate()
    avg = (
        Revenue.objects.filter(user_id=user.id)
        .since_a_year_ago()
        .exclude(created_at__month=today.month, created_at__year=today.year)
        .trunc_months()
        .aggregate(avg=Avg("total"))["avg"]
    )

    # WHEN
    response = client.get(f"{URL}/avg")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == {"avg": convert_and_quantitize(avg)}


@pytest.mark.usefixtures("revenues_historic_data")
def test__higher_value(client, user):
    # GIVEN
    today = timezone.localdate()
    one_month_later = today + relativedelta(months=1)
    revenue = max(
        Revenue.objects.filter(user_id=user.id, created_at__range=(today, one_month_later)),
        key=lambda e: e.value,
    )

    # WHEN
    response = client.get(
        f"{URL}/higher_value?start_date={today.strftime('%d/%m/%Y')}"
        + f"&end_date={one_month_later.strftime('%d/%m/%Y')}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["id"] == revenue.id


def test__indicators__wo_data(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json() == {"total": 0.0, "avg": 0.0, "diff": 0.0}


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
