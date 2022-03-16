from django.utils import timezone

import pytest

from rest_framework.status import HTTP_200_OK

from authentication.tests.conftest import client, secrets, user
from config.settings.base import BASE_API_URL
from variable_income_assets.models import Transaction
from variable_income_assets.tests.conftest import simple_asset, transactions

from ..models import TaskHistory


pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "tasks"


@pytest.mark.usefixtures("transactions")
def test_should_list_tasks(client, simple_task_history):
    # GIVEN
    fields = (
        "id",
        "name",
        "state",
        "started_at",
        "finished_at",
        "error",
        "transactions",
        "incomes",
    )

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == TaskHistory.objects.count()
    for result in response.json()["results"]:
        assert all(field_name in result.keys() for field_name in fields)
        assert (
            len(result["transactions"])
            == Transaction.objects.filter(fetched_by=simple_task_history).count()
        )


@pytest.mark.usefixtures("transactions")
@pytest.mark.parametrize(
    "filter_by, count",
    [("", 1), ("notified=true", 0), ("notified=false", 1)],
)
def test_should_filter_tasks(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count


@pytest.mark.usefixtures("transactions")
def test_should_filter_notified_if_notified_at_is_not_null(client, simple_task_history):
    # GIVEN
    simple_task_history.notified_at = timezone.now()
    simple_task_history.save(update_fields=("notified_at",))

    # WHEN
    response = client.get(f"{URL}?notified=True")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == 1

@pytest.mark.usefixtures("transactions")
@pytest.mark.parametrize(
    "filter_by, count",
    [("", 1), ("notified=true", 0), ("notified=false", 1)],
)
def test_should_count_tasks(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/count?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["total"] == count