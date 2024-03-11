import pytest

from ...models import AssetReadModel
from ...service_layer.tasks import upsert_asset_read_model

pytestmark = pytest.mark.django_db


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
