from random import randint

import pytest
from factory.django import DjangoModelFactory

from ..choices import AssetTypes, PassiveIncomeTypes, TransactionOptions
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


@pytest.fixture
def simple_asset():
    return AssetFactory(code="ALUP11", type=AssetTypes.stock)


@pytest.fixture
def transactions(simple_asset):
    for i in range(1, 4):
        TransactionFactory(
            action=TransactionOptions.buy,
            price=randint(5, 10),
            asset=simple_asset,
            quantity=100 * i,
        )


@pytest.fixture
def passive_incomes(simple_asset):
    for _ in range(4):
        PassiveIncomeFactory(
            type=PassiveIncomeTypes.dividend,
            amount=randint(100, 500),
            asset=simple_asset,
        )
