from datetime import date
from decimal import Decimal

import pytest

from django.conf import settings
from django.utils import timezone

from shared.utils import build_url
from authentication.tests.conftest import (
    client,
    kucoin_client,
    kucoin_secrets,
    secrets,
    user,
    user_with_kucoin_integration,
)
from config.settings.base import BASE_API_URL

from .shared import convert_and_quantitize
from ..choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
)
from ..models import Asset, AssetReadModel, PassiveIncome, Transaction


pytestmark = pytest.mark.django_db

URL = f"/{BASE_API_URL}" + "assets"


@pytest.mark.parametrize("endpoint", ("sync_cei_transactions", "sync_cei_passive_incomes"))
def test_deprecated_integrations(client, endpoint):
    # GIVEN

    # WHEN
    response = client.get(f"{URL}/{endpoint}")

    # THEN
    assert response.status_code == 299
    assert response.json() == {"task_id": None, "warning": "Integration is deprecated"}


@pytest.mark.skip("Integration is deprecated")
def test_sync_cei_transactions_should_create_asset_and_transaction(
    user, client, requests_mock, cei_transactions_response
):
    # GIVEN
    requests_mock.get(
        build_url(url=settings.ASSETS_INTEGRATIONS_URL, parts=("cei/", "transactions")),
        json=cei_transactions_response,
    )
    # WHEN
    client.get(f"{URL}/sync_cei_transactions")

    # THEN
    assert Asset.objects.count() == 1
    asset = Asset.objects.first()
    assert asset.code == cei_transactions_response[0]["raw_negotiation_code"]
    assert asset.type == AssetTypes.stock

    assert Transaction.objects.count() == len(cei_transactions_response)
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_transactions_response[0]["raw_negotiation_code"],
        price=cei_transactions_response[0]["unit_price"],
        created_at=cei_transactions_response[0]["operation_date"],
        action=cei_transactions_response[0]["action"].upper(),
    ).exists()
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_transactions_response[1]["raw_negotiation_code"],
        price=cei_transactions_response[1]["unit_price"],
        created_at=cei_transactions_response[1]["operation_date"],
        action=cei_transactions_response[1]["action"].upper(),
    ).exists()


@pytest.mark.skip("Integration is deprecated")
@pytest.mark.usefixtures("stock_asset")
def test_sync_cei_transactions_should_not_create_asset_if_already_exists(
    user, client, requests_mock, cei_transactions_response
):
    # GIVEN
    requests_mock.get(
        build_url(url=settings.ASSETS_INTEGRATIONS_URL, parts=("cei/", "transactions")),
        json=cei_transactions_response,
    )
    # WHEN
    client.get(f"{URL}/sync_cei_transactions")

    # THEN
    assert Asset.objects.count() == 1

    assert Transaction.objects.count() == len(cei_transactions_response)
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_transactions_response[0]["raw_negotiation_code"],
        price=cei_transactions_response[0]["unit_price"],
        created_at=cei_transactions_response[0]["operation_date"],
        action=cei_transactions_response[0]["action"].upper(),
    ).exists()
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_transactions_response[1]["raw_negotiation_code"],
        price=cei_transactions_response[1]["unit_price"],
        created_at=cei_transactions_response[1]["operation_date"],
        action=cei_transactions_response[1]["action"].upper(),
    ).exists()


@pytest.mark.skip("Integration is deprecated")
@pytest.mark.usefixtures("stock_asset")
def test_sync_cei_transactions_should_not_create_asset_if_unit_alread_exists(
    user, client, requests_mock, cei_transactions_response
):
    # GIVEN
    for transaction in cei_transactions_response:
        transaction["raw_negotiation_code"] = f"{transaction['raw_negotiation_code']}F"
        transaction["market_type"] = "fractional_share"
        transaction["unit_amount"] = 50
        transaction["unit_price"] = 26.37
        transaction["total_price"] = 1318.5

    requests_mock.get(
        build_url(url=settings.ASSETS_INTEGRATIONS_URL, parts=("cei/", "transactions")),
        json=cei_transactions_response,
    )
    # WHEN
    client.get(f"{URL}/sync_cei_transactions")

    # THEN
    assert Asset.objects.count() == 1

    assert Transaction.objects.count() == len(cei_transactions_response)
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_transactions_response[0]["raw_negotiation_code"][:-1],
        price=cei_transactions_response[0]["unit_price"],
        created_at=cei_transactions_response[0]["operation_date"],
        action=cei_transactions_response[0]["action"].upper(),
    ).exists()
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_transactions_response[1]["raw_negotiation_code"][:-1],
        price=cei_transactions_response[1]["unit_price"],
        created_at=cei_transactions_response[1]["operation_date"],
        action=cei_transactions_response[1]["action"].upper(),
    ).exists()



def test_sync_kucoin_transactions_should_create_asset_and_transaction(
    user_with_kucoin_integration,
    kucoin_client,
    crypto_asset,
    requests_mock,
    kucoin_transactions_response,
    sync_assets_read_model,  # no idea why @pytest.mark.usefixtures does not work here
):
    # GIVEN
    crypto_asset.user = user_with_kucoin_integration
    crypto_asset.save()

    requests_mock.get(
        build_url(url=settings.ASSETS_INTEGRATIONS_URL, parts=("kucoin/", "transactions")),
        json=kucoin_transactions_response,
    )
    # WHEN
    kucoin_client.get(f"{URL}/sync_kucoin_transactions")

    # THEN
    assert (
        Asset.objects.filter(
            user=user_with_kucoin_integration,
            type=AssetTypes.crypto,
            sector=AssetSectors.tech,
            objective=AssetObjectives.growth,
            current_price_updated_at__isnull=False,
        ).count()
        == 2
    )
    assert (
        Asset.objects.filter(
            user=user_with_kucoin_integration,
            code=kucoin_transactions_response[0]["code"],
            current_price=kucoin_transactions_response[0]["price"],
        ).count()
        == 1
    )
    assert sorted(list(Asset.objects.values_list("code", flat=True))) == sorted(
        list({item["code"] for item in kucoin_transactions_response} ^ {"VELO"})
    )

    assert Transaction.objects.count() == len(kucoin_transactions_response) - 1

    for item in kucoin_transactions_response:
        if item["code"] == "VELO":  # first transaction was "SELL"
            continue
        assert Transaction.objects.filter(
            asset__user=user_with_kucoin_integration,
            asset__code=item["code"],
            currency="USD" if item["currency"] == "USDT" else item["currency"],
            action=item["action"],
            price=Decimal(item["price"]),
        ).exists()


