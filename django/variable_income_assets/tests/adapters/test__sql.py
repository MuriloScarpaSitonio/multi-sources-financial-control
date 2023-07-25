import pytest

from authentication.tests.conftest import client, secrets, user
from variable_income_assets.adapters import DjangoSQLAssetMetaDataRepository

pytestmark = pytest.mark.django_db


@pytest.mark.usefixtures(
    "transactions",
    "stock_asset_metadata",
    "another_stock_asset",  # closed
    "another_stock_asset_metadata",
    "another_stock_asset_transactions",
    "stock_usa_transaction",
    "stock_usa_asset",  # opened - w transactions
    "stock_usa_asset_metadata",
    "fii_asset",  # opened - wo transactions
    "fii_asset_metadata",
    "sync_assets_read_model",
)
def test__django_sql_asset_meta__filter_assets_eligible_for_update(stock_asset, stock_usa_asset):
    # GIVEN

    # WHEN
    qs = DjangoSQLAssetMetaDataRepository.filter_assets_eligible_for_update()

    # THEN
    assert list(qs.values_list("code", flat=True).order_by("code")) == sorted(
        (stock_asset.code, stock_usa_asset.code)
    )
