from datetime import date
from decimal import Decimal

import pytest
from asgiref.sync import async_to_sync

from variable_income_assets.choices import AssetTypes, Currencies, TransactionActions
from variable_income_assets.integrations.b3.models import (
    AssetTradingMarket,
    AssetTradingSide,
)
from variable_income_assets.integrations.b3.service_layer.handlers import (
    sync_stock_transactions,
)
from variable_income_assets.models import Asset, AssetMetaData, Transaction

pytestmark = pytest.mark.django_db


# Mock data generators
def create_mock_trading_item(
    ticker_symbol="PETR4",
    side=AssetTradingSide.COMPRA,
    market_name=AssetTradingMarket.MERCADO_A_VISTA,
    trade_quantity=100,
    price_value=Decimal("28.50"),
    gross_amount=Decimal("2850.00"),
    reference_date="2023-05-15",
):
    """Create a mock trading item dictionary for the API response"""
    return {
        "tickerSymbol": ticker_symbol,
        "side": side.value,
        "marketName": market_name.value,
        "tradeQuantity": trade_quantity,
        "priceValue": float(price_value),
        "grossAmount": float(gross_amount),
        "tradeDateTime": f"{reference_date}T10:30:00",
    }


def create_mock_b3_response(date_str, trading_items):
    """Create a mock API response for a specific date"""
    return {
        "data": {
            "periods": {
                "periodLists": [{"referenceDate": date_str, "assetTradingList": trading_items}]
            }
        },
        "links": {
            "self": "https://api.example.com/assets-trading?page=1",
            "first": "https://api.example.com/assets-trading?page=1",
            "last": "https://api.example.com/assets-trading?page=1",
        },
    }


class MockStreamAssetsTradingResponse:
    """Helper class to mock the stream_assets_trading generator"""

    def __init__(self, date_items_pairs):
        self.date_items_pairs = date_items_pairs

    async def __aiter__(self):
        for date_str, items in self.date_items_pairs:
            yield date_str, items


# Fixtures
@pytest.fixture
def existing_asset(db, user):
    """Create an existing PETR4 asset for the user"""
    metadata = AssetMetaData.objects.create(
        code="PETR4",
        type=AssetTypes.stock,
        currency=Currencies.real,
        current_price=Decimal("28.50"),
    )

    asset = Asset.objects.create(
        user=user, code="PETR4", type=AssetTypes.stock, currency=Currencies.real
    )

    return asset, metadata


@pytest.fixture
def other_existing_asset(db, user):
    """Create an existing VALE3 asset for the user"""
    metadata = AssetMetaData.objects.create(
        code="VALE3",
        type=AssetTypes.stock,
        currency=Currencies.real,
        current_price=Decimal("75.20"),
    )

    asset = Asset.objects.create(
        user=user, code="VALE3", type=AssetTypes.stock, currency=Currencies.real
    )

    return asset, metadata


# Test cases
def test_existing_asset_buy_transaction(user, existing_asset, mocker):
    """Test syncing a buy transaction for an existing asset"""
    # GIVEN
    asset, metadata = existing_asset
    mock_items = [
        create_mock_trading_item(
            ticker_symbol="PETR4", side=AssetTradingSide.COMPRA, gross_amount=Decimal("2850.00")
        )
    ]

    stream_mock = MockStreamAssetsTradingResponse([("2023-05-15", mock_items)])
    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user)

    # THEN
    assert Transaction.objects.count() == 1
    transaction = Transaction.objects.first()
    assert transaction.asset_id == asset.id
    assert transaction.action == TransactionActions.buy
    assert transaction.price == Decimal("28.50")
    assert transaction.quantity == Decimal("2850.00")
    assert transaction.operation_date == date(2023, 5, 15)


