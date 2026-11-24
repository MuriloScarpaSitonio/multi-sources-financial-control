from datetime import date
from decimal import Decimal

import pytest
from aioresponses import aioresponses
from asgiref.sync import async_to_sync

from tasks.choices import TaskStates
from tasks.constants import ERROR_DISPLAY_TEXT
from tasks.models import TaskHistory

from ...choices import AssetSectors, AssetTypes, Currencies
from ...integrations.binance.enums import FiatPaymentTransactionType
from ...integrations.binance.handlers import sync_binance_transactions
from ...integrations.handlers import _fetch_prices, update_prices
from ...integrations.helpers import fetch_asset_close_price, fetch_asset_current_price
from ...integrations.kucoin.handlers import sync_kucoin_transactions
from ...models import Asset, AssetMetaData, AssetReadModel, Transaction

pytestmark = pytest.mark.django_db


def test__fetch_prices__global_equity_uses_us_market_client(mocker):
    # Omitting the global-equity batch must make the returned price group disappear.
    metadata = AssetMetaData.objects.create(
        code="VT",
        type="EQUITY_GLOBAL",
        currency=Currencies.dollar,
        current_price=1,
    )
    mocker.patch(
        "variable_income_assets.integrations.handlers.get_b3_prices",
        side_effect=[{}, {}],
    )
    mocker.patch(
        "variable_income_assets.integrations.handlers.get_crypto_prices",
        side_effect=[{}, {}],
    )
    mocker.patch(
        "variable_income_assets.integrations.handlers.get_stocks_usa_prices",
        side_effect=[{}, {"VT": 123.45}],
    )

    _, prices = async_to_sync(_fetch_prices)(
        AssetMetaData.objects.filter(pk=metadata.pk)
    )

    assert {
        "prices": {"VT": 123.45},
        "type": "EQUITY_GLOBAL",
        "currency": Currencies.dollar,
    } in prices


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

@pytest.mark.usefixtures(
    "buy_transaction",
    "crypto_transaction",
    "crypto_brl_transaction",
    "stock_usa_transaction",
    "fii_transaction",
)
def test__update_prices(
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
        "variable_income_assets.integrations.handlers.get_b3_prices",
        side_effect=[{stock_asset_metadata.code: 78}, {fii_asset_metadata.code: 100}],
    )
    stock_roi_before = AssetReadModel.objects.get(write_model_pk=stock_asset.pk).normalized_roi
    fii_roi_before = AssetReadModel.objects.get(write_model_pk=fii_asset.pk).normalized_roi

    mocker.patch(
        "variable_income_assets.integrations.handlers.get_stocks_usa_prices",
        side_effect=[{stock_usa_asset_metadata.code: 26}, {}],
    )
    stock_usa_roi_before = AssetReadModel.objects.get(
        write_model_pk=stock_usa_asset.pk
    ).normalized_roi

    mocker.patch(
        "variable_income_assets.integrations.handlers.get_crypto_prices",
        side_effect=[{crypto_asset_metadata.code: 1}, {crypto_asset_brl_metadata.code: 5}],
    )
    crypto_usd_roi_before = AssetReadModel.objects.get(
        write_model_pk=crypto_asset.pk
    ).normalized_roi
    crypto_brl_roi_before = AssetReadModel.objects.get(
        write_model_pk=crypto_asset_brl.pk
    ).normalized_roi

    # WHEN
    # TODO: convert to async
    async_to_sync(update_prices)()

    # THEN
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


@pytest.mark.freeze_time
@pytest.mark.usefixtures("crypto_asset_metadata")
def test__sync_kucoin_transactions__create_asset_and_transaction(
    user_with_kucoin_integration,
    crypto_asset,
    kucoin_transactions_response,
    sync_assets_read_model,
    kucoin_fetch_transactions_url,
):
    # GIVEN
    crypto_asset.user = user_with_kucoin_integration
    crypto_asset.save()

    # WHEN
    with aioresponses() as aiohttp_mock:
        aiohttp_mock.get(kucoin_fetch_transactions_url, payload=kucoin_transactions_response)

        # TODO: convert to async
        async_to_sync(sync_kucoin_transactions)(user_id=user_with_kucoin_integration.pk)

    data = kucoin_transactions_response["data"]["items"]

    # THEN
    assert (
        TaskHistory.objects.filter(
            name="sync_kucoin_transactions_task",
            created_by_id=user_with_kucoin_integration.pk,
            error="",
            state=TaskStates.success,
        ).count()
        == 1
    )

    assert (
        Asset.objects.filter(user=user_with_kucoin_integration, type=AssetTypes.crypto).count() == 2
    )
    assert (
        Asset.objects.filter(
            user=user_with_kucoin_integration,
            code=data[0]["symbol"].split("-")[0],
            type=AssetTypes.crypto,
        ).count()
        == 1
    )
    assert (
        AssetMetaData.objects.filter(
            code=data[0]["symbol"].split("-")[0],
            type=AssetTypes.crypto,
            currency=Currencies.dollar,
            sector=AssetSectors.tech,
            # current_price=kucoin_transactions_response[0]["price"],
            current_price_updated_at__isnull=False,
        ).count()
        == 1
    )
    assert (
        AssetReadModel.objects.filter(
            code=data[0]["symbol"].split("-")[0],
            type=AssetTypes.crypto,
            currency=Currencies.dollar,
        ).count()
        == 1
    )
    assert (
        sorted(Asset.objects.values_list("code", flat=True))
        == sorted(AssetMetaData.objects.values_list("code", flat=True).distinct())
        == sorted(AssetReadModel.objects.values_list("code", flat=True))
        == sorted({item["symbol"].split("-")[0] for item in data} ^ {"VELO"})
    )

    assert Transaction.objects.count() == len(data) - 1


