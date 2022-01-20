from decimal import Decimal

import pytest

from django.conf import settings

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

from ..choices import AssetTypes
from ..models import Asset, Transaction

pytestmark = pytest.mark.django_db

URL = f"/{BASE_API_URL}" + "assets"


def test_sync_cei_transactions_should_create_asset_and_transaction(
    user, client, requests_mock, cei_transactions_response
):
    # GIVEN
    requests_mock.get(
        build_url(url=settings.CRAWLERS_URL, parts=("cei/", "transactions")),
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


@pytest.mark.usefixtures("simple_asset")
def test_sync_cei_transactions_should_not_create_asset_if_already_exists(
    user, client, requests_mock, cei_transactions_response
):
    # GIVEN
    requests_mock.get(
        build_url(url=settings.CRAWLERS_URL, parts=("cei/", "transactions")),
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


@pytest.mark.usefixtures("simple_asset")
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
        build_url(url=settings.CRAWLERS_URL, parts=("cei/", "transactions")),
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


@pytest.mark.usefixtures("assets", "transactions")
def test_should_success_fetch_current_assets_prices_celery_task(
    client, requests_mock, fetch_current_assets_prices_response
):
    # GIVEN
    requests_mock.post(
        build_url(url=settings.CRAWLERS_URL, parts=("prices",)),
        json=fetch_current_assets_prices_response,
    )

    # WHEN
    client.get(f"{URL}/fetch_current_prices?code=ALUP11")

    # THEN
    for code, price in fetch_current_assets_prices_response.items():
        asset = Asset.objects.get(code=code)
        assert float(asset.current_price) == price


def test_sync_kucoin_transactions_should_create_asset_and_transaction(
    user_with_kucoin_integration,
    kucoin_client,
    crypto_asset,
    requests_mock,
    kucoin_transactions_response,
):
    # GIVEN
    crypto_asset.user = user_with_kucoin_integration
    crypto_asset.save()

    requests_mock.get(
        build_url(url=settings.CRAWLERS_URL, parts=("kucoin/", "transactions")),
        json=kucoin_transactions_response,
    )
    # WHEN
    kucoin_client.get(f"{URL}/sync_kucoin_transactions")

    # THEN
    assert (
        Asset.objects.filter(user=user_with_kucoin_integration, type=AssetTypes.crypto).count() == 2
    )
    assert sorted(list(Asset.objects.values_list("code", flat=True))) == sorted(
        list({item["code"] for item in kucoin_transactions_response})
    )

    assert Transaction.objects.count() == len(kucoin_transactions_response)

    for item in kucoin_transactions_response:
        assert Transaction.objects.filter(
            asset__user=user_with_kucoin_integration,
            asset__code=item["code"],
            currency=item["currency"],
            action=item["action"],
            price=Decimal(item["price"]),
        ).exists()


@pytest.mark.usefixtures("crypto_asset")
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
        build_url(url=settings.CRAWLERS_URL, parts=("kucoin/", "transactions")),
        json=kucoin_transactions_response,
    )

    # WHEN
    kucoin_client.get(f"{URL}/sync_kucoin_transactions")

    # THEN
    assert Transaction.objects.count() == len(kucoin_transactions_response) - 1