def test_existing_asset_sell_transaction(user, existing_asset, mocker):
    """Test syncing a sell transaction for an existing asset"""
    # GIVEN
    asset, metadata = existing_asset

    # Create an initial buy transaction to have something to sell
    Transaction.objects.create(
        asset=asset,
        action=TransactionActions.buy,
        price=Decimal("25.00"),
        quantity=Decimal("5000.00"),
        operation_date=date(2023, 5, 1),
    )

    mock_items = [
        create_mock_trading_item(
            ticker_symbol="PETR4", side=AssetTradingSide.VENDA, gross_amount=Decimal("2850.00")
        )
    ]

    stream_mock = MockStreamAssetsTradingResponse([("2023-05-15", mock_items)])
    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user.id)

    # THEN
    assert Transaction.objects.count() == 2
    sell_transaction = Transaction.objects.order_by("-operation_date").first()
    assert sell_transaction.asset_id == asset.id
    assert sell_transaction.action == TransactionActions.sell
    assert sell_transaction.price == Decimal("28.50")
    assert sell_transaction.quantity == Decimal("2850.00")
    assert sell_transaction.operation_date == date(2023, 5, 15)


def test_existing_asset_sell_transaction_closing_position(user, existing_asset, mocker):
    """Test syncing a sell transaction that closes an asset position"""
    # GIVEN
    asset, metadata = existing_asset

    # Create an initial buy transaction
    Transaction.objects.create(
        asset=asset,
        action=TransactionActions.buy,
        price=Decimal("25.00"),
        quantity=Decimal("2500.00"),
        operation_date=date(2023, 5, 1),
    )

    # Create a sell transaction that will close the position
    mock_items = [
        create_mock_trading_item(
            ticker_symbol="PETR4", side=AssetTradingSide.VENDA, gross_amount=Decimal("2500.00")
        )
    ]

    stream_mock = MockStreamAssetsTradingResponse([("2023-05-15", mock_items)])
    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user.id)

    # THEN
    assert Transaction.objects.count() == 2
    transactions = Transaction.objects.order_by("operation_date")

    # First transaction is the buy
    assert transactions[0].action == TransactionActions.buy
    assert transactions[0].quantity == Decimal("2500.00")

    # Second transaction is the sell that closes the position
    assert transactions[1].action == TransactionActions.sell
    assert transactions[1].quantity == Decimal("2500.00")

    # Check that position is now closed (this depends on how your application tracks positions)
    # For example, you might have a get_current_quantity method or similar
    # This is a simplified example:
    total_quantity = sum(
        t.quantity if t.action == TransactionActions.buy else -t.quantity for t in transactions
    )
    assert total_quantity == 0


def test_two_new_assets_same_date_no_metadata(user, mocker):
    """Test syncing two new assets on the same date, both without existing metadata"""
    # GIVEN
    # Create mock items for two different assets
    mock_items = [
        create_mock_trading_item(ticker_symbol="BBAS3", gross_amount=Decimal("3000.00")),
        create_mock_trading_item(ticker_symbol="ITUB4", gross_amount=Decimal("4000.00")),
    ]

    stream_mock = MockStreamAssetsTradingResponse([("2023-05-15", mock_items)])
    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user.id)

    # THEN
    assert AssetMetaData.objects.count() == 2
    assert Asset.objects.count() == 2
    assert Transaction.objects.count() == 2

    # Check BBAS3 asset and transaction
    bbas_asset = Asset.objects.get(code="BBAS3")
    bbas_metadata = AssetMetaData.objects.get(code="BBAS3")
    bbas_transaction = Transaction.objects.get(asset=bbas_asset)

    assert bbas_asset.user_id == user.id
    assert bbas_asset.type == AssetTypes.stock
    assert bbas_transaction.quantity == Decimal("3000.00")

    # Check ITUB4 asset and transaction
    itub_asset = Asset.objects.get(code="ITUB4")
    itub_metadata = AssetMetaData.objects.get(code="ITUB4")
    itub_transaction = Transaction.objects.get(asset=itub_asset)

    assert itub_asset.user_id == user.id
    assert itub_asset.type == AssetTypes.stock
    assert itub_transaction.quantity == Decimal("4000.00")


