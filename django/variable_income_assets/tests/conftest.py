from random import randint

import pytest
from factory.django import DjangoModelFactory

from django.utils import timezone

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


@pytest.fixture(autouse=True)
def celery_always_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True


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


@pytest.fixture
def cei_crawler_assets_response():
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
