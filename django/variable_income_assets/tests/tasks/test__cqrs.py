from decimal import Decimal
from importlib import import_module

from django.apps import apps

import pytest

from ...choices import TransactionActions
from ...models import AssetReadModel, Transaction
from ...service_layer.tasks import upsert_asset_read_model

pytestmark = pytest.mark.django_db


@pytest.mark.usefixtures("stock_asset_metadata", "bonificacao_transaction")
def test__backfill_current_irpf_avg_price(stock_asset):
    # GIVEN
    upsert_asset_read_model(asset_id=stock_asset.pk)
    read_model = AssetReadModel.objects.get(write_model_pk=stock_asset.pk)
    AssetReadModel.objects.filter(pk=read_model.pk).update(irpf_avg_price=0)

    migration = import_module(
        "variable_income_assets.migrations.0031_backfill_assetreadmodel_irpf_avg_price"
    )

    # WHEN
    migration.backfill_irpf_avg_price(apps, schema_editor=None)

    # THEN
    read_model.refresh_from_db()
    assert read_model.irpf_avg_price == Decimal("10.78")


@pytest.mark.usefixtures("stock_asset_metadata")
def test__current_irpf_avg_price_after_closed_and_reopened_position(
    closed_then_reopened_stock_asset,
):
    # GIVEN
    asset, _, _, reopened_buy = closed_then_reopened_stock_asset
    Transaction.objects.create(
        asset=asset,
        action=TransactionActions.bonificacao,
        price=Decimal(),
        irpf_price=Decimal("12.34"),
        quantity=Decimal("25"),
        operation_date=reopened_buy.operation_date,
    )

    # WHEN
    upsert_asset_read_model(asset_id=asset.pk)

    # THEN
    read_model = AssetReadModel.objects.get(write_model_pk=asset.pk)
    assert read_model.avg_price == Decimal("12")
    assert read_model.irpf_avg_price == Decimal("14.468")


def test__backfill_current_irpf_avg_price_for_self_custody(
    buy_transaction_from_fixed_asset_held_in_self_custody,
):
    # GIVEN
    asset = buy_transaction_from_fixed_asset_held_in_self_custody.asset
    read_model = AssetReadModel.objects.get(write_model_pk=asset.pk)
    AssetReadModel.objects.filter(pk=read_model.pk).update(irpf_avg_price=0)
    migration = import_module(
        "variable_income_assets.migrations.0031_backfill_assetreadmodel_irpf_avg_price"
    )

    # WHEN
    migration.backfill_irpf_avg_price(apps, schema_editor=None)

    # THEN
    read_model.refresh_from_db()
    assert read_model.irpf_avg_price == read_model.avg_price == Decimal("10000")


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
            irpf_avg_price=0,
            normalized_total_sold=0,
        )
        .exclude(
            normalized_closed_roi=0,
        )
        .count()
        == 1
    )