@pytest.mark.usefixtures("crypto_asset", "sync_assets_read_model")
def test_should_skip_kucoin_transaction_if_already_exists(
    user_with_kucoin_integration,
    kucoin_client,
    crypto_asset,
    requests_mock,
    kucoin_transactions_response,
):
    # GIVEN
    crypto_asset.user = user_with_kucoin_integration
    crypto_asset.save()

    kucoin_transactions_response[0]["id"] = kucoin_transactions_response[1]["id"]
    requests_mock.get(
        build_url(url=settings.ASSETS_INTEGRATIONS_URL, parts=("kucoin/", "transactions")),
        json=kucoin_transactions_response,
    )

    # WHEN
    kucoin_client.get(f"{URL}/sync_kucoin_transactions")

    # THEN
    assert Transaction.objects.count() == len(kucoin_transactions_response) - 2


@pytest.mark.skip("Integration is deprecated")
def test__sync_cei_passive_incomes_task__create(user, stock_asset, requests_mock, client):
    # GIVEN
    requests_mock.get(
        build_url(
            url=settings.ASSETS_INTEGRATIONS_URL,
            parts=("cei/", "passive_incomes"),
            query_params={
                "username": user.username,
                "start_date": None,
                "end_date": timezone.now().date(),
            },
        ),
        json=[
            {
                "income_type": "dividend",
                "net_value": 502,
                "operation_date": "2022-01-23",
                "raw_negotiation_code": stock_asset.code,
                "event_type": "credited",
            }
        ],
    )

    # WHEN
    response = client.get(f"{URL}/sync_cei_passive_incomes")

    # THEN
    assert response.status_code == 200
    assert (
        Asset.objects.filter(
            code=stock_asset.code, user=stock_asset.user, type=stock_asset.type
        ).count()
        == 1
    )
    assert (
        PassiveIncome.objects.filter(
            fetched_by__id=response.json()["task_id"],
            asset=stock_asset,
            type=PassiveIncomeTypes.dividend,
            amount=502,
            event_type=PassiveIncomeEventTypes.credited,
            operation_date=date(year=2022, month=1, day=23),
        ).count()
        == 1
    )


@pytest.mark.skip("Integration is deprecated")
def test__sync_cei_passive_incomes_task__create_income_and_asset(user, requests_mock, client):
    # GIVEN
    requests_mock.get(
        build_url(
            url=settings.ASSETS_INTEGRATIONS_URL,
            parts=("cei/", "passive_incomes"),
            query_params={
                "username": user.username,
                "start_date": None,
                "end_date": timezone.now().date(),
            },
        ),
        json=[
            {
                "income_type": "dividend",
                "net_value": 502,
                "operation_date": "2022-01-23",
                "raw_negotiation_code": "ALUP11",
                "event_type": "credited",
            }
        ],
    )

    # WHEN
    response = client.get(f"{URL}/sync_cei_passive_incomes")

    # THEN
    assert response.status_code == 200
    assert Asset.objects.filter(code="ALUP11", user=user, type=AssetTypes.stock).exists()
    assert (
        PassiveIncome.objects.filter(
            fetched_by__id=response.json()["task_id"],
            asset__code="ALUP11",
            asset__user=user,
            type=PassiveIncomeTypes.dividend,
            amount=502,
            event_type=PassiveIncomeEventTypes.credited,
            operation_date=date(year=2022, month=1, day=23),
        ).count()
        == 1
    )


@pytest.mark.skip("Integration is deprecated")
def test__sync_cei_passive_incomes_task__update_event_type(
    user, stock_asset, requests_mock, client
):
    # GIVEN
    PassiveIncome.objects.create(
        asset=stock_asset,
        type=PassiveIncomeTypes.dividend,
        amount=502,
        event_type=PassiveIncomeEventTypes.provisioned,
        operation_date=date(year=2022, month=1, day=23),
    )

    requests_mock.get(
        build_url(
            url=settings.ASSETS_INTEGRATIONS_URL,
            parts=("cei/", "passive_incomes"),
            query_params={
                "username": user.username,
                "start_date": None,
                "end_date": timezone.now().date(),
            },
        ),
        json=[
            {
                "income_type": "dividend",
                "net_value": 502,
                "operation_date": "2022-01-23",
                "raw_negotiation_code": stock_asset.code,
                "event_type": "credited",
            }
        ],
    )

    # WHEN
    response = client.get(f"{URL}/sync_cei_passive_incomes")

    # THEN
    assert response.status_code == 200
    assert (
        PassiveIncome.objects.filter(
            fetched_by__isnull=True,
            asset=stock_asset,
            type=PassiveIncomeTypes.dividend,
            amount=502,
            event_type=PassiveIncomeEventTypes.credited,
            operation_date=date(year=2022, month=1, day=23),
        ).count()
        == 1
    )
