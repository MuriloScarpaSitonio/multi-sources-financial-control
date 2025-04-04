from datetime import timedelta
from decimal import Decimal
from functools import partial
from random import choice, randint
from time import time

from django.template.defaultfilters import slugify
from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from factory.django import DjangoModelFactory

from authentication.models import CustomUser
from authentication.tests.conftest import (
    another_client,
    another_secrets,
    another_user,
    binance_client,
    binance_secrets,
    client,
    kucoin_client,
    kucoin_secrets,
    secrets,
    user,
    user_with_binance_integration,
    user_with_kucoin_integration,
)

from ..adapters.key_value_store import update_dollar_conversion_rate
from ..choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    Currencies,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
)
from ..integrations.binance.client import BinanceClient
from ..integrations.kucoin.client import KuCoinClient
from ..management.commands.sync_assets_cqrs import Command as SyncAssetReadModelCommand
from ..models import (
    Asset,
    AssetClosedOperation,
    AssetMetaData,
    AssetReadModel,
    AssetsTotalInvestedSnapshot,
    PassiveIncome,
    Transaction,
)
from ..service_layer.tasks import upsert_asset_read_model


class AssetFactory(DjangoModelFactory):
    class Meta:
        model = Asset


class AssetClosedOperationFactory(DjangoModelFactory):
    class Meta:
        model = AssetClosedOperation


class AssetMetaDataFactory(DjangoModelFactory):
    class Meta:
        model = AssetMetaData


class AssetReadModelFactory(DjangoModelFactory):
    class Meta:
        model = AssetReadModel


class TransactionFactory(DjangoModelFactory):
    operation_date = timezone.localdate() - timedelta(days=2)
    current_currency_conversion_rate = 1

    class Meta:
        model = Transaction


class PassiveIncomeFactory(DjangoModelFactory):
    operation_date = timezone.localdate() - timedelta(days=2)
    current_currency_conversion_rate = 1

    class Meta:
        model = PassiveIncome


class AssetsTotalInvestedSnapshotFactory(DjangoModelFactory):
    operation_date = timezone.localdate().replace(day=1)

    class Meta:
        model = AssetsTotalInvestedSnapshot


@pytest.fixture(autouse=True)
def _update_dollar_conversion_rate():
    update_dollar_conversion_rate(Decimal("5.0"))


@pytest.fixture
def sync_assets_read_model():
    # TODO: evaluate
    SyncAssetReadModelCommand().handle(
        user_ids=list(CustomUser.objects.values_list("pk", flat=True))
    )


@pytest.fixture
def stock_asset_metadata():
    return AssetMetaDataFactory(
        code="ALUP11",
        type=AssetTypes.stock,
        sector=AssetSectors.utilities,
        currency=Currencies.real,
        current_price=32,
        current_price_updated_at=timezone.now(),
    )


@pytest.fixture
def stock_asset(user):
    return AssetFactory(
        code="ALUP11",
        type=AssetTypes.stock,
        currency=Currencies.real,
        objective=AssetObjectives.dividend,
        user=user,
    )


@pytest.fixture
def another_stock_asset(user):
    return AssetFactory(
        code="BBAS3",
        type=AssetTypes.stock,
        currency=Currencies.real,
        objective=AssetObjectives.dividend,
        user=user,
    )


@pytest.fixture
def another_stock_asset_metadata():
    return AssetMetaDataFactory(
        code="BBAS3",
        type=AssetTypes.stock,
        sector=AssetSectors.finance,
        currency=Currencies.real,
        current_price=50,
        current_price_updated_at=timezone.now(),
    )


@pytest.fixture
def yet_another_stock_asset(user):
    return AssetFactory(
        code="BBSE3",
        type=AssetTypes.stock,
        currency=Currencies.real,
        objective=AssetObjectives.dividend,
        user=user,
    )


@pytest.fixture
def fii_asset(user):
    return AssetFactory(
        code="FII11",
        type=AssetTypes.fii,
        currency=Currencies.real,
        objective=AssetObjectives.dividend,
        user=user,
    )


