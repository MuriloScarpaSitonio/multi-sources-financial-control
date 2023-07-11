from random import randint, choice

import pytest
from factory.django import DjangoModelFactory

from django.utils import timezone

from dateutil.relativedelta import relativedelta

from authentication.models import CustomUser
from authentication.tests.conftest import user
from tasks.tests.conftest import simple_task_history

from ..choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
    Currencies,
)
from ..management.commands.sync_assets_cqrs import Command as SyncAssetReadModelCommand
from ..models import Asset, AssetMetaData, AssetReadModel, Transaction, PassiveIncome


class AssetFactory(DjangoModelFactory):
    class Meta:
        model = Asset


class AssetMetaDataFactory(DjangoModelFactory):
    class Meta:
        model = AssetMetaData


class AssetReadModelFactory(DjangoModelFactory):
    class Meta:
        model = AssetReadModel


class TransactionFactory(DjangoModelFactory):
    class Meta:
        model = Transaction


class PassiveIncomeFactory(DjangoModelFactory):
    class Meta:
        model = PassiveIncome


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
        operation_date=timezone.now().date(),
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
def stock_usa_transaction(stock_usa_asset):
    return TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=stock_usa_asset,
        quantity=50,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def stock_usa_transaction_sell(stock_usa_asset):
    return TransactionFactory(
        action=TransactionActions.sell,
        price=12,
        asset=stock_usa_asset,
        initial_price=10,
        current_currency_conversion_rate=4.67,
        quantity=50,
        operation_date=timezone.now().date(),
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
            current_currency_conversion_rate=1,
            operation_date=timezone.now().date() - relativedelta(months=i * 2),
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
def transactions(stock_asset, simple_task_history):
    for i in range(1, 4):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=100 * i,
            fetched_by=simple_task_history,
            operation_date=timezone.now().date(),
        )
    TransactionFactory(
        action=TransactionActions.sell,
        price=10,
        asset=stock_asset,
        quantity=100,
        initial_price=5,
        current_currency_conversion_rate=1,
        fetched_by=simple_task_history,
        operation_date=timezone.now().date(),
    )
    TransactionFactory(
        action=TransactionActions.sell,
        price=10,
        asset=stock_asset,
        quantity=50,
        initial_price=5,
        current_currency_conversion_rate=1,
        fetched_by=simple_task_history,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def crypto_transaction(crypto_asset):
    TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=crypto_asset,
        quantity=50,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def crypto_brl_transaction(crypto_asset_brl):
    TransactionFactory(
        action=TransactionActions.buy,
        price=5,
        asset=crypto_asset_brl,
        quantity=500,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def another_stock_asset_transactions(another_stock_asset):
    TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=another_stock_asset,
        quantity=50,
        operation_date=timezone.now().date(),
    )
    TransactionFactory(
        action=TransactionActions.sell,
        price=10,
        asset=another_stock_asset,
        quantity=50,
        initial_price=10,
        current_currency_conversion_rate=1,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def passive_incomes(stock_asset):
    for i in range(4):
        PassiveIncomeFactory(
            type=PassiveIncomeTypes.dividend,
            amount=randint(100, 500),
            event_type=PassiveIncomeEventTypes.credited,
            asset=stock_asset,
            current_currency_conversion_rate=1,
            operation_date=timezone.now().date() - relativedelta(month=i),
        )
        PassiveIncomeFactory(
            type=PassiveIncomeTypes.dividend,
            amount=randint(100, 500),
            event_type=PassiveIncomeEventTypes.provisioned,
            asset=stock_asset,
            operation_date=timezone.now().date() + relativedelta(month=i),
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
    return [
        {
            "id": "61ae1cf62f3c630001419674",
            "code": "WILD",
            "currency": "USDT",
            "action": "BUY",
            "price": 2.8424,
            "quantity": 346.54111418,
            "operation_date": 1638800630.738,
        },
        {
            "id": "61ae1dfa941915000108f0ce",
            "code": "WILD",
            "currency": "USDT",
            "action": "SELL",
            "price": 4.0424,
            "quantity": 66.54111418,
            "operation_date": 1638800890.379,
        },
        {
            "id": "61ae1cea70405300010f4d07",
            "code": "QRDO",
            "currency": "USDT",
            "action": "BUY",
            "price": 5.4408,
            "quantity": 32.98106896,
            "operation_date": 1638800630.73,
        },
        {
            "id": "61ae1cea70405300010f4d08",
            "code": "VELO",
            "currency": "USDT",
            "action": "SELL",
            "price": 5.4408,
            "quantity": 32.98106896,
            "operation_date": 1638800630.73,
        },
    ]


@pytest.fixture
def buy_transaction(stock_asset):
    return TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=stock_asset,
        quantity=50,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def sell_transaction(stock_asset):
    return TransactionFactory(
        action=TransactionActions.sell,
        price=20,
        current_currency_conversion_rate=1,
        asset=stock_asset,
        quantity=50,
        initial_price=10,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def simple_income(stock_asset):
    return PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=200,
        event_type=PassiveIncomeEventTypes.credited,
        asset=stock_asset,
        current_currency_conversion_rate=1,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def another_income(stock_usa_asset):
    return PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=200,
        event_type=PassiveIncomeEventTypes.credited,
        asset=stock_usa_asset,
        current_currency_conversion_rate=4.81,
        operation_date=timezone.now().date(),
    )


# 6 - ativo aberto, apenas transações de compra, lucro
@pytest.fixture
def profit_asset_bought_transactions(stock_asset_metadata, buy_transaction):
    stock_asset_metadata.current_price = 15
    stock_asset_metadata.save()


# 7 - ativo aberto, apenas transações de compra, prejuízo
@pytest.fixture
def loss_asset_bought_transactions(stock_asset_metadata, buy_transaction):
    stock_asset_metadata.current_price = 5
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
        current_currency_conversion_rate=1,
        operation_date=timezone.now().date(),
    )


# 10 - ativo aberto, apenas transações de compra, prejuízo + incomes = prejuízo
@pytest.fixture
def loss_asset_bought_transactions_incomes_loss(loss_asset_bought_transactions, simple_income):
    pass


# 11 - ativo aberto, transações de compra e venda, lucro
@pytest.fixture
def profit_asset_both_transactions(stock_asset, profit_asset_bought_transactions):
    TransactionFactory(
        action=TransactionActions.sell,
        price=15,
        initial_price=10,
        current_currency_conversion_rate=1,
        asset=stock_asset,
        quantity=25,
        operation_date=timezone.now().date(),
    )


# 12 - ativo aberto, transações de compra e venda, prejuízo
@pytest.fixture
def loss_asset_both_transactions(stock_asset, loss_asset_bought_transactions):
    TransactionFactory(
        action=TransactionActions.sell,
        price=5,
        initial_price=10,
        current_currency_conversion_rate=1,
        asset=stock_asset,
        quantity=25,
        operation_date=timezone.now().date(),
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
        current_currency_conversion_rate=1,
        operation_date=timezone.now().date(),
    )


# 15 - ativo aberto, transações de compra e venda, prejuízo + incomes = prejuízo
@pytest.fixture
def loss_asset_both_transactions_incomes_loss(stock_asset, loss_asset_both_transactions):
    PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=1,
        event_type=PassiveIncomeEventTypes.credited,
        asset=stock_asset,
        current_currency_conversion_rate=1,
        operation_date=timezone.now().date(),
    )


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
        initial_price=10,
        current_currency_conversion_rate=5.1,
        asset=stock_usa_asset,
        quantity=25,
        operation_date=timezone.now().date(),
    )


