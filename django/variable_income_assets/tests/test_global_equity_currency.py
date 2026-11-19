from datetime import date
from decimal import Decimal

import pytest
from asgiref.sync import async_to_sync

from config.settings.base import BASE_API_URL

from ..choices import AssetTypes, Currencies
from ..integrations.handlers import update_prices
from ..integrations.helpers import fetch_asset_close_price, fetch_asset_current_price
from ..models import Asset, AssetMetaData, AssetReadModel, Transaction

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "code,currency,provider,rate,invested,roi",
    [
        ("MUND11", Currencies.real, "get_b3_prices", None, 1000, 200),
        ("VWRA", Currencies.dollar, "get_stocks_usa_prices", 4, 4000, 2000),
    ],
)
def test_global_equity_creation_transaction_and_valuation(
    client, mocker, code, currency, provider, rate, invested, roi
):
    mocker.patch(
        f"variable_income_assets.integrations.helpers.{provider}",
        return_value={code: 120},
    )
    response = client.post(
        f"/{BASE_API_URL}assets",
        data={
            "code": code,
            "type": AssetTypes.equity_global,
            "currency": currency,
            "objective": "GROWTH",
        },
    )
    assert response.status_code == 201, response.json()
    asset = Asset.objects.get(code=code)
    data = {
        "asset_pk": asset.pk,
        "action": "BUY",
        "price": 100,
        "quantity": 10,
        "operation_date": "01/01/2024",
    }
    if rate is not None:
        data["current_currency_conversion_rate"] = rate
    response = client.post(f"/{BASE_API_URL}transactions", data=data)
    assert response.status_code == 201, response.json()
    transaction = Transaction.objects.get(asset=asset)
    assert transaction.current_currency_conversion_rate == (rate or 1)
    read = AssetReadModel.objects.get(write_model_pk=asset.pk)
    assert read.currency == currency
    assert read.normalized_total_bought == invested
    # Current USD/BRL is 5 in the shared test fixture; BRL values stay unchanged.
    assert read.normalized_roi == roi


@pytest.mark.parametrize(
    "currency,provider",
    [
        (Currencies.real, "get_b3_prices"),
        (Currencies.dollar, "get_stocks_usa_prices"),
    ],
)
def test_global_equity_current_price_routes_by_currency(mocker, currency, provider):
    b3 = mocker.patch(
        "variable_income_assets.integrations.helpers.get_b3_prices", return_value={"ETF": 120}
    )
    usd = mocker.patch(
        "variable_income_assets.integrations.helpers.get_stocks_usa_prices",
        return_value={"ETF": 30},
    )
    result = fetch_asset_current_price("ETF", AssetTypes.equity_global, currency)
    assert result == (120 if currency == Currencies.real else 30)
    selected, unused = (b3, usd) if currency == Currencies.real else (usd, b3)
    selected.assert_awaited_once_with(codes=("ETF",))
    unused.assert_not_called()


@pytest.mark.parametrize("currency", [Currencies.real, Currencies.dollar])
def test_global_equity_close_price_routes_by_currency(mocker, currency):
    b3 = mocker.patch(
        "variable_income_assets.integrations.helpers.get_b3_close_prices", return_value={"ETF": 120}
    )
    usd = mocker.patch(
        "variable_income_assets.integrations.helpers.get_stocks_usa_close_prices",
        return_value={"ETF": 30},
    )
    result = fetch_asset_close_price("ETF", AssetTypes.equity_global, currency, date(2024, 1, 1))
    assert result == (120 if currency == Currencies.real else 30)
    selected, unused = (b3, usd) if currency == Currencies.real else (usd, b3)
    selected.assert_awaited_once_with(codes=("ETF",), operation_date=date(2024, 1, 1))
    unused.assert_not_called()


def test_scheduled_global_quotes_keep_currencies_separate(mocker, user):
    # Same symbol in two asset records also verifies the update key includes currency.
    brl = AssetMetaData.objects.create(
        code="ETF", type=AssetTypes.equity_global, currency=Currencies.real, current_price=1
    )
    usd = AssetMetaData.objects.create(
        code="ETF", type=AssetTypes.equity_global, currency=Currencies.dollar, current_price=1
    )
    for metadata in (brl, usd):
        AssetReadModel.objects.create(
            code=metadata.code,
            type=metadata.type,
            currency=metadata.currency,
            metadata=metadata,
            user_id=user.pk,
            write_model_pk=metadata.pk,
            quantity_balance=10,
        )

    async def b3_prices(codes):
        return dict.fromkeys(codes, 120)

    async def usd_prices(codes):
        return dict.fromkeys(codes, 30)

    b3 = mocker.patch(
        "variable_income_assets.integrations.handlers.get_b3_prices", side_effect=b3_prices
    )
    foreign = mocker.patch(
        "variable_income_assets.integrations.handlers.get_stocks_usa_prices", side_effect=usd_prices
    )
    mocker.patch("variable_income_assets.integrations.handlers.get_crypto_prices", return_value={})
    assert async_to_sync(update_prices)() is None
    brl.refresh_from_db()
    usd.refresh_from_db()
    assert brl.current_price == Decimal("120")
    assert usd.current_price == Decimal("30")
    assert brl.current_price_updated_at is not None
    assert usd.current_price_updated_at is not None
    b3.assert_any_await(codes=["ETF"])
    foreign.assert_any_await(codes=["ETF"])
