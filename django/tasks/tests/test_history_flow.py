import pytest

from django.conf import settings

from shared.utils import build_url
from authentication.tests.conftest import (
    kucoin_client,
    kucoin_secrets,
    user_with_kucoin_integration,
)

from config.settings.base import BASE_API_URL

from ..choices import TaskStates
from ..models import TaskHistory

pytestmark = pytest.mark.django_db

URL = f"/{BASE_API_URL}" + "assets/sync_kucoin_transactions"


def test_should_create_history_on_success(
    kucoin_client, user_with_kucoin_integration, requests_mock
):
    # GIVEN
    requests_mock.get(
        build_url(url=settings.ASSETS_INTEGRATIONS_URL, parts=("kucoin/", "transactions")), json=[]
    )

    # WHEN
    response = kucoin_client.get(URL)

    # THEN
    history = TaskHistory.objects.get(pk=response.json()["task_id"])
    assert history.name == "sync_kucoin_transactions_task"
    assert history.created_by == user_with_kucoin_integration
    assert history.finished_at is not None
    assert history.state == TaskStates.success
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
    assert history.error
