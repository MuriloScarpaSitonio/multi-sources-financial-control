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
