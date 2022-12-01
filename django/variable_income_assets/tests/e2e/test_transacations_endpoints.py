from decimal import Decimal

from django.utils import timezone

import pytest

from dateutil.relativedelta import relativedelta
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_400_BAD_REQUEST

from authentication.tests.conftest import client, secrets, user
from config.settings.base import BASE_API_URL
from config.settings.dynamic import dynamic_settings
from variable_income_assets.choices import AssetTypes, TransactionActions, TransactionCurrencies
from variable_income_assets.models import Asset, Transaction
from variable_income_assets.tests.shared import convert_to_float_and_quantitize

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "transactions"


def test__create(client, simple_asset):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "asset_code": simple_asset.code,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Transaction.objects.count() == 1


@pytest.mark.usefixtures("buy_transaction")
def test__create__sell_w_initial_price(client, simple_asset):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 50,
        "asset_code": simple_asset.code,
        "initial_price": 8,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Transaction.objects.count() == 2
    assert Transaction.objects.filter(action=TransactionActions.sell, initial_price=8).count() == 1


@pytest.mark.usefixtures("buy_transaction")
def test__create__sell_wo_initial_price_should_use_avg_price(client, simple_asset):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 50,
        "asset_code": simple_asset.code,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Transaction.objects.count() == 2
    assert (
        Transaction.objects.filter(
            action=TransactionActions.sell, initial_price=simple_asset.avg_price_from_transactions
        ).count()
        == 1
    )


def test__create__asset_and_transaction(client):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "asset_code": "ALUP11",
        "asset_type": AssetTypes.stock,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED

    asset = Asset.objects.get(code="ALUP11", type=AssetTypes.stock)
    assert Asset.objects.count() == 1
    assert asset.transactions.count() == 1
    assert (
        asset.transactions.filter(action=TransactionActions.buy, price=10, quantity=100).count()
        == 1
    )


@pytest.mark.usefixtures("buy_transaction")
def test__create__should_raise_error_if_initial_price_is_null(client, simple_asset):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 100,
        "asset_code": simple_asset.code,
        "initial_price": None,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"initial_price": ["This field may not be null."]}
    assert Transaction.objects.filter(action=TransactionActions.sell).count() == 0


def test__create__should_raise_error_if_asset_does_not_exist_and_not_type(client):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "asset_code": "ALUP11",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"asset.type": "If the asset does not exist, `type` is required"}
    assert Asset.objects.count() == 0


def test__create__should_raise_error_if_selling_transaction_and_no_transactions(
    client, simple_asset
):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 100,
        "asset_code": simple_asset.code,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "You can't sell more assets than you own"}
    assert Transaction.objects.count() == 0


@pytest.mark.usefixtures("simple_asset")
def test__create__should_raise_error_if_selling_transaction_and_no_asset(client):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 100,
        "asset_code": "ALUP11",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "You can't sell more assets than you own"}
    assert Transaction.objects.count() == 0


@pytest.mark.usefixtures("buy_transaction")
def test__create__should_raise_error_if_different_currency(client, simple_asset):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "asset_code": simple_asset.code,
        "currency": TransactionCurrencies.dollar,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "currency": (
            "Only one currency per asset is supported. "
            f"Current currency: {TransactionCurrencies.real}"
        )
    }

    assert Transaction.objects.count() == 1


@pytest.mark.usefixtures("simple_asset")
def test__update(client, buy_transaction):
    # GIVEN
    data = {
        "action": buy_transaction.action,
        "price": buy_transaction.price + 1,
        "quantity": buy_transaction.quantity,
        "asset_code": buy_transaction.asset.code,
    }

    # WHEN
    response = client.put(f"{URL}/{buy_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    for k, v in data.items():
        assert response.json()[k] == v


@pytest.mark.usefixtures("transactions_indicators_data")
def test_indicators(client):
    # GIVEN
    base_date = timezone.now().date().replace(day=1)
    relative_date = base_date - relativedelta(months=13)
    summ = current_bought = current_sold = 0

    for _ in range(13):
        relative_date = relative_date + relativedelta(months=1)

        bought = sum(
            (
                t.price * t.quantity
                if t.currency == TransactionCurrencies.real
                else t.price * t.quantity * dynamic_settings.DOLLAR_CONVERSION_RATE
                for t in Transaction.objects.bought().filter(
                    created_at__month=relative_date.month,
                    created_at__year=relative_date.year,
                )
            )
        )
        sold = sum(
            (
                t.price * t.quantity
                if t.currency == TransactionCurrencies.real
                else t.price * t.quantity * dynamic_settings.DOLLAR_CONVERSION_RATE
                for t in Transaction.objects.sold().filter(
                    created_at__month=relative_date.month, created_at__year=relative_date.year
                )
            )
        )

        if relative_date == base_date:
            current_bought = bought
            current_sold = sold
            continue

        summ += bought - sold

    # WHEN
    response = client.get(f"{URL}/indicators")

    # THEN
    avg = summ / 12

    assert response.status_code == 200
    assert response.json() == {
        "avg": convert_to_float_and_quantitize(avg),
        "current_bought": convert_to_float_and_quantitize(current_bought),
        "current_sold": convert_to_float_and_quantitize(current_sold),
        "diff_percentage": convert_to_float_and_quantitize(
            (((current_bought - current_sold) / avg) - Decimal("1.0")) * Decimal("100.0")
        ),
    }


@pytest.mark.usefixtures("transactions_indicators_data")
def test_historic(client):
    # GIVEN
    base_date = timezone.now().date().replace(day=1)
    relative_date = base_date - relativedelta(months=13)
    summ = 0
    result = {}

    for _ in range(13):
        relative_date = relative_date + relativedelta(months=1)

        bought = sum(
            (
                t.price * t.quantity
                if t.currency == TransactionCurrencies.real
                else t.price * t.quantity * dynamic_settings.DOLLAR_CONVERSION_RATE
                for t in Transaction.objects.bought().filter(
                    created_at__month=relative_date.month, created_at__year=relative_date.year
                )
            )
        )
        sold = sum(
            (
                t.price * t.quantity
                if t.currency == TransactionCurrencies.real
                else t.price * t.quantity * dynamic_settings.DOLLAR_CONVERSION_RATE
                for t in Transaction.objects.sold().filter(
                    created_at__month=relative_date.month, created_at__year=relative_date.year
                )
            )
        )

        result[f"{relative_date.day:02}/{relative_date.month:02}/{relative_date.year}"] = {
            "total_sold": convert_to_float_and_quantitize(sold * Decimal("-1")),
            "total_bought": convert_to_float_and_quantitize(bought),
            "diff": convert_to_float_and_quantitize(bought - sold),
        }

        if relative_date != base_date:
            summ += bought - sold

    # WHEN
    response = client.get(f"{URL}/historic")

    # THEN
    for h in response.json()["historic"]:
        assert result[h.pop("month")] == h

    assert response.json()["avg"] == convert_to_float_and_quantitize(summ / 12)
