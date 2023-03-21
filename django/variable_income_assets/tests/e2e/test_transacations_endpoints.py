from decimal import Decimal

from django.utils import timezone

import pytest

from dateutil.relativedelta import relativedelta
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
)

from authentication.tests.conftest import (
    client,
    kucoin_client,
    kucoin_secrets,
    secrets,
    user,
    user_with_kucoin_integration,
)
from config.settings.base import BASE_API_URL
from config.settings.dynamic import dynamic_settings
from variable_income_assets.choices import TransactionActions, TransactionCurrencies
from variable_income_assets.models import Transaction
from variable_income_assets.tasks import upsert_asset_read_model
from variable_income_assets.tests.shared import convert_and_quantitize

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "transactions"


@pytest.mark.django_db(transaction=True)
def test__create(client, stock_asset, mocker):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "asset_code": stock_asset.code,
    }
    mocked_task = mocker.patch.object(upsert_asset_read_model, "delay")

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args[1] == {"asset_id": stock_asset.pk}

    assert response.status_code == HTTP_201_CREATED
    assert Transaction.objects.filter(asset=stock_asset).count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("buy_transaction")
def test__create__sell_w_initial_price(client, stock_asset):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 50,
        "asset_code": stock_asset.code,
        "initial_price": 8,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Transaction.objects.count() == 2
    assert Transaction.objects.filter(action=TransactionActions.sell, initial_price=8).count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("buy_transaction")
def test__create__sell_wo_initial_price_should_use_avg_price(client, stock_asset):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 50,
        "asset_code": stock_asset.code,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_201_CREATED
    assert Transaction.objects.count() == 2
    assert (
        Transaction.objects.filter(
            action=TransactionActions.sell, initial_price=stock_asset.avg_price_from_transactions
        ).count()
        == 1
    )


def test__create__should_raise_error_if_asset_does_not_exist(client):
    # GIVEN
    data = {"action": TransactionActions.buy, "price": 10, "quantity": 100, "asset_code": "ALUP11"}

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
    assert response.json() == {"asset": "Not found."}


@pytest.mark.usefixtures("buy_transaction")
def test__create__should_raise_error_if_initial_price_is_null(client, stock_asset):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 100,
        "asset_code": stock_asset.code,
        "initial_price": None,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"initial_price": ["This field may not be null."]}
    assert Transaction.objects.filter(action=TransactionActions.sell).count() == 0


def test__create__should_raise_error_if_sell_transaction_and_no_transactions(client, stock_asset):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 100,
        "asset_code": stock_asset.code,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "You can't sell more assets than you own"}
    assert Transaction.objects.count() == 0


@pytest.mark.usefixtures("stock_asset")
def test__create__should_raise_error_if_sell_transaction_and_no_asset(client):
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
def test__create__should_raise_error_if_different_currency(client, stock_asset):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "asset_code": stock_asset.code,
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


