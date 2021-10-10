import pytest

from django.conf import settings

from shared.utils import build_url
from authentication.tests.conftest import client, user
from config.settings.base import BASE_API_URL

from ..choices import AssetTypes
from ..models import Asset, Transaction

pytestmark = pytest.mark.django_db

URL = f"/{BASE_API_URL}" + "assets"


def test_cei_celery_crawler_should_create_asset_and_transaction(
    user, client, requests_mock, cei_crawler_assets_response
):
    # GIVEN
    requests_mock.get(
        build_url(url=settings.CRAWLERS_URL, parts=("cei/", "assets")),
        json=cei_crawler_assets_response,
    )
    # WHEN
    client.get(f"{URL}/fetch_cei")

    # THEN
    assert Asset.objects.count() == 1
    asset = Asset.objects.first()
    assert asset.code == cei_crawler_assets_response[0]["raw_negotiation_code"]
    assert asset.type == AssetTypes.stock

    assert Transaction.objects.count() == len(cei_crawler_assets_response)
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_crawler_assets_response[0]["raw_negotiation_code"],
        price=cei_crawler_assets_response[0]["unit_price"],
        created_at=cei_crawler_assets_response[0]["operation_date"],
        action=cei_crawler_assets_response[0]["action"].upper(),
    ).exists()
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_crawler_assets_response[1]["raw_negotiation_code"],
        price=cei_crawler_assets_response[1]["unit_price"],
        created_at=cei_crawler_assets_response[1]["operation_date"],
        action=cei_crawler_assets_response[1]["action"].upper(),
    ).exists()


@pytest.mark.usefixtures("simple_asset")
def test_cei_celery_crawler_should_not_create_asset_if_already_exists(
    user, client, requests_mock, cei_crawler_assets_response
):
    # GIVEN
    requests_mock.get(
        build_url(url=settings.CRAWLERS_URL, parts=("cei/", "assets")),
        json=cei_crawler_assets_response,
    )
    # WHEN
    client.get(f"{URL}/fetch_cei")

    # THEN
    assert Asset.objects.count() == 1

    assert Transaction.objects.count() == len(cei_crawler_assets_response)
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_crawler_assets_response[0]["raw_negotiation_code"],
        price=cei_crawler_assets_response[0]["unit_price"],
        created_at=cei_crawler_assets_response[0]["operation_date"],
        action=cei_crawler_assets_response[0]["action"].upper(),
    ).exists()
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_crawler_assets_response[1]["raw_negotiation_code"],
        price=cei_crawler_assets_response[1]["unit_price"],
        created_at=cei_crawler_assets_response[1]["operation_date"],
        action=cei_crawler_assets_response[1]["action"].upper(),
    ).exists()


@pytest.mark.usefixtures("simple_asset")
def test_cei_celery_crawler_should_not_create_asset_if_unit_alread_exists(
    user, client, requests_mock, cei_crawler_assets_response
):
    # GIVEN
    for transaction in cei_crawler_assets_response:
        transaction["raw_negotiation_code"] = f"{transaction['raw_negotiation_code']}F"
        transaction["market_type"] = "fractional_share"
        transaction["unit_amount"] = 50
        transaction["unit_price"] = 26.37
        transaction["total_price"] = 1318.5

    requests_mock.get(
        build_url(url=settings.CRAWLERS_URL, parts=("cei/", "assets")),
        json=cei_crawler_assets_response,
    )
    # WHEN
    client.get(f"{URL}/fetch_cei")

    # THEN
    assert Asset.objects.count() == 1

    assert Transaction.objects.count() == len(cei_crawler_assets_response)
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_crawler_assets_response[0]["raw_negotiation_code"][:-1],
        price=cei_crawler_assets_response[0]["unit_price"],
        created_at=cei_crawler_assets_response[0]["operation_date"],
        action=cei_crawler_assets_response[0]["action"].upper(),
    ).exists()
    assert Transaction.objects.filter(
        asset__user=user,
        asset__code=cei_crawler_assets_response[1]["raw_negotiation_code"][:-1],
        price=cei_crawler_assets_response[1]["unit_price"],
        created_at=cei_crawler_assets_response[1]["operation_date"],
        action=cei_crawler_assets_response[1]["action"].upper(),
    ).exists()
