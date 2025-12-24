import operator
from datetime import datetime
from decimal import Decimal
from statistics import fmean

from django.db.models import Q
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
from shared.tests import (
    calculate_since_year_ago_avg,
    convert_and_quantitize,
    convert_to_percentage_and_quantitize,
    skip_if_sqlite,
)

from ...choices import DEFAULT_REVENUE_CATEGORIES_MAP
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


def test__create__past(client, bank_account, default_revenue_categories_map):
    # GIVEN
    data = {
        "value": 1200,
        "description": "Test",
        "created_at": "01/01/2021",
        "category": "Outros",
    }
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert (
        Revenue.objects.filter(
            category=data["category"],
            expanded_category_id=default_revenue_categories_map[data["category"]],
        ).count()
        == 1
    )

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


def test__create__current(client, bank_account):
    # GIVEN
    today = timezone.localdate()
    data = {
        "value": 1200,
        "description": "Test",
        "created_at": today.strftime("%d/%m/%Y"),
        "category": "Outros",
    }
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
        "category": "Outros",
    }
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    assert Revenue.objects.count() == 1

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount


def test__create__new_category(client):
    # GIVEN
    data = {
        "value": 1200,
        "description": "Test",
        "created_at": "01/01/2021",
        "category": "teste",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"category": "A categoria não existe"}


@pytest.mark.parametrize("value", (-1, 0))
def test__create__invalid_value(client, value):
    # GIVEN
    data = {
        "value": value,
        "description": "Test",
        "created_at": "01/01/2021",
        "category": "Outros",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"value": ["Ensure this value is greater than or equal to 0.01."]}


def test__create__future(client, bank_account):
    # GIVEN
    data = {
        "value": 1000,
        "description": "Test",
        "created_at": "01/01/2121",
        "category": "Outros",
    }
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
        "category": "Outros",
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
        "category": "Outros",
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
        "created_at": (revenue.created_at + relativedelta(months=1)).strftime("%d/%m/%Y"),
        "is_fixed": revenue.is_fixed,
        "category": "Outros",
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
    data = {
        "value": value,
        "description": "Test",
        "created_at": "01/01/2021",
        "category": "Outros",
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"value": ["Ensure this value is greater than or equal to 0.01."]}


def test__update__new_category(client, revenue):
    # GIVEN
    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": revenue.is_fixed,
        "category": "test",
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST

    assert response.json() == {"category": "A categoria não existe"}


def test__update__category(client, revenue, default_revenue_categories_map):
    # GIVEN
    revenue.category = "Outros"
    revenue.expanded_category_id = default_revenue_categories_map[revenue.category]
    revenue.save()

    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": revenue.is_fixed,
        "category": "Salário",
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    revenue.refresh_from_db()
    assert revenue.category == data["category"]
    assert revenue.expanded_category_id == default_revenue_categories_map[data["category"]]


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


@pytest.mark.usefixtures("revenues_report_data")
def test__reports__percentage(client):
    # GIVEN
    today = timezone.localdate()
    start_date, end_date = today - relativedelta(months=18), today
    _map = DEFAULT_REVENUE_CATEGORIES_MAP
    qs = Revenue.objects.filter(created_at__range=(start_date, end_date))
    total = qs.sum()["total"]
    totals = {v: qs.filter(category=v).sum()["total"] for v in _map}

    # WHEN
    response = client.get(
        f"{URL}/percentage_report?"
        + f"&start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}"
    )

    # THEN
    for result in response.json():
        for label in _map:
            if label == result["category"]:
                assert float(
                    convert_to_percentage_and_quantitize(value=totals[label], total=total)
                ) == convert_and_quantitize(result["total"])

    assert response.status_code == HTTP_200_OK


@pytest.mark.usefixtures("revenues_historic_data")
@skip_if_sqlite
def test__indicators(client, user):
    # GIVEN
    today = timezone.localdate()
    qs = Revenue.objects.filter(user_id=user.id)
    avg = calculate_since_year_ago_avg(qs)
    total = Revenue.objects.filter(
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
@skip_if_sqlite
def test__avg(client, user):
    # GIVEN
    avg = calculate_since_year_ago_avg(Revenue.objects.filter(user_id=user.id))

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


@pytest.mark.usefixtures("revenues_historic_data")
def test__historic_report__month(client, user):
    # GIVEN
    today = timezone.localdate().replace(day=12)
    start_date, end_date = today - relativedelta(months=18), today
    last_day_of_month = end_date + relativedelta(day=31)
    Revenue.objects.create(
        created_at=last_day_of_month,
        value=1200,
        description="last_day_of_month",
        category="Outros",
        is_fixed=False,
        user=user,
    )
    qs = Revenue.objects.filter(
        user_id=user.id,
        created_at__gte=start_date.replace(day=1),
        created_at__lte=last_day_of_month,
    )

    # WHEN
    response = client.get(
        f"{URL}/historic_report?start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}&aggregate_period=month"
    )
    response_json = response.json()

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response_json["historic"]:
        d = datetime.strptime(result["month"], "%d/%m/%Y").date()
        assert convert_and_quantitize(result["total"]) == convert_and_quantitize(
            qs.filter(created_at__month=d.month, created_at__year=d.year).sum()["total"]
        )

    assert convert_and_quantitize(response_json["avg"]) == convert_and_quantitize(
        fmean([h["total"] for h in response_json["historic"]])
    )


@pytest.mark.usefixtures("revenues_historic_data")
def test__historic_report__year(client, user):
    # GIVEN
    today = timezone.localdate().replace(day=12)
    start_date, end_date = today - relativedelta(years=3), today
    last_day_of_year = end_date.replace(month=12, day=31)
    Revenue.objects.create(
        created_at=last_day_of_year,
        value=5000,
        description="last_day_of_year",
        category="Outros",
        is_fixed=False,
        user=user,
    )
    # Create additional revenues in different years to test properly
    Revenue.objects.create(
        created_at=start_date.replace(month=6, day=15),
        value=1000,
        description="mid_year_start",
        category="Outros",
        is_fixed=False,
        user=user,
    )
    Revenue.objects.create(
        created_at=(today - relativedelta(years=1)).replace(month=3, day=10),
        value=2000,
        description="last_year",
        category="Outros",
        is_fixed=False,
        user=user,
    )
    qs = Revenue.objects.filter(
        user_id=user.id,
        created_at__gte=start_date.replace(month=1, day=1),
        created_at__lte=last_day_of_year,
    )

    # WHEN
    response = client.get(
        f"{URL}/historic_report?start_date={start_date.strftime('%d/%m/%Y')}"
        + f"&end_date={end_date.strftime('%d/%m/%Y')}&aggregate_period=year"
    )
    response_json = response.json()

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response_json["historic"]:
        d = datetime.strptime(result["year"], "%d/%m/%Y").date()
        assert convert_and_quantitize(result["total"]) == convert_and_quantitize(
            qs.filter(created_at__year=d.year).sum()["total"]
        )

    assert convert_and_quantitize(response_json["avg"]) == convert_and_quantitize(
        fmean([h["total"] for h in response_json["historic"]])
    )
