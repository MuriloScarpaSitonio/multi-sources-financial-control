import operator
from datetime import date
from decimal import Decimal

from django.db.models import Avg, Q
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


@pytest.mark.parametrize("perform", (True, False))
def test__create(client, bank_account, perform):
    # GIVEN
    data = {"value": 1200, "description": "Test", "created_at": "01/01/2021", "is_fixed": True}
    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.post(f"{URL}?perform_actions_on_future_fixed_entities={perform}", data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert Revenue.objects.filter(
        recurring_id__isnull=False, value=1200, description="Test", is_fixed=True
    ).count() == (12 if perform else 1)
    assert Revenue.objects.only("created_at").latest("created_at").created_at == date(
        year=2021, month=(12 if perform else 1), day=1
    )


@pytest.mark.parametrize("value", (10, -10))
def test__update__is_fixed__past__value(client, fixed_revenues, bank_account, value):
    # GIVEN
    revenue = fixed_revenues[0]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value + value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Revenue.objects.get(
            recurring_id__isnull=False, recurring_id=revenue.recurring_id, value=data["value"]
        )
        == revenue
    )
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize(("value", "operation"), ((10, operator.gt), (-10, operator.lt)))
def test__update__is_fixed__current__value(client, fixed_revenues, bank_account, value, operation):
    # GIVEN
    revenue = fixed_revenues[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value + value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount + (data["value"] - revenue.value) == bank_account.amount
    assert operation(bank_account.amount - previous_bank_account_amount, 0)

    assert (
        Revenue.objects.filter(
            recurring_id__isnull=False, recurring_id=revenue.recurring_id, value=data["value"]
        ).count()
        == 10
    )
    assert list(
        Revenue.objects.filter(
            ~Q(value=data["value"]), recurring_id__isnull=False, recurring_id=revenue.recurring_id
        ).values_list("id", flat=True)
    ) == [fixed_revenues[0].id, fixed_revenues[1].id]
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize(("value", "operation"), ((10, operator.gt), (-10, operator.lt)))
def test__update__is_fixed__current__value__only_current(
    client, fixed_revenues, bank_account, value, operation
):
    # GIVEN
    revenue = fixed_revenues[2]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value + value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=false", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount + (data["value"] - revenue.value) == bank_account.amount
    assert operation(bank_account.amount - previous_bank_account_amount, 0)

    assert (
        Revenue.objects.get(
            recurring_id__isnull=False, recurring_id=revenue.recurring_id, value=data["value"]
        )
        == revenue
    )
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize("value", (10, -10))
def test__update__is_fixed__future__value(client, fixed_revenues, bank_account, value):
    # GIVEN
    revenue = fixed_revenues[3]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value + value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Revenue.objects.filter(
            recurring_id__isnull=False, recurring_id=revenue.recurring_id, value=data["value"]
        ).count()
        == 9
    )
    assert list(
        Revenue.objects.filter(
            ~Q(value=data["value"]), recurring_id__isnull=False, recurring_id=revenue.recurring_id
        ).values_list("id", flat=True)
    ) == [fixed_revenues[0].id, fixed_revenues[1].id, fixed_revenues[2].id]
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize("value", (10, -10))
def test__update__is_fixed__future__value__only_current(
    client, fixed_revenues, bank_account, value
):
    # GIVEN
    revenue = fixed_revenues[4]
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value + value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Revenue.objects.get(
            recurring_id__isnull=False, recurring_id=revenue.recurring_id, value=data["value"]
        )
        == revenue
    )
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__past__created_at(client, fixed_revenues, bank_account):
    # GIVEN
    revenue = fixed_revenues[0]
    day = 10 if revenue.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": (revenue.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Revenue.objects.get(
            recurring_id__isnull=False, recurring_id=revenue.recurring_id, created_at__day=day
        )
        == revenue
    )
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__current__created_at(client, fixed_revenues, bank_account):
    # GIVEN
    revenue = fixed_revenues[2]
    day = 10 if revenue.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": (revenue.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Revenue.objects.filter(
            recurring_id__isnull=False, recurring_id=revenue.recurring_id, created_at__day=day
        ).count()
        == 10
    )
    assert list(
        Revenue.objects.filter(
            ~Q(created_at__day=day), recurring_id__isnull=False, recurring_id=revenue.recurring_id
        ).values_list("id", flat=True)
    ) == [fixed_revenues[0].id, fixed_revenues[1].id]
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__current__created_at__only_current(client, fixed_revenues, bank_account):
    # GIVEN
    revenue = fixed_revenues[2]
    day = 10 if revenue.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": (revenue.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=false", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Revenue.objects.get(
            recurring_id__isnull=False, recurring_id=revenue.recurring_id, created_at__day=day
        )
        == revenue
    )
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__future__created_at(client, fixed_revenues, bank_account):
    # GIVEN
    revenue = fixed_revenues[6]
    day = 10 if revenue.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value,
        "description": revenue.description + " abc",
        "created_at": (revenue.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=true", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Revenue.objects.filter(
            recurring_id__isnull=False,
            recurring_id=revenue.recurring_id,
            created_at__day=day,
            description=revenue.description + " abc",
        ).count()
        == 6
    )
    assert list(
        Revenue.objects.filter(
            ~Q(created_at__day=day),
            recurring_id__isnull=False,
            recurring_id=revenue.recurring_id,
            description=revenue.description,
        )
        .order_by("id")
        .values_list("id", flat=True)
    ) == [r.id for idx, r in enumerate(fixed_revenues) if idx < 6]
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