# 12.dollar - ativo aberto, transações de compra e venda, prejuízo
@pytest.fixture
def loss_asset_usa_both_transactions(stock_usa_asset, loss_asset_usa_bought_transactions):
    TransactionFactory(
        action=TransactionActions.sell,
        price=5,
        initial_price=10,
        current_currency_conversion_rate=6.6,
        asset=stock_usa_asset,
        quantity=25,
        operation_date=timezone.now().date(),
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


@pytest.fixture
def indicators_data(
    transactions,
    passive_incomes,
    stock_asset_metadata,
    stock_usa_asset,
    stock_usa_asset_metadata,
    crypto_asset,
    crypto_asset_metadata,
    crypto_transaction,
):
    stock_asset_metadata.current_price = 100
    stock_asset_metadata.save()

    # finish an asset
    TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=stock_usa_asset,
        quantity=50,
        operation_date=timezone.now().date(),
    )
    TransactionFactory(
        action=TransactionActions.sell,
        initial_price=10,
        current_currency_conversion_rate=4.45,
        price=20,
        asset=stock_usa_asset,
        quantity=50,
        operation_date=timezone.now().date(),
    )


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
        code="RANDOM",
        type=asset_type,
        currency=Currencies.real,
        sector=choice(AssetSectors.choices)[0],
        current_price=6,
        current_price_updated_at=timezone.now(),
    )

    TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=asset,
        quantity=50,
        operation_date=timezone.now().date(),
    )
    TransactionFactory(
        action=TransactionActions.buy,
        price=12,
        asset=asset,
        quantity=50,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def transactions_indicators_data(stock_asset, crypto_transaction):
    today = timezone.now().date()

    for i in range(4):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=randint(100, 1000),
            operation_date=today,
        )
    for i in range(3):
        TransactionFactory(
            action=TransactionActions.sell,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=randint(100, 1000),
            initial_price=5,
            current_currency_conversion_rate=1,
            operation_date=today,
        )

    base_date = today - relativedelta(years=3)
    for i in range(36):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=randint(100, 1000),
            operation_date=base_date + relativedelta(months=i),
        )
        TransactionFactory(
            action=TransactionActions.sell,
            price=randint(5, 10),
            asset=stock_asset,
            quantity=randint(100, 1000),
            operation_date=base_date + relativedelta(months=i),
            initial_price=5,
            current_currency_conversion_rate=1,
        )


@pytest.fixture
def irpf_assets_data(stock_usa_asset):
    today = timezone.now().date()

    for i in range(4):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_usa_asset,
            quantity=randint(100, 1000),
            operation_date=today,
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
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=stock_usa_asset,
            quantity=randint(100, 1000),
            operation_date=base_date + relativedelta(months=i),
        )
        PassiveIncomeFactory(
            type=choice(PassiveIncomeTypes.choices)[0],
            amount=randint(100, 1000),
            event_type=PassiveIncomeEventTypes.credited,
            asset=stock_usa_asset,
            current_currency_conversion_rate=5.01,
            operation_date=base_date + relativedelta(months=i),
        )


@pytest.fixture
def irpf_transactions_data(stock_usa_asset):
    today = timezone.now().date()

    for _ in range(4):
        quantity = randint(100, 1000)
        price = randint(50, 100)
        TransactionFactory(
            action=TransactionActions.buy,
            price=price,
            asset=stock_usa_asset,
            quantity=quantity,
            operation_date=today,
        )
        TransactionFactory(
            action=TransactionActions.sell,
            price=price * 2,
            initial_price=price,
            asset=stock_usa_asset,
            quantity=quantity,
            current_currency_conversion_rate=4.99,
            operation_date=today,
        )