@pytest.mark.usefixtures("stock_asset")
@pytest.mark.django_db(transaction=True)
def test__update(client, buy_transaction, mocker):
    # GIVEN
    data = {
        "action": buy_transaction.action,
        "price": buy_transaction.price + 1,
        "quantity": buy_transaction.quantity,
        "asset_code": buy_transaction.asset.code,
    }
    mocked_task = mocker.patch.object(upsert_asset_read_model, "delay")

    # WHEN
    response = client.put(f"{URL}/{buy_transaction.pk}", data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args[1] == {"asset_id": buy_transaction.asset_id}

    assert response.status_code == HTTP_200_OK
    for k, v in data.items():
        if k == "action":
            continue
        assert response.json()[k] == v

    buy_transaction.refresh_from_db()
    assert buy_transaction.price == data["price"]


@pytest.mark.usefixtures("stock_asset")
def test__update__transaction_does_not_belong_to_user(kucoin_client, buy_transaction):
    # GIVEN
    data = {
        "action": buy_transaction.action,
        "price": buy_transaction.price + 1,
        "quantity": buy_transaction.quantity,
        "asset_code": buy_transaction.asset.code,
    }

    # WHEN
    response = kucoin_client.put(f"{URL}/{buy_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Not found."}


@pytest.mark.usefixtures("buy_transaction")
@pytest.mark.django_db(transaction=True)
def test__update__sell_wo_initial_price_should_use_avg_price(client, stock_asset, sell_transaction):
    # GIVEN
    data = {
        "action": sell_transaction.action,
        "price": sell_transaction.price * 2,
        "quantity": sell_transaction.quantity,
        "asset_code": stock_asset.code,
    }

    # WHEN
    response = client.put(f"{URL}/{sell_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert (
        Transaction.objects.filter(
            action=TransactionActions.sell, initial_price=stock_asset.avg_price_from_transactions
        ).count()
        == 1
    )


def test__update__should_raise_error_if_initial_price_is_null(
    client, stock_asset, sell_transaction
):
    # GIVEN
    data = {
        "action": sell_transaction.action,
        "price": sell_transaction.price * 2,
        "quantity": sell_transaction.quantity,
        "asset_code": stock_asset.code,
        "initial_price": None,
    }

    # WHEN
    response = client.put(f"{URL}/{sell_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"initial_price": ["This field may not be null."]}


def test__update__should_raise_error_if_sell_transaction_and_no_transactions(
    client, stock_asset, buy_transaction
):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": buy_transaction.price,
        "quantity": 0.1,
        "asset_code": stock_asset.code,
    }

    # WHEN
    response = client.put(f"{URL}/{buy_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "You can't sell more assets than you own"}

    assert Transaction.objects.filter(action=TransactionActions.buy).count() == 1
    assert Transaction.objects.filter(action=TransactionActions.sell).count() == 0


@pytest.mark.usefixtures("buy_transaction")
def test__update__sell__should_raise_error_if_negative_quantity(
    client, stock_asset, sell_transaction
):
    # GIVEN
    data = {
        "action": sell_transaction.action,
        "price": sell_transaction.price,
        "quantity": sell_transaction.quantity * 2,
        "asset_code": stock_asset.code,
    }

    # WHEN
    response = client.put(f"{URL}/{sell_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "You can't sell more assets than you own"}


@pytest.mark.usefixtures("stock_asset")
def test__create__should_raise_error_if_sell_transaction_and_no_asset(client):
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
def test__create__should_raise_error_if_different_currency(client, stock_asset):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "asset_code": stock_asset.code,
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
        "avg": convert_and_quantitize(avg),
        "current_bought": convert_and_quantitize(current_bought),
        "current_sold": convert_and_quantitize(current_sold),
        "diff_percentage": convert_and_quantitize(
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
            "total_sold": convert_and_quantitize(sold * Decimal("-1")),
            "total_bought": convert_and_quantitize(bought),
            "diff": convert_and_quantitize(bought - sold),
        }

        if relative_date != base_date:
            summ += bought - sold

    # WHEN
    response = client.get(f"{URL}/historic")

    # THEN
    for h in response.json()["historic"]:
        assert result[h.pop("month")] == h

    assert response.json()["avg"] == convert_and_quantitize(summ / 12)


@pytest.mark.usefixtures("stock_asset")
@pytest.mark.django_db(transaction=True)
def test__delete(client, buy_transaction, mocker):
    # GIVEN
    mocked_task = mocker.patch.object(upsert_asset_read_model, "delay")

    # WHEN
    response = client.delete(f"{URL}/{buy_transaction.pk}")

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args[1] == {"asset_id": buy_transaction.asset_id}

    assert response.status_code == HTTP_204_NO_CONTENT
    assert Transaction.objects.count() == 0


@pytest.mark.usefixtures("stock_asset", "sell_transaction")
@pytest.mark.django_db(transaction=True)
def test__delete__error__negative_qty(client, buy_transaction, mocker):
    # GIVEN
    mocked_task = mocker.patch.object(upsert_asset_read_model, "delay")

    # WHEN
    response = client.delete(f"{URL}/{buy_transaction.pk}")

    # THEN
    assert mocked_task.call_count == 0

    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "You can't sell more assets than you own"}
    assert Transaction.objects.count() == 2
