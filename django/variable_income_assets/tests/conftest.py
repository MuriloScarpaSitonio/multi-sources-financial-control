from random import randint
from re import I

from django.utils import timezone

import pytest
from factory.django import DjangoModelFactory

from authentication.tests.conftest import user
from variable_income_assets.choices import (
    AssetTypes,
    PassiveIncomeTypes,
    TransactionActions,
)
from variable_income_assets.models import Asset, Transaction, PassiveIncome


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
def simple_asset(user):
    return AssetFactory(code="ALUP11", type=AssetTypes.stock, user=user)


@pytest.fixture
def transactions(simple_asset):
    for i in range(1, 4):
        TransactionFactory(
            action=TransactionActions.buy,
            price=randint(5, 10),
            asset=simple_asset,
            quantity=100 * i,
        )
    TransactionFactory(
        action=TransactionActions.sell,
        price=10,
        asset=simple_asset,
        quantity=100,
        initial_price=5,
    )
    TransactionFactory(
        action=TransactionActions.sell,
        price=10,
        asset=simple_asset,
        quantity=50,
        initial_price=5,
    )


@pytest.fixture
def passive_incomes(simple_asset):
    for _ in range(4):
        PassiveIncomeFactory(
            type=PassiveIncomeTypes.dividend,
            amount=randint(100, 500),
            asset=simple_asset,
            credited_at=timezone.now().date(),
        )
