import pytest
from rest_framework.status import HTTP_200_OK

from authentication.tests.conftest import refresh_token, client, secrets, user
from config.settings.base import BASE_API_URL
from variable_income_assets.models import AssetReadModel

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets/integrations/update_prices"


@pytest.mark.usefixtures(
    "buy_transaction",
    "crypto_transaction",
    "crypto_brl_transaction",
    "stock_usa_transaction",
    "fii_transaction",
)
def test__update_prices(
    client,
    mocker,
    stock_asset,
    stock_asset_metadata,
    fii_asset,
    fii_asset_metadata,
    crypto_asset,
    crypto_asset_metadata,
    crypto_asset_brl,
    crypto_asset_brl_metadata,
    stock_usa_asset,
    stock_usa_asset_metadata,
    sync_assets_read_model,
):
    # GIVEN
    mocker.patch(
        "variable_income_assets.integrations.views.get_b3_prices",
        side_effect=[{stock_asset_metadata.code: 78}, {fii_asset_metadata.code: 100}],
    )
    stock_roi_before = AssetReadModel.objects.get(write_model_pk=stock_asset.pk).normalized_roi
    fii_roi_before = AssetReadModel.objects.get(write_model_pk=fii_asset.pk).normalized_roi

    mocker.patch(
        "variable_income_assets.integrations.views.get_stocks_usa_prices",
        return_value={stock_usa_asset_metadata.code: 26},
    )
    stock_usa_roi_before = AssetReadModel.objects.get(
        write_model_pk=stock_usa_asset.pk
    ).normalized_roi

    mocker.patch(
        "variable_income_assets.integrations.views.get_crypto_prices",
        side_effect=[{crypto_asset_metadata.code: 1}, {crypto_asset_brl_metadata.code: 5}],
    )
    crypto_usd_roi_before = AssetReadModel.objects.get(
        write_model_pk=crypto_asset_metadata.pk
    ).normalized_roi
    crypto_brl_roi_before = AssetReadModel.objects.get(
        write_model_pk=crypto_asset_brl_metadata.pk
    ).normalized_roi

    # WHEN
    response = client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    stock_asset_metadata.refresh_from_db()
    assert stock_asset_metadata.current_price == 78
    assert stock_asset_metadata.current_price_updated_at is not None

    assert (
        AssetReadModel.objects.get(
            write_model_pk=stock_asset.pk, metadata_id=stock_asset_metadata.pk
        ).normalized_roi
        > stock_roi_before
    )

    fii_asset_metadata.refresh_from_db()
    assert fii_asset_metadata.current_price == 100
    assert fii_asset_metadata.current_price_updated_at is not None

    assert (
        AssetReadModel.objects.get(
            write_model_pk=fii_asset.pk, metadata_id=fii_asset_metadata.pk
        ).normalized_roi
        < fii_roi_before
    )

    stock_usa_asset_metadata.refresh_from_db()
    assert stock_usa_asset_metadata.current_price == 26
    assert stock_usa_asset_metadata.current_price_updated_at is not None

    assert (
        AssetReadModel.objects.get(
            write_model_pk=stock_usa_asset.pk, metadata_id=stock_usa_asset_metadata.pk
        ).normalized_roi
        > stock_usa_roi_before
    )

    crypto_asset_metadata.refresh_from_db()
    assert crypto_asset_metadata.current_price == 1
    assert crypto_asset_metadata.current_price_updated_at is not None

    assert (
        AssetReadModel.objects.get(
            write_model_pk=crypto_asset.pk, metadata_id=crypto_asset_metadata.pk
        ).normalized_roi
        < crypto_usd_roi_before
    )

    crypto_asset_brl_metadata.refresh_from_db()
    assert crypto_asset_brl_metadata.current_price == 5
    assert crypto_asset_brl_metadata.current_price_updated_at is not None

    assert (
        AssetReadModel.objects.get(
            write_model_pk=crypto_asset_brl.pk, metadata_id=crypto_asset_brl_metadata.pk
        ).normalized_roi
        < crypto_brl_roi_before
    )


@pytest.mark.skip("Skip while still in WSGI")
@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test__update_prices__asgi(
    refresh_token, mocker, stock_asset, stock_asset_metadata, sync_assets_read_model, async_client
):
    # GIVEN
    mocker.patch(
        "variable_income_assets.integrations.views.BrApiClient.get_b3_prices",
        return_value={stock_asset.code: 78},
    )
    roi_before = AssetReadModel.objects.get(write_model_pk=stock_asset.pk).roi

    # WHEN
    response = await async_client.post(
        URL, content_type="application/json", AUTHORIZATION=f"Bearer {refresh_token.access_token}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    await stock_asset_metadata.arefresh_from_db()
    assert stock_asset_metadata.current_price == 78
    assert stock_asset_metadata.current_price_updated_at is not None

    assert (
        await AssetReadModel.objects.aget(
            write_model_pk=stock_asset.pk, metadata_id=stock_asset_metadata.pk
        )
    ).roi > roi_before
