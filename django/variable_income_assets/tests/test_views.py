from decimal import Decimal
import operator

import pytest

from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN

from authentication.tests.conftest import (
    binance_client,
    client,
    kucoin_client,
    binance_secrets,
    kucoin_secrets,
    secrets,
    user,
    user_with_binance_integration,
    user_with_kucoin_integration,
    user_without_assets_price_integration,
)
from config.settings.base import BASE_API_URL

from .shared import (
    convert_to_percentage_and_quantitize,
    get_adjusted_avg_price_brute_forte,
    get_roi_brute_force,
    get_total_bought_brute_force,
)
from ..choices import AssetTypes, TransactionActions, TransactionCurrencies
from ..models import Asset, Transaction


pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets"


@pytest.mark.usefixtures("transactions", "passive_incomes")
@pytest.mark.parametrize(
    "filter_by, count",
    (
        ("", 1),
        ("code=ALUP", 1),
        # ("ROI_type=PROFIT", 1),
        # ("ROI_type=LOSS", 0),
        ("type=STOCK", 1),
        ("type=STOCK_USA", 0),
    ),
)
def test_should_filter_assets(client, filter_by, count):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}?{filter_by}")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["count"] == count


# 1 - ativo fechado, lucro
# 2 - ativo fechado, prejuízo
# 3 - ativo fechado, lucro + incomes
# 4 - ativo fechado, prejuízo + incomes = prejuízo
# 5 - ativo fechado, prejuízo + incomes = lucro


@pytest.mark.parametrize(
    "fixture, operation",
    (
        ("profit_asset_bought_transactions", operator.gt),
        ("loss_asset_bought_transactions", operator.lt),
        ("profit_asset_bought_transactions_incomes", operator.gt),
        ("loss_asset_bought_transactions_incomes_profit", operator.gt),
        ("loss_asset_bought_transactions_incomes_loss", operator.lt),
        ("profit_asset_both_transactions", operator.gt),
        ("loss_asset_both_transactions", operator.lt),
        ("profit_asset_both_transactions_incomes", operator.gt),
        ("loss_asset_both_transactions_incomes_profit", operator.gt),
        ("loss_asset_both_transactions_incomes_loss", operator.lt),
    ),
)
def test_should_list_assets(client, simple_asset, fixture, operation, request):
    # GIVEN
    request.getfixturevalue(fixture)

    roi = get_roi_brute_force(asset=simple_asset)
    avg_price = get_adjusted_avg_price_brute_forte(asset=simple_asset)
    total_bought = get_total_bought_brute_force(asset=simple_asset)

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    results = response.json()["results"][0]
    assert results["roi"] == float(roi)
    assert operation(roi, 0)
    assert results["roi_percentage"] == round((float(roi) / float(total_bought)) * 100, 6)
    assert results["adjusted_avg_price"] == float(avg_price)


# REPETIR para transações em dólar


def test_should_call_sync_cei_transactions_task_celery_task(client, user, mocker):
    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.views.sync_cei_transactions_task.apply_async"
    )

    # WHEN
    response = client.get(f"{URL}/sync_cei_transactions")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["kwargs"]["username"] == user.username


def test_should_raise_permission_error_sync_cei_transactions_if_user_has_not_set_credentials(
    binance_client,
):
    # GIVEN

    # WHEN
    response = binance_client.get(f"{URL}/sync_cei_transactions")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for CEI integration"
    }


def test_should_call_sync_kucoin_transactions_celery_task(
    kucoin_client, user_with_kucoin_integration, mocker
):
    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.views.sync_kucoin_transactions_task.apply_async"
    )

    # WHEN
    response = kucoin_client.get(f"{URL}/sync_kucoin_transactions")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["kwargs"]["username"] == user_with_kucoin_integration.username


def test_should_raise_permission_error_sync_kucoin_transactions_if_user_has_not_set_credentials(
    client,
):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/sync_kucoin_transactions")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for KuCoin integration"
    }


def test_should_call_sync_binance_transactions_task_celery_task(
    binance_client, user_with_binance_integration, mocker
):

    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.views.sync_binance_transactions_task.apply_async"
    )

    # WHEN
    response = binance_client.get(f"{URL}/sync_binance_transactions")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["kwargs"]["username"] == user_with_binance_integration.username


def test_should_raise_permission_error_sync_binance_if_user_has_not_set_credentials(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/sync_binance_transactions")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for Binance integration"
    }


def test_should_call_sync_cei_passive_incomes_task_celery_task(client, user, mocker):
    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.views.sync_cei_passive_incomes_task.apply_async"
    )

    # WHEN
    response = client.get(f"{URL}/sync_cei_passive_incomes")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["kwargs"]["username"] == user.username


def test_should_raise_permission_error_sync_cei_passive_incomes_if_user_has_not_set_credentials(
    binance_client,
):
    # GIVEN

    # WHEN
    response = binance_client.get(f"{URL}/sync_cei_passive_incomes")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for CEI integration"
    }