def test__update__is_fixed__future__created_at__only_current(client, fixed_revenues, bank_account):
    # GIVEN
    revenue = fixed_revenues[8]
    day = 10 if revenue.created_at.day != 10 else 11
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value,
        "description": revenue.description + " abc",
        "created_at": (revenue.created_at.replace(day=day)).strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    assert (
        Revenue.objects.get(
            recurring_id__isnull=False,
            recurring_id=revenue.recurring_id,
            created_at__day=day,
            description=revenue.description + " abc",
        )
        == revenue
    )
    assert Revenue.objects.values("created_at__month", "created_at__year").distinct().count() == 12


@pytest.mark.parametrize("perform", (True, False))
def test__update__is_fixed__false_to_true(client, revenue, bank_account, perform):
    # GIVEN
    revenue.is_fixed = False
    revenue.recurring_id = None
    revenue.save()

    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value,
        "description": revenue.description + " abc",
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities={perform}", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    revenue.refresh_from_db()
    assert revenue.recurring_id is not None
    assert Revenue.objects.filter(
        recurring_id__isnull=False,
        recurring_id=revenue.recurring_id,
        description=revenue.description,
    ).values("created_at__month", "created_at__year").distinct().count() == (12 if perform else 1)


@pytest.mark.parametrize("perform", (True, False))
def test__update__is_fixed__false_to_true__past_month(client, revenue, bank_account, perform):
    # GIVEN
    revenue.is_fixed = False
    revenue.recurring_id = None
    revenue.created_at = revenue.created_at - relativedelta(months=1)
    revenue.save()
    previous_bank_account_amount = bank_account.amount

    data = {
        "value": revenue.value,
        "description": revenue.description + " abc",
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities={perform}", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    bank_account.refresh_from_db()
    assert bank_account.amount - previous_bank_account_amount == 0

    revenue.refresh_from_db()
    assert revenue.recurring_id is not None
    assert (
        Revenue.objects.filter(
            recurring_id__isnull=False,
            recurring_id=revenue.recurring_id,
            description=revenue.description,
        )
        .values("created_at__month", "created_at__year")
        .distinct()
        .count()
        == 1
    )


@pytest.mark.parametrize("perform", (True, False))
def test__update__is_fixed__true_to_false(client, fixed_revenues, perform):
    # GIVEN
    revenue = fixed_revenues[2]
    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": False,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities={perform}", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    revenue.refresh_from_db()
    assert revenue.recurring_id is None and not revenue.is_fixed
    assert Revenue.objects.filter(
        recurring_id__isnull=False,
    ).values(
        "created_at__month", "created_at__year"
    ).distinct().count() == (2 if perform else 11)


@pytest.mark.parametrize("perform", (True, False))
def test__update__is_fixed__true_to_false__past_month(client, fixed_revenues, perform):
    # GIVEN
    revenue = fixed_revenues[1]
    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": revenue.created_at.strftime("%d/%m/%Y"),
        "is_fixed": False,
    }

    # WHEN
    response = client.put(
        f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities={perform}", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    revenue.refresh_from_db()
    assert revenue.recurring_id is None and not revenue.is_fixed
    assert (
        Revenue.objects.filter(
            recurring_id__isnull=True,
        )
        .values("created_at__month", "created_at__year")
        .distinct()
        .count()
        == 1
    )


@pytest.mark.parametrize("delta", ({"months": 1}, {"months": -1}, {"years": 1}, {"years": -1}))
def test__update__is_fixed__past__created_at__to_another_month(client, fixed_revenues, delta):
    # GIVEN
    revenue = fixed_revenues[0]

    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": (revenue.created_at + relativedelta(**delta)).strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "created_at": "Você só pode alterar a data de uma receita fixa passada dentro do mesmo mês"
    }


