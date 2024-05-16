import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_403_FORBIDDEN,
    HTTP_405_METHOD_NOT_ALLOWED,
)

from authentication.tests.conftest import api_client
from config.settings.base import BASE_API_URL


@pytest.mark.parametrize(
    "url",
    ("assets/qstash/update_prices", "transactions/qstash/binance", "transactions/qstash/kucoin"),
)
def test__forbidden(api_client, url):
    # GIVEN

    # WHEN
    response = api_client.post(f"/{BASE_API_URL}" + url)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN


@pytest.mark.parametrize(
    "url",
    ("assets/qstash/update_prices", "transactions/qstash/binance", "transactions/qstash/kucoin"),
)
def test__method_now_allowed(api_client, mocker, url):
    # GIVEN
    mocker.patch("variable_income_assets.integrations.authentication._verify_qstash_signature")

    # WHEN
    response = api_client.get(f"/{BASE_API_URL}" + url)

    # THEN
    assert response.status_code == HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.parametrize(
    ("url", "task_name", "data"),
    (
        ("assets/qstash/update_prices", "update_prices", {}),
        ("transactions/qstash/binance", "sync_binance_transactions", {"user_id": 1}),
        ("transactions/qstash/kucoin", "sync_kucoin_transactions", {"user_id": 1}),
    ),
)
def test__sanity_check(api_client, mocker, url, task_name, data):
    # GIVEN
    mocker.patch("variable_income_assets.integrations.authentication._verify_qstash_signature")
    mocked_task = mocker.patch(
        f"variable_income_assets.integrations.qstash_views.{task_name}", return_value=None
    )

    # WHEN
    response = api_client.post(f"/{BASE_API_URL}" + url, data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args.kwargs == data


@pytest.mark.skip("Skip while still in WSGI")
# @pytest.mark.asyncio
@pytest.mark.parametrize(
    ("url", "task_name", "data"),
    (
        ("assets/qstash/update_prices", "update_prices", {}),
        ("transactions/qstash/binance", "sync_binance_transactions", {"user_id": 1}),
        ("transactions/qstash/kucoin", "sync_kucoin_transactions", {"user_id": 1}),
    ),
)
async def test__sanity_check__asgi(async_client, mocker, url, task_name, data):
    # GIVEN
    mocker.patch("variable_income_assets.integrations.authentication._verify_qstash_signature")
    mocked_task = mocker.patch(
        f"variable_income_assets.integrations.qstash_views.{task_name}", return_value=None
    )

    # WHEN
    response = await async_client.post(
        f"/{BASE_API_URL}" + url, content_type="application/json", data=data
    )

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args.kwargs == data
