import pytest
from rest_framework.status import HTTP_200_OK

from authentication.tests.conftest import refresh_token, client, secrets, user
from config.settings.base import BASE_API_URL
from tasks.models import TaskHistory
from tasks.choices import TaskStates
from variable_income_assets.models import AssetReadModel

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "assets/integrations/update_prices"


def test_(client, mocker, stock_asset):
    # GIVEN
    mocker.patch(
        "variable_income_assets.integrations.views.BrApiClient.get_b3_prices",
        return_value={stock_asset.code: 78},
    )

    # WHEN
    response = client.post(URL)

    # THEN
    assert response.status_code == HTTP_200_OK

    stock_asset.refresh_from_db()
    assert stock_asset.current_price == 78
    assert stock_asset.current_price_updated_at is not None

    assert AssetReadModel.objects.get(write_model_pk=stock_asset.pk).current_price == 78

    assert (
        TaskHistory.objects.filter(
            name="fetch_current_assets_prices", state=TaskStates.success
        ).count()
        == 1
    )


@pytest.mark.skip("Skip while still in WSGI")
@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_a(refresh_token, mocker, stock_asset, async_client):
    # GIVEN
    mocker.patch(
        "variable_income_assets.integrations.views.BrApiClient.get_b3_prices",
        return_value={stock_asset.code: 78},
    )

    # WHEN
    response = await async_client.post(
        URL, content_type="application/json", AUTHORIZATION=f"Bearer {refresh_token.access_token}"
    )

    # THEN
    assert response.status_code == HTTP_200_OK

    await stock_asset.arefresh_from_db()
    assert stock_asset.current_price == 78
    assert stock_asset.current_price_updated_at is not None

    assert (await AssetReadModel.objects.aget(write_model_pk=stock_asset.pk)).current_price == 78

    assert (
        await TaskHistory.objects.filter(
            name="fetch_current_assets_prices", state=TaskStates.success
        ).acount()
        == 1
    )