@pytest.mark.usefixtures("crypto_asset_metadata")
def test__sync_kucoin_transactions__skip_if_already_exists(
    user_with_kucoin_integration,
    crypto_asset,
    kucoin_transactions_response,
    sync_assets_read_model,
    kucoin_fetch_transactions_url,
):
    # GIVEN
    crypto_asset.user = user_with_kucoin_integration
    crypto_asset.save()

    kucoin_transactions_response["data"]["items"][0]["id"] = kucoin_transactions_response["data"][
        "items"
    ][1]["id"]

    # WHEN
    with aioresponses() as aiohttp_mock:
        aiohttp_mock.get(kucoin_fetch_transactions_url, payload=kucoin_transactions_response)

        # TODO: convert to async
        async_to_sync(sync_kucoin_transactions)(user_id=user_with_kucoin_integration.pk)

    # WHEN

    # THEN
    assert Transaction.objects.count() == len(kucoin_transactions_response["data"]["items"]) - 2


def test__sync_kucoin_transactions__error(user_with_kucoin_integration, mocker):
    # GIVEN
    mocker.patch(
        "variable_income_assets.integrations.kucoin.handlers.TransactionsIntegrationOrchestrator.sync",
        return_value=("", Exception("Error!")),
    )

    # WHEN
    # TODO: convert to async
    async_to_sync(sync_kucoin_transactions)(user_id=user_with_kucoin_integration.pk)

    # THEN
    assert (
        TaskHistory.objects.filter(
            name="sync_kucoin_transactions_task",
            created_by_id=user_with_kucoin_integration.pk,
            error="Exception('Error!')",
            state=TaskStates.failure,
            notification_display_text=ERROR_DISPLAY_TEXT,
        ).count()
        == 1
    )


@pytest.mark.freeze_time
def test__sync_binance_transactions__create_asset_and_transaction(
    user_with_binance_integration,
    binance_account_snapshot_response,
    binance_account_snapshot_url,
    binance_symbol_orders_url,
    binance_symbol_orders_response,
    binance_fiat_payments_url,
    binance_fiat_payments_buy_response,
    binance_fiat_payments_sell_response,
    binance_signature,
    mocker,
):
    # GIVEN
    mocker.patch(
        "variable_income_assets.integrations.binance.handlers.BinanceClient._generate_signature",
        return_value=binance_signature,
    )
    code = binance_account_snapshot_response["snapshotVos"][0]["data"]["balances"][0]["asset"]
    fiat_code = binance_fiat_payments_buy_response["data"][0]["cryptoCurrency"]

    # WHEN
    with aioresponses() as aiohttp_mock:
        aiohttp_mock.get(binance_account_snapshot_url, payload=binance_account_snapshot_response)
        aiohttp_mock.get(binance_symbol_orders_url, payload=binance_symbol_orders_response)
        aiohttp_mock.get(
            binance_fiat_payments_url + f"&transactionType={FiatPaymentTransactionType.BUY}",
            payload=binance_fiat_payments_buy_response,
        )
        aiohttp_mock.get(
            binance_fiat_payments_url + f"&transactionType={FiatPaymentTransactionType.SELL}",
            payload=binance_fiat_payments_sell_response,
        )

        # TODO: convert to async
        async_to_sync(sync_binance_transactions)(user_id=user_with_binance_integration.pk)

    # THEN
    assert (
        TaskHistory.objects.filter(
            name="sync_binance_transactions_task",
            created_by_id=user_with_binance_integration.pk,
            error="",
            state=TaskStates.success,
        ).count()
        == 1
    )
    assert Asset.objects.count() == 2  # do not create USDT
    assert (
        Asset.objects.filter(code=code, currency=Currencies.real, type=AssetTypes.crypto).count()
        == AssetReadModel.objects.filter(
            code=code, currency=Currencies.real, type=AssetTypes.crypto
        ).count()
        == AssetMetaData.objects.filter(
            code=code, currency=Currencies.real, type=AssetTypes.crypto
        ).count()
        == 1
    )
    assert (
        Asset.objects.filter(
            code=fiat_code, currency=Currencies.real, type=AssetTypes.crypto
        ).count()
        == AssetReadModel.objects.filter(
            code=fiat_code, currency=Currencies.real, type=AssetTypes.crypto
        ).count()
        == AssetMetaData.objects.filter(
            code=fiat_code, currency=Currencies.real, type=AssetTypes.crypto
        ).count()
        == 1
    )
    assert Transaction.objects.filter(asset__code=code, price=25000, quantity=0.1).count() == 1
    assert Transaction.objects.filter(asset__code=fiat_code).count() == 2


def test__sync_binance_transactions__error(user_with_binance_integration, mocker):
    # GIVEN
    mocker.patch(
        "variable_income_assets.integrations.kucoin.handlers.TransactionsIntegrationOrchestrator.sync",
        return_value=("", Exception("Error!")),
    )

    # WHEN
    # TODO: convert to async
    async_to_sync(sync_binance_transactions)(user_id=user_with_binance_integration.pk)

    # THEN
    assert (
        TaskHistory.objects.filter(
            name="sync_binance_transactions_task",
            created_by_id=user_with_binance_integration.pk,
            error="Exception('Error!')",
            state=TaskStates.failure,
            notification_display_text=ERROR_DISPLAY_TEXT,
        ).count()
        == 1
    )
