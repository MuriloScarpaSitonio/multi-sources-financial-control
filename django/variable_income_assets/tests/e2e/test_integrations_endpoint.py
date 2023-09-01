from django.utils import timezone

import pytest
from rest_framework.status import HTTP_200_OK, HTTP_403_FORBIDDEN

from config.settings.base import BASE_API_URL, ENV_PRODUCTION
from tasks.choices import TaskStates
from tasks.tests.conftest import simple_task_history

pytestmark = pytest.mark.django_db


@pytest.fixture
def in_prod_env(settings):
    settings.ENVIRONMENT = ENV_PRODUCTION


@pytest.mark.parametrize(
    "url",
    ("assets/qstash/update_prices", "transactions/qstash/binance", "transactions/qstash/kucoin"),
)
def test__update_prices(client, url):
    # GIVEN

    # WHEN
    response = client.post(f"/{BASE_API_URL}" + url)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN


@pytest.mark.parametrize("endpoint", ("transactions/integrations/cei", "incomes/integrations/cei"))
def test__deprecated_integrations(client, endpoint):
    # GIVEN

    # WHEN
    response = client.get(f"/{BASE_API_URL}" + endpoint)

    # THEN
    assert response.status_code == 299
    assert response.json() == {"task_id": None, "warning": "Integration is deprecated"}


@pytest.mark.skip("Integration is deprecated")
def test__cei__transactions__user_endpoint(client, user, mocker):
    # GIVEN
    mocked_task = mocker.patch("variable_income_assets.views.sync_cei_transactions_task")

    # WHEN
    response = client.get(f"/{BASE_API_URL}" + "transactions/integrations/cei")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["user_id"] == user.pk


@pytest.mark.skip("Integration is deprecated")
def test__cei__incomes__user_endpoint(client, user, mocker):
    # GIVEN
    mocked_task = mocker.patch("variable_income_assets.views.sync_cei_passive_incomes_task")

    # WHEN
    response = client.get(f"/{BASE_API_URL}" + "incomes/integrations/cei")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["user_id"] == user.pk


def test__kucoin__user_endpoint(kucoin_client, user_with_kucoin_integration, mocker):
    # GIVEN
    mocked_task = mocker.patch("variable_income_assets.views.sync_kucoin_transactions")
    mocked_task.name = "sync_kucoin_transactions_task"

    # WHEN
    response = kucoin_client.get(f"/{BASE_API_URL}" + "transactions/integrations/kucoin")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["user_id"] == user_with_kucoin_integration.pk


@pytest.mark.usefixtures("in_prod_env")
def test__kucoin__user_endpoint__production(kucoin_client, user_with_kucoin_integration, mocker):
    # GIVEN
    mocked_publish = mocker.patch(
        "variable_income_assets.integrations.helpers.QStashClient.publish"
    )

    # WHEN
    response = kucoin_client.get(f"/{BASE_API_URL}" + "transactions/integrations/kucoin")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert (
        mocked_publish.call_args[1]["target_url"]
        == "http://localhost:8000/api/v1/transactions/qstash/kucoin"
    )
    assert mocked_publish.call_args[1]["data"]["user_id"] == user_with_kucoin_integration.pk


def test__binance__user_endpoint(binance_client, user_with_binance_integration, mocker):
    # GIVEN
    mocked_task = mocker.patch("variable_income_assets.views.sync_binance_transactions")
    mocked_task.name = "sync_binance_transactions_task"

    # WHEN
    response = binance_client.get(f"/{BASE_API_URL}" + "transactions/integrations/binance")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["user_id"] == user_with_binance_integration.pk


@pytest.mark.usefixtures("in_prod_env")
def test__binance__user_endpoint__production(binance_client, user_with_binance_integration, mocker):
    # GIVEN
    mocked_publish = mocker.patch(
        "variable_income_assets.integrations.helpers.QStashClient.publish"
    )

    # WHEN
    response = binance_client.get(f"/{BASE_API_URL}" + "transactions/integrations/binance")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert (
        mocked_publish.call_args[1]["target_url"]
        == "http://localhost:8000/api/v1/transactions/qstash/binance"
    )
    assert mocked_publish.call_args[1]["data"]["user_id"] == user_with_binance_integration.pk