@pytest.mark.usefixtures("assets", "transactions")
def test_should_call_fetch_current_assets_prices_celery_task(client, user, another_asset, mocker):
    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.views.fetch_current_assets_prices.apply_async"
    )
    Transaction.objects.create(
        action=TransactionActions.buy, price=50, asset=another_asset, quantity=100
    )

    # WHEN
    response = client.get(f"{URL}/fetch_current_prices?code=ALUP11&code=URA")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert mocked_task.call_args[1]["kwargs"]["username"] == user.username
    assert mocked_task.call_args[1]["kwargs"]["codes"] == ["ALUP11", "URA"]


def test_should_raise_permission_error_fetch_current_prices_if_user_has_not_set_credentials(
    binance_client,
):
    # GIVEN

    # WHEN
    response = binance_client.get(f"{URL}/fetch_current_prices")

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {
        "detail": "User has not set the given credentials for Assets Prices integration"
    }


@pytest.mark.usefixtures("assets", "transactions")
def test_should_raise_error_if_asset_is_finished_fetch_current_assets_prices(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/fetch_current_prices?code=ALUP11&code=URA")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "code": ["Select a valid choice. URA is not one of the available choices."]
    }


@pytest.mark.usefixtures("assets")
def test_should_raise_error_if_code_is_not_valid_fetch_current_prices(client):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/fetch_current_prices?code=ALSO3")

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "code": ["Select a valid choice. ALSO3 is not one of the available choices."]
    }


@pytest.mark.usefixtures("indicators_data")
def test_should_get_indicators(client):
    # GIVEN
    current_total = Decimal()
    for asset in Asset.objects.all():
        r = asset.current_price or Decimal()
        if asset.currency != TransactionCurrencies.real:
            # TODO: change this hardcoded conversion to a dynamic one
            r *= Decimal("5.68")
        current_total += (r) * asset.quantity_from_transactions

    roi_opened = sum(get_roi_brute_force(asset=asset) for asset in Asset.objects.opened())
    roi_finished = sum(get_roi_brute_force(asset=asset) for asset in Asset.objects.finished())

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert response.json()["current_total"] == current_total
    assert response.json()["ROI_opened"] == roi_opened
    assert response.json()["ROI_finished"] == roi_finished


@pytest.mark.usefixtures("report_data")
def test_should_get_report(client):
    # GIVEN
    totals = {
        "stock": sum(
            asset.current_price * asset.quantity_from_transactions
            for asset in Asset.objects.stocks().opened()
        ),
        "crypto": sum(
            asset.current_price * asset.quantity_from_transactions
            for asset in Asset.objects.cryptos().opened()
        ),
    }

    # WHEN
    response = client.get(f"{URL}/report")

    # THEN
    assert response.status_code == HTTP_200_OK

    for result in response.json():
        for choice, label in AssetTypes.labels.items():
            if label == result["type"]:
                assert totals[choice] == result["total"]


@pytest.mark.usefixtures("report_data")
def test_should_get_report_as_percentage(client):
    # GIVEN
    current_total = Asset.objects.current_total()["current_total"]
    totals = {
        "stock": sum(
            asset.current_price * asset.quantity_from_transactions
            for asset in Asset.objects.stocks().opened()
        ),
        "crypto": sum(
            asset.current_price * asset.quantity_from_transactions
            for asset in Asset.objects.cryptos().opened()
        ),
    }

    # WHEN
    response = client.get(f"{URL}/report?percentage=true")

    # THEN
    assert response.status_code == HTTP_200_OK
    for result in response.json():
        for choice, label in AssetTypes.labels.items():
            if label == result["type"]:
                assert (
                    float(
                        convert_to_percentage_and_quantitize(
                            value=totals[choice], total=current_total
                        )
                    )
                    == result["total"]
                )


@pytest.mark.parametrize(
    "user_fixture_name, client_fixture_name, tasks_to_run",
    (
        (
            "user",
            "client",
            (
                "sync_cei_transactions_task",
                "sync_cei_passive_incomes_task",
                "fetch_current_assets_prices",
            ),
        ),
        (
            "user_without_assets_price_integration",
            "client",
            ("sync_cei_transactions_task", "sync_cei_passive_incomes_task"),
        ),
        ("user_with_kucoin_integration", "kucoin_client", ("sync_kucoin_transactions_task",)),
        ("user_with_binance_integration", "binance_client", ("sync_binance_transactions_task",)),
    ),
)
def test_should_sync_all(request, user_fixture_name, client_fixture_name, tasks_to_run, mocker):
    # GIVEN
    path = "variable_income_assets.views.{}.apply_async"
    client = request.getfixturevalue(client_fixture_name)
    user = request.getfixturevalue(user_fixture_name)
    kwargs = {"username": user.username}
    mocked_tasks = [mocker.patch(path.format(task_name)) for task_name in tasks_to_run]

    # WHEN
    response = client.get(f"{URL}/sync_all")

    # THEN
    assert response.status_code == HTTP_200_OK
    assert all(task_name in response.json() for task_name in tasks_to_run)
    for task_name, mocked_task in zip(tasks_to_run, mocked_tasks):
        extra_kwargs = (
            {"codes": list(Asset.objects.filter(user=user).opened().values_list("code", flat=True))}
            if task_name == "fetch_current_assets_prices"
            else {}
        )

        assert mocked_task.call_args[1]["kwargs"] == {**kwargs, **extra_kwargs}