def test_two_new_assets_same_date_with_metadata(user, mocker):
    """Test syncing two new assets on the same date, with existing metadata"""
    # GIVEN
    # Create metadata but no assets for the user
    AssetMetaData.objects.create(
        code="BBAS3",
        type=AssetTypes.stock,
        currency=Currencies.real,
        current_price=Decimal("35.40"),
    )

    AssetMetaData.objects.create(
        code="ITUB4",
        type=AssetTypes.stock,
        currency=Currencies.real,
        current_price=Decimal("30.80"),
    )

    # Create mock items for two different assets
    mock_items = [
        create_mock_trading_item(ticker_symbol="BBAS3", gross_amount=Decimal("3000.00")),
        create_mock_trading_item(ticker_symbol="ITUB4", gross_amount=Decimal("4000.00")),
    ]

    stream_mock = MockStreamAssetsTradingResponse([("2023-05-15", mock_items)])
    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user.id)

    # THEN
    assert AssetMetaData.objects.count() == 2  # No new metadata created
    assert Asset.objects.count() == 2  # Two new assets created
    assert Transaction.objects.count() == 2

    # Assets should be linked to the existing metadata
    bbas_asset = Asset.objects.get(code="BBAS3")
    bbas_transaction = Transaction.objects.get(asset=bbas_asset)

    assert bbas_asset.user_id == user.id
    assert bbas_transaction.quantity == Decimal("3000.00")

    itub_asset = Asset.objects.get(code="ITUB4")
    itub_transaction = Transaction.objects.get(asset=itub_asset)

    assert itub_asset.user_id == user.id
    assert itub_transaction.quantity == Decimal("4000.00")


def test_one_existing_one_new_asset_same_date(user, existing_asset, mocker):
    """Test syncing one existing and one new asset on the same date"""
    # GIVEN
    asset, metadata = existing_asset  # PETR4 asset

    # Create mock items for two different assets (one existing, one new)
    mock_items = [
        create_mock_trading_item(ticker_symbol="PETR4", gross_amount=Decimal("3000.00")),
        create_mock_trading_item(ticker_symbol="ITUB4", gross_amount=Decimal("4000.00")),
    ]

    stream_mock = MockStreamAssetsTradingResponse([("2023-05-15", mock_items)])
    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user.id)

    # THEN
    assert Asset.objects.count() == 2  # One existing + one new
    assert AssetMetaData.objects.count() == 2  # Same
    assert Transaction.objects.count() == 2

    # Check PETR4 transaction
    petr_transaction = Transaction.objects.get(asset__code="PETR4")
    assert petr_transaction.asset_id == asset.id
    assert petr_transaction.quantity == Decimal("3000.00")

    # Check ITUB4 asset and transaction
    itub_asset = Asset.objects.get(code="ITUB4")
    itub_transaction = Transaction.objects.get(asset__code="ITUB4")

    assert itub_asset.user_id == user.id
    assert itub_transaction.quantity == Decimal("4000.00")


def test_two_existing_assets_same_date(user, existing_asset, other_existing_asset, mocker):
    """Test syncing two existing assets on the same date"""
    # GIVEN
    petr_asset, petr_metadata = existing_asset  # PETR4 asset
    vale_asset, vale_metadata = other_existing_asset  # VALE3 asset

    # Create mock items for two existing assets
    mock_items = [
        create_mock_trading_item(ticker_symbol="PETR4", gross_amount=Decimal("3000.00")),
        create_mock_trading_item(ticker_symbol="VALE3", gross_amount=Decimal("4000.00")),
    ]

    stream_mock = MockStreamAssetsTradingResponse([("2023-05-15", mock_items)])
    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user.id)

    # THEN
    assert Asset.objects.count() == 2  # No new assets
    assert AssetMetaData.objects.count() == 2  # No new metadata
    assert Transaction.objects.count() == 2

    # Check PETR4 transaction
    petr_transaction = Transaction.objects.get(asset__code="PETR4")
    assert petr_transaction.asset_id == petr_asset.id
    assert petr_transaction.quantity == Decimal("3000.00")

    # Check VALE3 transaction
    vale_transaction = Transaction.objects.get(asset__code="VALE3")
    assert vale_transaction.asset_id == vale_asset.id
    assert vale_transaction.quantity == Decimal("4000.00")