@pytest.fixture
def fii_asset_metadata():
    return AssetMetaDataFactory(
        code="FII11",
        type=AssetTypes.fii,
        sector=AssetSectors.essential_consumption,
        current_price=111,
        currency=Currencies.real,
        current_price_updated_at=timezone.now(),
    )


@pytest.fixture
def fii_transaction(fii_asset):
    return TransactionFactory(
        action=TransactionActions.buy,
        price=101,
        asset=fii_asset,
        quantity=50,
    )


@pytest.fixture
def stock_usa_asset(user):
    return AssetFactory(
        code="URA",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        objective=AssetObjectives.growth,
        user=user,
    )


@pytest.fixture
def stock_usa_asset_metadata(stock_usa_asset):
    return AssetMetaDataFactory(
        code=stock_usa_asset.code,
        type=stock_usa_asset.type,
        currency=stock_usa_asset.currency,
        sector=AssetSectors.utilities,
        current_price=21,
        current_price_updated_at=timezone.now(),
    )


@pytest.fixture
def another_stock_usa_asset(user):
    return AssetFactory(
        code="BABA",
        type=AssetTypes.stock_usa,
        currency=Currencies.dollar,
        objective=AssetObjectives.growth,
        user=user,
    )


@pytest.fixture
def assets_w_incomes(user):
    for i in range(10):
        asset = AssetFactory(
            code=str(i),
            type=AssetTypes.stock,
            objective=AssetObjectives.dividend,
            user=user,
        )

        PassiveIncomeFactory(
            type=PassiveIncomeTypes.dividend,
            amount=1,
            event_type=PassiveIncomeEventTypes.credited,
            asset=asset,
            operation_date=timezone.localdate() - relativedelta(months=i * 2),
        )


@pytest.fixture
def crypto_asset(user):
    return AssetFactory(
        code="QRDO",
        type=AssetTypes.crypto,
        currency=Currencies.dollar,
        objective=AssetObjectives.growth,
        user=user,
    )


@pytest.fixture
def crypto_asset_metadata():
    return AssetMetaDataFactory(
        code="QRDO",
        type=AssetTypes.crypto,
        sector=AssetSectors.tech,
        currency=Currencies.dollar,
        current_price=6,
        current_price_updated_at=timezone.now(),
    )


@pytest.fixture
def crypto_asset_brl(user):
    return AssetFactory(
        code="QRDO",
        type=AssetTypes.crypto,
        currency=Currencies.real,
        objective=AssetObjectives.growth,
        user=user,
    )


@pytest.fixture
def crypto_asset_brl_metadata():
    return AssetMetaDataFactory(
        code="QRDO",
        type=AssetTypes.crypto,
        sector=AssetSectors.tech,
        currency=Currencies.real,
        current_price=30,
        current_price_updated_at=timezone.now(),
    )


@pytest.fixture
def another_crypto_asset(user):
    return AssetFactory(
        code="BTC",
        type=AssetTypes.crypto,
        currency=Currencies.real,
        objective=AssetObjectives.growth,
        user=user,
    )


@pytest.fixture
def assets(stock_asset, stock_usa_asset, crypto_asset):
    return stock_asset, stock_usa_asset, crypto_asset


@pytest.fixture
def transactions(stock_asset):
    for i in range(1, 4):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=100 * i,
        )
    TransactionFactory(
        action=TransactionActions.sell,
        price=10,
        asset=stock_asset,
        quantity=100,
    )
    TransactionFactory(
        action=TransactionActions.sell,
        price=10,
        asset=stock_asset,
        quantity=50,
    )


@pytest.fixture
def crypto_transaction(crypto_asset):
    TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=crypto_asset,
        quantity=50,
        current_currency_conversion_rate=5.1,
    )


@pytest.fixture
def crypto_brl_transaction(crypto_asset_brl):
    TransactionFactory(
        action=TransactionActions.buy,
        price=5,
        asset=crypto_asset_brl,
        quantity=500,
    )