@pytest.mark.parametrize(
    ("fixture", "endpoint", "integration_label"),
    (
        ("client", "transactions/integrations/binance", "Binance"),
        ("client", "transactions/integrations/kucoin", "KuCoin"),
        ("binance_client", "transactions/integrations/cei", "CEI"),
        ("binance_client", "incomes/integrations/cei", "CEI"),
    ),
)
def test__user_endpoint__forbidden__credentials_not_set(
    fixture, endpoint, integration_label, request
):
    # GIVEN
    client = request.getfixturevalue(fixture)

    # WHEN
    response = client.get(f"/{BASE_API_URL}" + endpoint)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": f"User has not set the given credentials for {integration_label} integration"
    }


@pytest.mark.parametrize(
    ("client_fixture", "user_fixture", "task_name", "endpoint", "integration_label"),
    (
        (
            "binance_client",
            "user_with_binance_integration",
            "sync_binance_transactions_task",
            "transactions/integrations/binance",
            "Binance",
        ),
        (
            "kucoin_client",
            "user_with_kucoin_integration",
            "sync_kucoin_transactions_task",
            "transactions/integrations/kucoin",
            "KuCoin",
        ),
    ),
)
def test__user_endpoint__forbidden__task_already_triggered(
    client_fixture,
    user_fixture,
    task_name,
    endpoint,
    integration_label,
    request,
    simple_task_history,
):
    # GIVEN
    client = request.getfixturevalue(client_fixture)
    user = request.getfixturevalue(user_fixture)

    simple_task_history.name = task_name
    simple_task_history.state = TaskStates.success
    simple_task_history.created_by = user
    simple_task_history.finished_at = timezone.now()
    simple_task_history.save()

    # WHEN
    response = client.get(f"/{BASE_API_URL}" + endpoint)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": (
            f"{integration_label} sync transactions task was already successfully executed today"
        )
    }


@pytest.mark.parametrize(
    "url",
    ("assets/qstash/update_prices", "transactions/qstash/binance", "transactions/qstash/kucoin"),
)
def test__qstash_endpoint__forbidden(client, url):
    # GIVEN

    # WHEN
    response = client.post(f"/{BASE_API_URL}" + url)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN


@pytest.mark.parametrize(
    "user_fixture_name, client_fixture_name, tasks_to_run",
    (
        ("user_with_kucoin_integration", "kucoin_client", ("sync_kucoin_transactions",)),
        ("user_with_binance_integration", "binance_client", ("sync_binance_transactions",)),
    ),
)
def test___sync_all(request, user_fixture_name, client_fixture_name, tasks_to_run, mocker):
    # GIVEN
    path = "variable_income_assets.views.{}"
    client = request.getfixturevalue(client_fixture_name)
    user = request.getfixturevalue(user_fixture_name)

    mocked_tasks = []
    for task_name in tasks_to_run:
        m = mocker.patch(path.format(task_name))
        m.name = task_name + "_task"
        mocked_tasks.append(m)

    # WHEN
    response = client.get(f"/{BASE_API_URL}" + "assets/integrations/sync_all")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert list(response.json().keys()) == [t + "_task" for t in tasks_to_run]

    for mocked_task in mocked_tasks:
        assert mocked_task.call_args[1]["user_id"] == user.pk


@pytest.mark.parametrize(
    "user_fixture_name, client_fixture_name, tasks_to_run",
    (
        ("user_with_kucoin_integration", "kucoin_client", ("sync_kucoin_transactions",)),
        ("user_with_binance_integration", "binance_client", ("sync_binance_transactions",)),
    ),
)
def test___sync_all__check_last_run_permission(
    request, user_fixture_name, client_fixture_name, tasks_to_run, mocker, simple_task_history
):
    # GIVEN
    path = "variable_income_assets.views.{}"
    client = request.getfixturevalue(client_fixture_name)
    user = request.getfixturevalue(user_fixture_name)

    mocked_tasks = []
    for task_name in tasks_to_run:
        m = mocker.patch(path.format(task_name))
        m.name = task_name + "_task"
        mocked_tasks.append(m)

    # TODO: change so it also works when len(tasks_to_run) > 1
    simple_task_history.name = m.name
    simple_task_history.state = TaskStates.success
    simple_task_history.created_by = user
    simple_task_history.finished_at = timezone.now()
    simple_task_history.save()

    # WHEN
    response = client.get(f"/{BASE_API_URL}" + "assets/integrations/sync_all")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {}

    for mocked_task in mocked_tasks:
        assert not mocked_task.called
