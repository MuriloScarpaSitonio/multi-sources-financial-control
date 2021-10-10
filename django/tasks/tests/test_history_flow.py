import pytest

from django.conf import settings

from celery import states

from shared.utils import build_url
from authentication.tests.conftest import client, user

from config.settings.base import BASE_API_URL

from ..models import TaskHistory

pytestmark = pytest.mark.django_db

URL = f"/{BASE_API_URL}" + "assets/fetch_cei"


def test_should_create_history_on_success(client, user, requests_mock):
    # GIVEN
    requests_mock.get(
        build_url(url=settings.CRAWLERS_URL, parts=("cei/", "assets")), json=[]
    )

    # WHEN
    response = client.get(URL)

    # THEN
    history = TaskHistory.objects.get(pk=response.json()["task_id"])
    assert history.name == "cei_assets_crawler"
    assert history.created_by == user
    assert history.finished_at is not None
    assert history.state == states.SUCCESS
    assert not history.error


def test_should_create_history_on_failure(client, user):
    # GIVEN

    # WHEN
    response = client.get(URL)

    # THEN
    history = TaskHistory.objects.get(pk=response.json()["task_id"])
    assert history.name == "cei_assets_crawler"
    assert history.created_by == user
    assert history.finished_at is not None
    assert history.state == states.FAILURE
    assert history.error