@pytest.fixture
def another_stock_asset_transactions(another_stock_asset):
    return (
        TransactionFactory(
            action=TransactionActions.buy,
            price=10,
            asset=another_stock_asset,
            quantity=50,
        ),
        TransactionFactory(
            action=TransactionActions.sell,
            price=12,
            asset=another_stock_asset,
            quantity=50,
        ),
    )


@pytest.fixture
def another_stock_asset_closed_operation(another_stock_asset, another_stock_asset_transactions):
    buy_transaction, sell_transaction = another_stock_asset_transactions
    return AssetClosedOperationFactory(
        normalized_total_bought=buy_transaction.quantity * buy_transaction.price,
        total_bought=buy_transaction.quantity * buy_transaction.price,
        quantity_bought=buy_transaction.quantity,
        normalized_total_sold=sell_transaction.quantity * sell_transaction.price,
        operation_datetime=timezone.localtime() - timedelta(days=1),
        asset=another_stock_asset,
    )


@pytest.fixture
def passive_incomes(stock_asset):
    for i in range(4):
        PassiveIncomeFactory(
            type=PassiveIncomeTypes.dividend,
            amount=randint(100, 500),
            event_type=PassiveIncomeEventTypes.credited,
            asset=stock_asset,
            operation_date=timezone.localdate() - relativedelta(month=i),
        )
        PassiveIncomeFactory(
            type=PassiveIncomeTypes.dividend,
            amount=randint(100, 500),
            event_type=PassiveIncomeEventTypes.provisioned,
            asset=stock_asset,
            operation_date=timezone.localdate() + relativedelta(month=i),
        )


@pytest.fixture
def cei_transactions_response():
    return [
        {
            "operation_date": "2021-03-03",
            "action": "buy",
            "market_type": "unit",
            "raw_negotiation_code": "ALUP11",
            "asset_specification": "ALUPAR UNT N2",
            "unit_amount": 100,
            "unit_price": 22.59,
            "total_price": 2259,
            "quotation_factor": 1,
        },
        {
            "operation_date": "2021-03-04",
            "action": "buy",
            "market_type": "unit",
            "raw_negotiation_code": "ALUP11",
            "asset_specification": "ALUPAR UNT N2",
            "unit_amount": 100,
            "unit_price": 22.19,
            "total_price": 2219,
            "quotation_factor": 1,
        },
    ]


@pytest.fixture
def fetch_current_assets_prices_response(stock_asset):
    return {stock_asset.code: 100.78}


@pytest.fixture
def kucoin_transactions_response():
    return {
        "data": {
            "items": [
                {
                    "id": "61ae1cf62f3c630001419674",
                    "symbol": "WILD-USDT",
                    "side": "BUY",
                    "dealFunds": 985.008462945232,
                    "dealSize": 346.54111418,
                    "createdAt": 1638800630.738,
                },
                {
                    "id": "61ae1dfa941915000108f0ce",
                    "symbol": "WILD-USDT",
                    "side": "sell",
                    "dealFunds": 268.985799961232,
                    "dealSize": 66.54111418,
                    "createdAt": 1638800890.379,
                },
                {
                    "id": "61ae1cea70405300010f4d07",
                    "symbol": "QRDO-USDT",
                    "side": "buy",
                    "dealFunds": 179.443399997568,
                    "dealSize": 32.98106896,
                    "createdAt": 1638800630.73,
                },
                {
                    "id": "61ae1cea70405300010f4d08",
                    "symbol": "VELO-USDT",
                    "side": "sell",
                    "dealFunds": 179.443399997568,
                    "dealSize": 32.98106896,
                    "createdAt": 1638800630.73,
                },
            ]
        }
    }


@pytest.fixture
def kucoin_fetch_transactions_url():
    return (
        f"{KuCoinClient.API_URL}/api/{KuCoinClient.API_VERSION}/orders?tradeType=TRADE&pageSize=500"
    )


@pytest.fixture
def binance_signature():
    return "2a0945c8b2978025fe15db65f440dce0f78fdb089d48bd134bc37e3b788feb87"