def test_two_new_assets_different_dates(user, mocker):
    """Test syncing two new assets on different dates"""
    # GIVEN
    # Create mock items for two different assets on different dates
    mock_items_day1 = [
        create_mock_trading_item(
            ticker_symbol="BBAS3", gross_amount=Decimal("3000.00"), reference_date="2023-05-15"
        )
    ]

    mock_items_day2 = [
        create_mock_trading_item(
            ticker_symbol="ITUB4", gross_amount=Decimal("4000.00"), reference_date="2023-05-16"
        )
    ]

    stream_mock = MockStreamAssetsTradingResponse(
        [("2023-05-15", mock_items_day1), ("2023-05-16", mock_items_day2)]
    )

    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user.id)

    # THEN
    assert AssetMetaData.objects.count() == 2
    assert Asset.objects.count() == 2
    assert Transaction.objects.count() == 2

    # Check dates are correct
    bbas_transaction = Transaction.objects.get(asset__code="BBAS3")
    assert bbas_transaction.operation_date == date(2023, 5, 15)

    itub_transaction = Transaction.objects.get(asset__code="ITUB4")
    assert itub_transaction.operation_date == date(2023, 5, 16)


def test_one_existing_one_new_asset_different_dates(user, existing_asset, mocker):
    """Test syncing one existing and one new asset on different dates"""
    # GIVEN
    petr_asset, petr_metadata = existing_asset  # PETR4 asset

    # Create mock items for one existing and one new asset on different dates
    mock_items_day1 = [
        create_mock_trading_item(
            ticker_symbol="PETR4", gross_amount=Decimal("3000.00"), reference_date="2023-05-15"
        )
    ]

    mock_items_day2 = [
        create_mock_trading_item(
            ticker_symbol="ITUB4", gross_amount=Decimal("4000.00"), reference_date="2023-05-16"
        )
    ]

    stream_mock = MockStreamAssetsTradingResponse(
        [("2023-05-15", mock_items_day1), ("2023-05-16", mock_items_day2)]
    )

    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user.id)

    # THEN
    assert AssetMetaData.objects.count() == 2  # One existing + one new
    assert Asset.objects.count() == 2  # One existing + one new
    assert Transaction.objects.count() == 2

    # Check PETR4 transaction
    petr_transaction = Transaction.objects.get(asset__code="PETR4")
    assert petr_transaction.asset_id == petr_asset.id
    assert petr_transaction.operation_date == date(2023, 5, 15)

    # Check ITUB4 transaction
    itub_transaction = Transaction.objects.get(asset__code="ITUB4")
    assert itub_transaction.operation_date == date(2023, 5, 16)


def test_two_existing_assets_different_dates(user, existing_asset, other_existing_asset, mocker):
    """Test syncing two existing assets on different dates"""
    # GIVEN
    petr_asset, petr_metadata = existing_asset  # PETR4 asset
    vale_asset, vale_metadata = other_existing_asset  # VALE3 asset

    # Create mock items for two existing assets on different dates
    mock_items_day1 = [
        create_mock_trading_item(
            ticker_symbol="PETR4", gross_amount=Decimal("3000.00"), reference_date="2023-05-15"
        )
    ]

    mock_items_day2 = [
        create_mock_trading_item(
            ticker_symbol="VALE3", gross_amount=Decimal("4000.00"), reference_date="2023-05-16"
        )
    ]

    stream_mock = MockStreamAssetsTradingResponse(
        [("2023-05-15", mock_items_day1), ("2023-05-16", mock_items_day2)]
    )

    mocker.patch(
        "variable_income_assets.integrations.b3.client.B3Client.stream_assets_trading",
        return_value=stream_mock,
    )

    # WHEN
    async_to_sync(sync_stock_transactions)(user.id)

    # THEN
    assert Asset.objects.count() == 2  # No new assets
    assert AssetMetaData.objects.count() == 2  # No new metadata
    assert Transaction.objects.count() == 2

    # Check PETR4 transaction
    petr_transaction = Transaction.objects.get(asset__code="PETR4")
    assert petr_transaction.asset_id == petr_asset.id
    assert petr_transaction.operation_date == date(2023, 5, 15)

    # Check VALE3 transaction
    vale_transaction = Transaction.objects.get(asset__code="VALE3")
    assert vale_transaction.asset_id == vale_asset.id
    assert vale_transaction.operation_date == date(2023, 5, 16)
