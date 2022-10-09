from random import randint, choice

import pytest
from factory.django import DjangoModelFactory

from django.utils import timezone

from dateutil.relativedelta import relativedelta

from authentication.tests.conftest import user
from tasks.tests.conftest import simple_task_history

from ..choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
    TransactionCurrencies,
)
from ..models import Asset, Transaction, PassiveIncome


class AssetFactory(DjangoModelFactory):
    class Meta:
        model = Asset


class TransactionFactory(DjangoModelFactory):
    class Meta:
        model = Transaction


class PassiveIncomeFactory(DjangoModelFactory):
    class Meta:
        model = PassiveIncome


@pytest.fixture(autouse=True)
def celery_always_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True


@pytest.fixture
def simple_asset(user):
    return AssetFactory(
        code="ALUP11",
        type=AssetTypes.stock,
        sector=AssetSectors.utilities,
        objective=AssetObjectives.dividend,
        user=user,
    )


@pytest.fixture
def another_asset(user):
    return AssetFactory(
        code="URA",
        type=AssetTypes.stock_usa,
        sector=AssetSectors.utilities,
        objective=AssetObjectives.growth,
        user=user,
    )


@pytest.fixture
def crypto_asset(user):
    return AssetFactory(
        code="QRDO",
        type=AssetTypes.crypto,
        sector=AssetSectors.tech,
        objective=AssetObjectives.growth,
        user=user,
        current_price=6,
    )


@pytest.fixture
def assets(simple_asset, another_asset, crypto_asset):
    return simple_asset, another_asset, crypto_asset


@pytest.fixture
def transactions(simple_asset, simple_task_history):
    for i in range(1, 4):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=simple_asset,
            quantity=100 * i,
            fetched_by=simple_task_history,
        )
    TransactionFactory(
        action=TransactionActions.sell,
        price=10,
        asset=simple_asset,
        quantity=100,
        initial_price=5,
        fetched_by=simple_task_history,
    )
    TransactionFactory(
        action=TransactionActions.sell,
        price=10,
        asset=simple_asset,
        quantity=50,
        initial_price=5,
        fetched_by=simple_task_history,
    )


@pytest.fixture
def crypto_transaction(crypto_asset):
    TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=crypto_asset,
        quantity=50,
        currency=TransactionCurrencies.dollar,
    )


@pytest.fixture
def passive_incomes(simple_asset):
    for i in range(4):
        PassiveIncomeFactory(
            type=PassiveIncomeTypes.dividend,
            amount=randint(100, 500),
            event_type=PassiveIncomeEventTypes.credited,
            asset=simple_asset,
            operation_date=timezone.now().date() - relativedelta(month=i),
        )
        PassiveIncomeFactory(
            type=PassiveIncomeTypes.dividend,
            amount=randint(100, 500),
            event_type=PassiveIncomeEventTypes.provisioned,
            asset=simple_asset,
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
def fetch_current_assets_prices_response(simple_asset):
    return {simple_asset.code: 100.78}


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
            "created_at": 1638800630.738,
        },
        {
            "id": "61ae1dfa941915000108f0ce",
            "code": "WILD",
            "currency": "USDT",
            "action": "SELL",
            "price": 4.0424,
            "quantity": 66.54111418,
            "created_at": 1638800890.379,
        },
        {
            "id": "61ae1cea70405300010f4d07",
            "code": "QRDO",
            "currency": "USDT",
            "action": "BUY",
            "price": 5.4408,
            "quantity": 32.98106896,
            "created_at": 1638800630.73,
        },
    ]


@pytest.fixture
def buy_transaction(simple_asset):
    return TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=simple_asset,
        quantity=50,
    )


@pytest.fixture
def simple_income(simple_asset):
    return PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=200,
        event_type=PassiveIncomeEventTypes.credited,
        asset=simple_asset,
        operation_date=timezone.now().date(),
    )


# 6 - ativo aberto, apenas transações de compra, lucro
@pytest.fixture
def profit_asset_bought_transactions(simple_asset, buy_transaction):
    simple_asset.current_price = 15
    simple_asset.save()


# 7 - ativo aberto, apenas transações de compra, prejuízo
@pytest.fixture
def loss_asset_bought_transactions(simple_asset, buy_transaction):
    simple_asset.current_price = 5
    simple_asset.save()