@pytest.fixture
def binance_account_snapshot_url(binance_signature, freezer):
    return (
        BinanceClient._create_url(path="accountSnapshot", is_margin_api=True)
        + f"?signature={binance_signature}&timestamp={int(time() * 1000)}&type=SPOT"
    )


@pytest.fixture
def binance_account_snapshot_response():
    return {
        "code": 200,
        "msg": "",
        "snapshotVos": [
            {
                "data": {
                    "balances": [
                        {"asset": "BTC", "free": "0.09905021", "locked": "0.00000000"},
                        {"asset": "USDT", "free": "1.89109409", "locked": "0.00000000"},
                    ],
                    "totalAssetOfBtc": "0.09942700",
                },
                "type": "spot",
                "updateTime": 1576281599000,
            }
        ],
    }


@pytest.fixture
def binance_symbol_orders_url(binance_signature, freezer):
    return (
        BinanceClient._create_url(path="allOrders", is_margin_api=False)
        + "?symbol=BTCBRL&startTime=0&limit=1000"
        + f"&signature={binance_signature}&timestamp={int(time() * 1000)}"
    )


@pytest.fixture
def binance_symbol_orders_response():
    return [
        {
            "symbol": "BTCBRL",
            "orderId": "1",
            "orderListId": -1,
            "clientOrderId": "web_myOrder1",
            "price": "25000",
            "origQty": "1.0",
            "executedQty": "0.1",
            "cummulativeQuoteQty": "0.0",
            "status": "FILLED",
            "timeInForce": "GTC",
            "type": "LIMIT",
            "side": "BUY",
            "stopPrice": "0.0",
            "icebergQty": "0.0",
            "time": 1499827319559,
            "updateTime": 1499827319559,
            "isWorking": True,
            "origQuoteOrderQty": "0.000000",
            "workingTime": 1499827319559,
            "selfTradePreventionMode": "NONE",
        }
    ]


@pytest.fixture
def binance_fiat_payments_url(binance_signature, freezer):
    return (
        BinanceClient._create_url(path="fiat/payments", is_margin_api=True)
        + "?beginTime=0&rows=500"
        + f"&signature={binance_signature}&timestamp={int(time() * 1000)}"
    )


@pytest.fixture
def binance_fiat_payments_buy_response():
    return {
        "code": "000000",
        "message": "success",
        "data": [
            {
                "orderNo": "353fca443f06466db0c4dc89f94f027a",
                "sourceAmount": "20.0",
                "fiatCurrency": "BRL",
                "obtainAmount": "4.462",
                "cryptoCurrency": "LUNA",
                "totalFee": "0.2",
                "price": "4.437472",
                "status": "Completed",
                "paymentMethod": "Credit Card",
                "createTime": 1624529919000,
                "updateTime": 1624529919000,
            }
        ],
        "total": 1,
        "success": True,
    }


@pytest.fixture
def binance_fiat_payments_sell_response():
    return {
        "code": "000000",
        "message": "success",
        "data": [
            {
                "orderNo": "353fca443f06466db0c4dc89f94f022b",
                "sourceAmount": "20.0",
                "fiatCurrency": "BRL",
                "obtainAmount": "4",
                "cryptoCurrency": "LUNA",
                "totalFee": "0.2",
                "price": "60",
                "status": "Completed",
                "paymentMethod": "Credit Card",
                "createTime": 1624529919000,
                "updateTime": 1624529919000,
            }
        ],
        "total": 1,
        "success": True,
    }


@pytest.fixture
def buy_transaction(stock_asset):
    return TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=stock_asset,
        quantity=50,
    )


@pytest.fixture
def sell_transaction(stock_asset):
    return TransactionFactory(
        action=TransactionActions.sell,
        price=20,
        asset=stock_asset,
        quantity=50,
    )


@pytest.fixture
def stock_asset_closed_operation(stock_asset, buy_transaction, sell_transaction):
    return AssetClosedOperationFactory(
        normalized_total_bought=buy_transaction.quantity * buy_transaction.price,
        total_bought=buy_transaction.quantity * buy_transaction.price,
        quantity_bought=buy_transaction.quantity,
        normalized_total_sold=sell_transaction.quantity * sell_transaction.price,
        operation_datetime=timezone.localtime() - timedelta(days=1),
        asset=stock_asset,
    )


