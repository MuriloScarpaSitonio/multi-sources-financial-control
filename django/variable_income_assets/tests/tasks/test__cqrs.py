from datetime import date
from decimal import Decimal

import pytest

from ...choices import AssetTypes, Currencies, LiquidityTypes
from ...models import Asset, AssetMetaData, AssetReadModel
from ...service_layer.tasks import upsert_asset_read_model

pytestmark = pytest.mark.django_db


def test__fixed_income_indexer_reaches_read_model(user):
    # Omitting indexer from CQRS synchronization must make this fail.
    asset = Asset.objects.create(
        user=user,
        code="CDB-TEST",
        type=AssetTypes.fixed_br,
        currency=Currencies.real,
        indexer="IPCA",
        maturity_date=date(2035, 5, 15),
    )
    AssetMetaData.objects.create(
        code=asset.code,
        type=asset.type,
        currency=asset.currency,
        current_price=Decimal("1"),
    )

    upsert_asset_read_model(asset.id)

    assert AssetReadModel.objects.get(write_model_pk=asset.id).indexer == "IPCA"


def test__to_domain_preserves_fixed_income_facts(user):
    # Dropping any canonical fixed-income fact in to_domain() must make this fail.
    maturity = date(2035, 5, 15)
    asset = Asset.objects.create(
        user=user,
        code="CDB-DOMAIN",
        type=AssetTypes.fixed_br,
        currency=Currencies.real,
        liquidity_type=LiquidityTypes.at_maturity,
        maturity_date=maturity,
        indexer="PREFIXED",
    )

    domain = asset.to_domain()

    assert (domain.liquidity_type, domain.maturity_date, domain.indexer) == (
        LiquidityTypes.at_maturity,
        maturity,
        "PREFIXED",
    )


@pytest.mark.usefixtures(
    "stock_usa_transaction", "stock_usa_sell_transaction", "stock_usa_asset_metadata"
)
def test__should_set_values_to_zero_if_asset_has_been_closed(stock_usa_asset, request):
    # GIVEN
    request.getfixturevalue("sync_assets_read_model")  # create read model
    request.getfixturevalue("stock_usa_asset_closed_operation")  # create closed operation after

    # WHEN
    upsert_asset_read_model(asset_id=stock_usa_asset.pk, is_aggregate_upsert=True)

    # THEN
    assert (
        AssetReadModel.objects.filter(
            write_model_pk=stock_usa_asset.pk,
            quantity_balance=0,
            normalized_avg_price=0,
            normalized_total_bought=0,
            normalized_credited_incomes=0,
            credited_incomes=0,
            avg_price=0,
            normalized_total_sold=0,
        )
        .exclude(
            normalized_closed_roi=0,
        )
        .count()
        == 1
    )