@pytest.mark.parametrize("delta", ({"months": 1}, {"months": -1}, {"years": 1}, {"years": -1}))
def test__update__is_fixed__current__created_at__to_another_month(client, fixed_revenues, delta):
    # GIVEN
    revenue = fixed_revenues[2]

    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": (revenue.created_at + relativedelta(**delta)).strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "created_at": "Você só pode alterar a data de uma receita fixa passada dentro do mesmo mês"
    }


@pytest.mark.parametrize("delta", ({"months": 1}, {"months": -1}, {"years": 1}, {"years": -1}))
def test__update__is_fixed__future__created_at__to_another_month(client, fixed_revenues, delta):
    # GIVEN
    revenue = fixed_revenues[6]

    data = {
        "value": revenue.value,
        "description": revenue.description,
        "created_at": (revenue.created_at + relativedelta(**delta)).strftime("%d/%m/%Y"),
        "is_fixed": True,
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "created_at": "Você só pode alterar a data de uma receita fixa passada dentro do mesmo mês"
    }


def test__delete__is_fixed__past(client, fixed_revenues, bank_account):
    # GIVEN
    revenue = fixed_revenues[0]

    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=true")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Revenue.objects.filter(recurring_id__isnull=False, recurring_id=revenue.recurring_id)
        .values("created_at__month", "created_at__year")
        .count()
        == 11
    )


def test__delete__is_fixed__current(client, fixed_revenues, bank_account):
    # GIVEN
    revenue = fixed_revenues[2]

    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=true")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount - revenue.value == bank_account.amount

    assert (
        Revenue.objects.filter(recurring_id__isnull=False, recurring_id=revenue.recurring_id)
        .values("created_at__month", "created_at__year")
        .count()
        == 2
    )
    assert list(
        Revenue.objects.filter(recurring_id__isnull=False, recurring_id=revenue.recurring_id)
        .order_by("id")
        .values_list("id", flat=True)
    ) == [fixed_revenues[0].id, fixed_revenues[1].id]


def test__delete__is_fixed__future(client, fixed_revenues, bank_account):
    # GIVEN
    revenue = fixed_revenues[7]

    previous_bank_account_amount = bank_account.amount

    # WHEN
    response = client.delete(f"{URL}/{revenue.pk}?perform_actions_on_future_fixed_entities=true")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT

    bank_account.refresh_from_db()
    assert previous_bank_account_amount == bank_account.amount

    assert (
        Revenue.objects.filter(recurring_id__isnull=False, recurring_id=revenue.recurring_id)
        .values("created_at__month", "created_at__year")
        .count()
        == 7
    )
    assert list(
        Revenue.objects.filter(
            recurring_id__isnull=False,
            recurring_id=revenue.recurring_id,
        )
        .order_by("id")
        .values_list("id", flat=True)
    ) == [r.id for idx, r in enumerate(fixed_revenues) if idx < 7]