@pytest.fixture
def stock_usa_transaction(stock_usa_asset):
    return TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=stock_usa_asset,
        current_currency_conversion_rate=5,
        quantity=50,
    )


@pytest.fixture
def stock_usa_sell_transaction(stock_usa_transaction):
    return TransactionFactory(  # ativo fechado
        action=TransactionActions.sell,
        price=stock_usa_transaction.price + 5,  # com lucro
        current_currency_conversion_rate=(
            stock_usa_transaction.current_currency_conversion_rate + 0.1
        ),
        asset=stock_usa_transaction.asset,
        quantity=stock_usa_transaction.quantity,  # ativo fechado
    )


@pytest.fixture
def stock_usa_asset_closed_operation(stock_usa_transaction, stock_usa_sell_transaction):
    return AssetClosedOperationFactory(
        normalized_total_bought=(
            stock_usa_transaction.quantity
            * stock_usa_transaction.price
            * stock_usa_transaction.current_currency_conversion_rate
        ),
        total_bought=stock_usa_transaction.quantity * stock_usa_transaction.price,
        quantity_bought=stock_usa_transaction.quantity,
        normalized_total_sold=(
            stock_usa_sell_transaction.price
            * stock_usa_sell_transaction.quantity
            * stock_usa_sell_transaction.current_currency_conversion_rate
        ),
        operation_datetime=timezone.localtime() - timedelta(days=1),
        asset=stock_usa_transaction.asset,
    )


@pytest.fixture
def simple_income(stock_asset):
    return PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=200,
        event_type=PassiveIncomeEventTypes.credited,
        asset=stock_asset,
    )


@pytest.fixture
def another_income(stock_usa_asset):
    return PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=200,
        event_type=PassiveIncomeEventTypes.credited,
        asset=stock_usa_asset,
        current_currency_conversion_rate=4.81,
    )


# 6 - ativo aberto, apenas transações de compra, lucro
@pytest.fixture
def profit_asset_bought_transactions(stock_asset_metadata, buy_transaction):
    stock_asset_metadata.current_price = buy_transaction.price + 5  # lucro
    stock_asset_metadata.save()


# 7 - ativo aberto, apenas transações de compra, prejuízo
@pytest.fixture
def loss_asset_bought_transactions(stock_asset_metadata, buy_transaction):
    stock_asset_metadata.current_price = buy_transaction.price - 5  # prejuizo
    stock_asset_metadata.save()


# 8 - ativo aberto, apenas transações de compra, lucro + incomes
@pytest.fixture
def profit_asset_bought_transactions_incomes(profit_asset_bought_transactions, simple_income):
    pass


# 9 - ativo aberto, apenas transações de compra, prejuízo + incomes = lucro
@pytest.fixture
def loss_asset_bought_transactions_incomes_profit(
    stock_asset, loss_asset_bought_transactions, simple_income
):
    PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=200,
        event_type=PassiveIncomeEventTypes.credited,
        asset=stock_asset,
    )


# 10 - ativo aberto, apenas transações de compra, prejuízo + incomes = prejuízo
@pytest.fixture
def loss_asset_bought_transactions_incomes_loss(loss_asset_bought_transactions, simple_income):
    pass


# 11 - ativo aberto, transações de compra e venda, lucro
@pytest.fixture
def profit_asset_both_transactions(buy_transaction, profit_asset_bought_transactions):
    TransactionFactory(
        action=TransactionActions.sell,
        price=buy_transaction.price + 5,  # lucro
        asset=buy_transaction.asset,
        quantity=buy_transaction.quantity / 2,  # aberto
    )


# 12 - ativo aberto, transações de compra e venda, prejuízo
@pytest.fixture
def loss_asset_both_transactions(buy_transaction, loss_asset_bought_transactions):
    TransactionFactory(
        action=TransactionActions.sell,
        price=buy_transaction.price - 5,  # prejuizo
        asset=buy_transaction.asset,
        quantity=buy_transaction.quantity / 2,  # aberto
    )


