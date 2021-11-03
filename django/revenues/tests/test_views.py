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

from config.settings.base import BASE_API_URL
from revenues.models import Revenue

pytestmark = pytest.mark.django_db


URL = f"/{BASE_API_URL}" + "revenues"


@pytest.mark.usefixtures("revenues")
@pytest.mark.parametrize(
    "filter_by, count",
    [
        ("", 12),
        ("description=Revenue", 12),
        ("description=VeNue", 12),
        ("description=wrong", 0),
        ("start_date=2021-01-01&end_date=2021-12-01", 12),
        ("start_date=2021-01-01&end_date=2021-01-01", 1),
        ("start_date=2020-01-01&end_date=2020-12-01", 0),
    ],
)
def test_should_filter_revenues(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count


def test_should_create_revenue(client):
    # GIVEN
    data = {
        "value": 12000,
        "description": "Test",
        "created_at": "01/01/2021",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Revenue.objects.count() == 1


def test_should_update_revenue(client, revenue):
    # GIVEN
    data = {
        "value": 12000,
        "description": "Test",
        "created_at": "01/01/2021",
    }

    # WHEN
    response = client.put(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    revenue.refresh_from_db()
    assert revenue.value == Decimal(data["value"])
    assert revenue.description == data["description"]
    assert revenue.created_at == datetime.strptime(data["created_at"], "%d/%m/%Y").date()


def test_should_partial_update_revenue(client, revenue):
    # GIVEN
    data = {"value": 12000}

    # WHEN
    response = client.patch(f"{URL}/{revenue.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK

    revenue.refresh_from_db()
    assert revenue.value == Decimal(data["value"])


def test_should_delete_revenue(client, revenue):
    # GIVEN

    # WHEN
    response = client.delete(f"{URL}/{revenue.pk}")

    # THEN
    assert response.status_code == HTTP_204_NO_CONTENT
    assert Revenue.objects.count() == 0


@freeze_time("2021-10-01")
@pytest.mark.usefixtures("revenues")
def test_should_get_indicators(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    response_json = response.json()
    past_month_total = float(Revenue.objects.filter(created_at__month=9).sum()["total"])

    assert response.status_code == HTTP_200_OK
    assert response_json["total"] == float(
        Revenue.objects.filter(created_at__month=10).sum()["total"]
    )
    assert response_json["diff"] == response_json["total"] - past_month_total
    # assert (
    #     response_json["diff_percentage"]
    #     == (((past_month_total + response_json["diff"]) / past_month_total) - 1) * 100
    # )
