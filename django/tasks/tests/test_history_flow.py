import pytest
from aioresponses import aioresponses
from authentication.tests.conftest import (
    kucoin_client,
    kucoin_secrets,
    user_with_kucoin_integration,
)
from config.settings.base import BASE_API_URL
from variable_income_assets.tests.conftest import kucoin_fetch_transactions_url

from ..choices import TaskStates
from ..constants import ERROR_DISPLAY_TEXT
from ..models import TaskHistory

pytestmark = pytest.mark.django_db

URL = f"/{BASE_API_URL}" + "transactions/integrations/kucoin"


def test_should_create_history_on_success(
    kucoin_client, user_with_kucoin_integration, kucoin_fetch_transactions_url
):
    # GIVEN
    with aioresponses() as aiohttp_mock:
        aiohttp_mock.get(kucoin_fetch_transactions_url, payload={"data": {"items": []}})

        # WHEN
        response = kucoin_client.get(URL)

    # THEN
    history = TaskHistory.objects.get(pk=response.json()["task_id"])
    assert history.name == "sync_kucoin_transactions_task"
    assert history.created_by == user_with_kucoin_integration
    assert history.finished_at is not None
    assert history.state == TaskStates.success
    assert history.notification_display_text == "0 transações encontradas"
    assert not history.error


def test_should_create_history_on_failure(kucoin_client, user_with_kucoin_integration):
    # GIVEN

    # WHEN
    response = kucoin_client.get(URL)

    # THEN
    history = TaskHistory.objects.get(pk=response.json()["task_id"])
    assert history.name == "sync_kucoin_transactions_task"
    assert history.created_by == user_with_kucoin_integration
    assert history.finished_at is not None
    assert history.state == TaskStates.failure
    assert history.notification_display_text == ERROR_DISPLAY_TEXT
    assert history.error