# 13 - ativo aberto, transações de compra e venda, lucro + incomes
@pytest.fixture
def profit_asset_both_transactions_incomes(profit_asset_both_transactions, simple_income):
    pass


# 14 - ativo aberto, transações de compra e venda, prejuízo + incomes = lucro
@pytest.fixture
def loss_asset_both_transactions_incomes_profit(
    stock_asset, loss_asset_both_transactions, simple_income
):
    PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=51,
        event_type=PassiveIncomeEventTypes.credited,
        asset=stock_asset,
    )


# 15 - ativo aberto, transações de compra e venda, prejuízo + incomes = prejuízo
@pytest.fixture
def loss_asset_both_transactions_incomes_loss(stock_asset, loss_asset_both_transactions):
    PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=1,
        event_type=PassiveIncomeEventTypes.credited,
        asset=stock_asset,
    )


# 16 - ativo aberto, porém previamente fechado com lucro, prejuízo
@pytest.fixture
def loss_asset_previously_closed_w_profit_loss(
    profit_asset_bought_transactions,
    stock_asset_metadata,
    stock_asset_closed_operation,
):
    return TransactionFactory(
        action=TransactionActions.buy,
        price=stock_asset_metadata.current_price + 20,  # prejuizo
        asset=stock_asset_closed_operation.asset,
        quantity=500,
        operation_date=timezone.localdate(),
    )


# 17 - ativo aberto, porém previamente fechado com lucro + incomes, prejuízo
@pytest.fixture
def loss_asset_previously_closed_w_incomes_and_profit_loss(
    loss_asset_previously_closed_w_profit_loss,
    stock_asset_closed_operation,
):
    stock_asset_closed_operation.credited_incomes = 10
    stock_asset_closed_operation.normalized_credited_incomes = 10
    stock_asset_closed_operation.save()


# TODO:
# 18 - ativo aberto, porém previamente fechado com lucro, lucro
# 19 - ativo aberto, porém previamente fechado com lucro + incomes, lucro

# 20 - ativo aberto, porém previamente fechado com prejuízo, prejuízo
# 21 - ativo aberto, porém previamente fechado com prejuízo + incomes, prejuízo
# 22 - ativo aberto, porém previamente fechado com prejuízo, lucro
# 23 - ativo aberto, porém previamente fechado com prejuízo + incomes, lucro


# 24 ativo fechado, lucro
@pytest.fixture
def profit_asset_closed(stock_asset_closed_operation, stock_asset_metadata):
    ...


# 6.dollar - ativo aberto, apenas transações de compra, lucro
@pytest.fixture
def profit_asset_usa_bought_transactions(stock_usa_asset_metadata, stock_usa_transaction):
    ...


# 7.dollar - ativo aberto, apenas transações de compra, prejuízo
@pytest.fixture
def loss_asset_usa_bought_transactions(stock_usa_asset_metadata, stock_usa_transaction):
    stock_usa_asset_metadata.current_price = 9
    stock_usa_asset_metadata.save()


# 9.dollar - ativo aberto, apenas transações de compra, prejuízo + incomes = lucro
@pytest.fixture
def loss_asset_usa_bought_transactions_incomes_profit(
    loss_asset_usa_bought_transactions, another_income
):
    ...


# 10.dollar - ativo aberto, apenas transações de compra, prejuízo + incomes = prejuízo
@pytest.fixture
def loss_asset_usa_bought_transactions_incomes_loss(
    loss_asset_usa_bought_transactions, another_income
):
    another_income.amount = 1
    another_income.save()


# 11.dollar - ativo aberto, transações de compra e venda, lucro
@pytest.fixture
def profit_asset_usa_both_transactions(stock_usa_asset, profit_asset_usa_bought_transactions):
    TransactionFactory(
        action=TransactionActions.sell,
        price=15,
        current_currency_conversion_rate=5.1,
        asset=stock_usa_asset,
        quantity=25,
    )


