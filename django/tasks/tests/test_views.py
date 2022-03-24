from uuid import uuid4
from django.utils import timezone

import pytest

from rest_framework.status import HTTP_200_OK

from authentication.tests.conftest import client, secrets, user
from config.settings.base import BASE_API_URL
from variable_income_assets.models import Transaction
from variable_income_assets.tests.conftest import simple_asset, transactions

from ..bases import TaskWithHistory
from ..choices import TaskStates
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
        "notified_at",
        "updated_at",
        "opened_at",
        "transactions",
        "incomes",
        "notification_display_text",
        "notification_display_title",
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


@pytest.mark.parametrize(
    "task_name, expected_notification_display_text",
    [
        ("fetch_current_assets_prices", "Preços atualizados"),
        ("sync_cei_transactions_task", "0 transações encontradas"),
        ("sync_binance_transactions_task", "0 transações encontradas"),
        ("sync_kucoin_transactions_task", "0 transações encontradas"),
        ("sync_cei_passive_incomes_task", "0 rendimentos passivos encontrados"),
    ],
)
def test_should_notification_display_correctly(
    client, simple_task_history, task_name, expected_notification_display_text
):
    # GIVEN
    simple_task_history.name = task_name
    simple_task_history.save()

    # WHEN
    response = client.get(URL)
    result = response.json()["results"][0]

    # THEN
    assert response.status_code == HTTP_200_OK

    assert result["notification_display_text"] == expected_notification_display_text

    # we have to load it after the request
    tasks_notification_display_map = TaskWithHistory.get_notification_display_map()
    expected_notification_display_title = "Integração '{}' {}".format(
        tasks_notification_display_map[simple_task_history.name],
        TaskStates.get_choice(simple_task_history.state).notification_display,
    )
    assert result["notification_display_title"] == expected_notification_display_title


def test_should_notification_display_error_correctly(client, simple_task_history):
    # GIVEN
    simple_task_history.state = TaskStates.failure
    simple_task_history.save()

    # WHEN
    response = client.get(URL)
    result = response.json()["results"][0]

    # THEN
    assert response.status_code == HTTP_200_OK
    assert (
        result["notification_display_text"]
        == "Por favor, clique para visitar a página da tarefa e ver o erro completo"
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


@pytest.mark.usefixtures("transactions")
def test_should_bulk_update_notified_at(client, simple_task_history):
    # GIVEN

    # WHEN
    response = client.post(f"{URL}/bulk_update_notified_at", data={"ids": [simple_task_history.id]})

    # THEN
    assert response.status_code == HTTP_200_OK

    simple_task_history.refresh_from_db()
    assert simple_task_history.notified_at is not None


@pytest.mark.usefixtures("transactions")
def test_should_bulk_update_notified_at_even_if_wrong_task_id_in_payload(
    client, simple_task_history
):
    # GIVEN

    # WHEN
    response = client.post(
        f"{URL}/bulk_update_notified_at", data={"ids": [simple_task_history.id, str(uuid4())]}
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    simple_task_history.refresh_from_db()
    assert simple_task_history.notified_at is not None


@pytest.mark.usefixtures("transactions")
def test_should_not_bulk_update_notified_at_if_already_notified(client, simple_task_history):
    # GIVEN
    NOW = timezone.now()
    simple_task_history.notified_at = NOW
    simple_task_history.save(update_fields=("notified_at",))

    # WHEN
    response = client.post(f"{URL}/bulk_update_notified_at", data={"ids": [simple_task_history.id]})

    # THEN
    assert response.status_code == HTTP_200_OK

    simple_task_history.refresh_from_db()
    assert simple_task_history.notified_at == NOW