# 8 - ativo aberto, apenas transações de compra, lucro + incomes
@pytest.fixture
def profit_asset_bought_transactions_incomes(profit_asset_bought_transactions, simple_income):
    pass


# 9 - ativo aberto, apenas transações de compra, prejuízo + incomes = lucro
@pytest.fixture
def loss_asset_bought_transactions_incomes_profit(
    simple_asset, loss_asset_bought_transactions, simple_income
):
    PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=200,
        event_type=PassiveIncomeEventTypes.credited,
        asset=simple_asset,
        operation_date=timezone.now().date(),
    )


# 10 - ativo aberto, apenas transações de compra, prejuízo + incomes = prejuízo
@pytest.fixture
def loss_asset_bought_transactions_incomes_loss(loss_asset_bought_transactions, simple_income):
    pass


# 11 - ativo aberto, transações de compra e venda, lucro
@pytest.fixture
def profit_asset_both_transactions(simple_asset, profit_asset_bought_transactions):
    TransactionFactory(
        action=TransactionActions.sell,
        price=15,
        initial_price=10,
        asset=simple_asset,
        quantity=25,
    )


# 12 - ativo aberto, transações de compra e venda, prejuízo
@pytest.fixture
def loss_asset_both_transactions(simple_asset, loss_asset_bought_transactions):
    TransactionFactory(
        action=TransactionActions.sell,
        price=5,
        initial_price=10,
        asset=simple_asset,
        quantity=25,
    )


# 13 - ativo aberto, transações de compra e venda, lucro + incomes
@pytest.fixture
def profit_asset_both_transactions_incomes(profit_asset_both_transactions, simple_income):
    pass


# 14 - ativo aberto, transações de compra e venda, prejuízo + incomes = lucro
@pytest.fixture
def loss_asset_both_transactions_incomes_profit(
    simple_asset, loss_asset_both_transactions, simple_income
):
    PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=51,
        event_type=PassiveIncomeEventTypes.credited,
        asset=simple_asset,
        operation_date=timezone.now().date(),
    )


# 15 - ativo aberto, transações de compra e venda, prejuízo + incomes = prejuízo
@pytest.fixture
def loss_asset_both_transactions_incomes_loss(simple_asset, loss_asset_both_transactions):
    PassiveIncomeFactory(
        type=PassiveIncomeTypes.dividend,
        amount=1,
        event_type=PassiveIncomeEventTypes.credited,
        asset=simple_asset,
        operation_date=timezone.now().date(),
    )


@pytest.fixture
def indicators_data(
    simple_asset, another_asset, crypto_asset, transactions, crypto_transaction, passive_incomes
):
    simple_asset.current_price = 100
    simple_asset.save()

    # finish an asset
    TransactionFactory(
        action=TransactionActions.buy,
        price=10,
        asset=another_asset,
        quantity=50,
    )
    TransactionFactory(
        action=TransactionActions.sell,
        initial_price=10,
        price=20,
        asset=another_asset,
        quantity=50,
    )


@pytest.fixture
def report_data(indicators_data, another_asset, user):
    # set to ensure this asset won't appear on the report as it's finished
    another_asset.current_price = 100
    another_asset.save()

    asset = AssetFactory(
        code="RANDOM",
        type=choice(AssetTypes.choices)[0],
        sector=choice(AssetSectors.choices)[0],
        objective=choice(AssetObjectives.choices)[0],
        current_price=6,
        user=user,
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
def transactions_indicators_data(simple_asset, crypto_transaction):
    today = timezone.now().date()

    for i in range(4):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=simple_asset,
            quantity=randint(100, 1000),
        )
    for i in range(3):
        TransactionFactory(
            action=TransactionActions.sell,
            price=randint(5, 10),
            asset=simple_asset,
            quantity=randint(100, 1000),
            initial_price=5,
        )

    base_date = today - relativedelta(years=3)
    for i in range(36):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=simple_asset,
            quantity=randint(100, 1000),
            created_at=base_date + relativedelta(months=i),
        )
        TransactionFactory(
            action=TransactionActions.sell,
            price=randint(5, 10),
            asset=simple_asset,
            quantity=randint(100, 1000),
            created_at=base_date + relativedelta(months=i),
            initial_price=5,
        )