# 12.dollar - ativo aberto, transações de compra e venda, prejuízo
@pytest.fixture
def loss_asset_usa_both_transactions(stock_usa_asset, loss_asset_usa_bought_transactions):
    TransactionFactory(
        action=TransactionActions.sell,
        price=5,
        current_currency_conversion_rate=6.6,
        asset=stock_usa_asset,
        quantity=25,
    )


# 14.dollar - ativo aberto, transações de compra e venda, prejuízo + incomes = lucro
@pytest.fixture
def loss_asset_usa_both_transactions_incomes_profit(
    loss_asset_usa_both_transactions, another_income
):
    ...


# 15.dollar - ativo aberto, transações de compra e venda, prejuízo + incomes = prejuízo
@pytest.fixture
def loss_asset_usa_both_transactions_incomes_loss(another_income, loss_asset_usa_both_transactions):
    another_income.amount = 1
    another_income.save()


# 16.dollar - ativo aberto, porém previamente fechado com lucro, prejuízo
@pytest.fixture
def loss_asset_usa_previously_closed_w_profit_loss(
    stock_usa_asset_closed_operation,
    profit_asset_usa_bought_transactions,
    stock_usa_asset_metadata,
):
    return TransactionFactory(
        action=TransactionActions.buy,
        price=stock_usa_asset_metadata.current_price + 20,  # prejuizo
        asset=stock_usa_asset_closed_operation.asset,
        quantity=500,
        current_currency_conversion_rate=5.21,
        operation_date=timezone.localdate(),
    )


# 17.dollar - ativo aberto, porém previamente fechado com lucro + incomes, prejuízo
@pytest.fixture
def loss_asset_usa_previously_closed_w_incomes_and_profit_loss(
    loss_asset_usa_previously_closed_w_profit_loss,
    stock_usa_asset_closed_operation,
):
    stock_usa_asset_closed_operation.credited_incomes = 5
    stock_usa_asset_closed_operation.normalized_credited_incomes = 24.42
    stock_usa_asset_closed_operation.save()


# TODO:
# 18.dollar - ativo aberto, porém previamente fechado com lucro, lucro
# 19.dollar - ativo aberto, porém previamente fechado com lucro + incomes, lucro

# 20.dollar - ativo aberto, porém previamente fechado com prejuízo, prejuízo
# 21.dollar - ativo aberto, porém previamente fechado com prejuízo + incomes, prejuízo
# 22.dollar - ativo aberto, porém previamente fechado com prejuízo, lucro
# 23.dollar - ativo aberto, porém previamente fechado com prejuízo + incomes, lucro


@pytest.fixture
def indicators_data(
    transactions,
    passive_incomes,
    stock_asset_metadata,
    stock_usa_asset_closed_operation,
    stock_usa_asset_metadata,
    crypto_asset,
    crypto_asset_metadata,
    crypto_transaction,
):
    stock_asset_metadata.current_price = 100
    stock_asset_metadata.save()


@pytest.fixture
def report_data(indicators_data, stock_usa_asset, user):
    asset_type = choice((AssetTypes.fii, AssetTypes.stock, AssetTypes.crypto))
    asset = AssetFactory(
        code="RANDOM",
        currency=Currencies.real,
        type=asset_type,
        objective=choice(AssetObjectives.choices)[0],
        user=user,
    )
    AssetMetaDataFactory(
        code=asset.code,
        type=asset.type,
        currency=asset.currency,
        sector=choice(AssetSectors.choices)[0],
        current_price=6,
        current_price_updated_at=timezone.now(),
    )

    TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=asset,
        quantity=50,
    )
    TransactionFactory(
        action=TransactionActions.buy,
        price=12,
        asset=asset,
        quantity=50,
    )


