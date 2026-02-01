from uuid import uuid4

from django.utils import timezone

import pytest
from asgiref.sync import async_to_sync
from rest_framework.status import HTTP_200_OK

from authentication.tests.conftest import client, secrets, user
from config.settings.base import BASE_API_URL

from ..choices import TaskStates
from ..constants import ERROR_DISPLAY_TEXT

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "tasks"


@pytest.mark.parametrize(
    "task_name, expected_notification_display_text",
    [
        ("sync_binance_transactions_task", "0 transações encontradas"),
        ("sync_kucoin_transactions_task", "0 transações encontradas"),
    ],
)
def test__list__notification_display(
    client, simple_task_history, task_name, expected_notification_display_text
):
    # GIVEN
    simple_task_history.name = task_name
    simple_task_history.notification_display_text = expected_notification_display_text
    simple_task_history.save()

    # WHEN
    response = client.get(URL)
    result = response.json()["results"][0]

    # THEN
    assert response.status_code == HTTP_200_OK

    assert result["notification_display_text"] == expected_notification_display_text

    tasks_notification_display_map = {
        "sync_binance_transactions_task": "Transações da Binance",
        "sync_kucoin_transactions_task": "Transações da KuCoin",
    }
    expected_notification_display_title = (
        f"Integração '{tasks_notification_display_map[simple_task_history.name]}' "
        f"{TaskStates.get_choice(simple_task_history.state).notification_display}"
    )
    assert result["notification_display_title"] == expected_notification_display_title


def test__notification_display_text__error(client, simple_task_history):
    # GIVEN
    async_to_sync(simple_task_history.finish)(exc=Exception("Error!"))

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["results"][0]["notification_display_text"] == ERROR_DISPLAY_TEXT


@pytest.mark.usefixtures("simple_task_history")
@pytest.mark.parametrize(
    "filter_by, count",
    [("", 1), ("notified=true", 0), ("notified=false", 1)],
)
def test__filter(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count


def test__filter__notified__notified_at_is_not_null(client, simple_task_history):
    # GIVEN
    simple_task_history.notified_at = timezone.now()
    simple_task_history.save(update_fields=("notified_at",))

    # WHEN
    response = client.get(f"{URL}?notified=True")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == 1


@pytest.mark.usefixtures("simple_task_history")
@pytest.mark.parametrize(
    "filter_by, count",
    [("", 1), ("notified=true", 0), ("notified=false", 1)],
)
def test__count(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/count?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["total"] == count


def test__bulk_update_notified_at(client, simple_task_history):
    # GIVEN

    # WHEN
    response = client.post(f"{URL}/bulk_update_notified_at", data={"ids": [simple_task_history.id]})

    # THEN
    assert response.status_code == HTTP_200_OK

    simple_task_history.refresh_from_db()
    assert simple_task_history.notified_at is not None


def test__bulk_update_notified_at__even_if_wrong_task_id(client, simple_task_history):
    # GIVEN

    # WHEN
    response = client.post(
        f"{URL}/bulk_update_notified_at", data={"ids": [simple_task_history.id, str(uuid4())]}
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    simple_task_history.refresh_from_db()
    assert simple_task_history.notified_at is not None


def test__bulk_update_notified_at__dont_if_already_notified(client, simple_task_history):
    # GIVEN
    now = timezone.now()
    simple_task_history.notified_at = now
    simple_task_history.save(update_fields=("notified_at",))

    # WHEN
    response = client.post(f"{URL}/bulk_update_notified_at", data={"ids": [simple_task_history.id]})

    # THEN
    assert response.status_code == HTTP_200_OK

    simple_task_history.refresh_from_db()
    assert simple_task_history.notified_at == now