@pytest.fixture
def transactions_indicators_data(stock_asset, crypto_transaction):
    today = timezone.localdate()

    for _ in range(4):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=randint(100, 1000),
            operation_date=today,
        )
    for _ in range(3):
        TransactionFactory(
            action=TransactionActions.sell,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=randint(100, 1000),
            operation_date=today,
        )

    base_date = today - relativedelta(years=3)
    for i in range(36):
        operation_date = base_date + relativedelta(months=i)
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=randint(100, 1000),
            operation_date=operation_date,
        )
        TransactionFactory(
            action=TransactionActions.sell,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=randint(100, 1000),
            operation_date=operation_date,
        )


@pytest.fixture
def irpf_assets_data(stock_usa_asset):
    today = timezone.localdate()

    for i in range(4):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_usa_asset,
            quantity=randint(100, 1000),
            operation_date=today,
            current_currency_conversion_rate=5.6,
        )
        PassiveIncomeFactory(
            type=choice(PassiveIncomeTypes.choices)[0],
            amount=randint(100, 1000),
            event_type=PassiveIncomeEventTypes.credited,
            asset=stock_usa_asset,
            current_currency_conversion_rate=4.99,
            operation_date=today - relativedelta(months=i),
        )

    base_date = today - relativedelta(years=3)
    for i in range(36):
        operation_date = base_date + relativedelta(months=i)
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_usa_asset,
            quantity=randint(100, 1000),
            operation_date=operation_date,
            current_currency_conversion_rate=5.5,
        )
        PassiveIncomeFactory(
            type=choice(PassiveIncomeTypes.choices)[0],
            amount=randint(100, 1000),
            event_type=PassiveIncomeEventTypes.credited,
            asset=stock_usa_asset,
            current_currency_conversion_rate=5.01,
            operation_date=operation_date,
        )


@pytest.fixture
def irpf_transactions_data(stock_usa_asset):
    today = timezone.localdate()

    for _ in range(4):
        quantity = randint(100, 1000)
        price = randint(50, 100)
        TransactionFactory(
            action=TransactionActions.buy,
            price=price,
            asset=stock_usa_asset,
            quantity=quantity,
            operation_date=today,
            current_currency_conversion_rate=5.3,
        )
        TransactionFactory(
            action=TransactionActions.sell,
            price=price * 2,
            asset=stock_usa_asset,
            quantity=quantity,
            current_currency_conversion_rate=4.99,
            operation_date=today,
        )


@pytest.fixture
def assets_total_invested_snapshot_factory(user):
    return partial(AssetsTotalInvestedSnapshotFactory, user=user)


@pytest.fixture
def fixed_asset_held_in_self_custody(user):
    description = "CDB Inter liquidez diária"
    code = slugify(description)
    asset = AssetFactory(
        type=AssetTypes.fixed_br,
        objective=AssetObjectives.dividend,
        currency=Currencies.real,
        code=code,
        description=description,
        user=user,
    )
    AssetMetaDataFactory(
        type=AssetTypes.fixed_br,
        sector=AssetSectors.finance,
        currency=Currencies.real,
        code=code,
        current_price=10_000,
        current_price_updated_at=timezone.now(),
        asset=asset,
    )
    upsert_asset_read_model(asset.id, is_held_in_self_custody=True)

    return asset


@pytest.fixture
def buy_transaction_from_fixed_asset_held_in_self_custody(fixed_asset_held_in_self_custody):
    t = TransactionFactory(
        action=TransactionActions.buy,
        price=10_000,
        asset=fixed_asset_held_in_self_custody,
        quantity=None,
    )
    upsert_asset_read_model(fixed_asset_held_in_self_custody.id, is_held_in_self_custody=True)
    return t


@pytest.fixture
def buy_and_sell_transactions_from_closed_and_fixed_asset_held_in_self_custody(
    fixed_asset_held_in_self_custody,
):
    t1 = TransactionFactory(
        action=TransactionActions.buy,
        price=10_000,
        asset=fixed_asset_held_in_self_custody,
        quantity=None,
    )
    t2 = TransactionFactory(
        action=TransactionActions.sell,
        price=15_000,
        asset=fixed_asset_held_in_self_custody,
        quantity=None,
    )
    upsert_asset_read_model(fixed_asset_held_in_self_custody.id, is_held_in_self_custody=True)
    return t1, t2
