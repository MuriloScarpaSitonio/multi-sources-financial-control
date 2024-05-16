from datetime import datetime
from decimal import Decimal

from django.utils import timezone

import pytest
from dateutil.relativedelta import relativedelta
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
)

from config.settings.base import BASE_API_URL
from shared.tests import convert_and_quantitize
from tasks.models import TaskHistory

from ...choices import AssetTypes, Currencies, TransactionActions
from ...models import AssetClosedOperation, AssetReadModel, Transaction
from ..shared import get_current_avg_price_bute_force

pytestmark = pytest.mark.django_db
URL = f"/{BASE_API_URL}" + "transactions"


def test__create__buy(client, stock_asset, mocker):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "asset_pk": stock_asset.pk,
        "operation_date": "12/12/2022",
    }
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args.kwargs == {"asset_id": stock_asset.pk, "is_aggregate_upsert": True}

    assert response.status_code == HTTP_201_CREATED
    assert Transaction.objects.filter(current_currency_conversion_rate=1).count() == 1


def test__create__future(client, stock_asset):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "asset_pk": stock_asset.pk,
        "operation_date": "12/12/2999",
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"operation_date": "You can't create a transaction in the future"}


def test__create__sell__stock_usa__closed_asset(
    client, stock_usa_asset, stock_usa_transaction, mocker
):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": stock_usa_transaction.quantity,
        "operation_date": "12/12/2022",
        "asset_pk": stock_usa_asset.pk,
        "current_currency_conversion_rate": 5,
    }
    mocker.patch("variable_income_assets.service_layer.handlers.upsert_asset_read_model")
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.create_asset_closed_operation"
    )

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert response.status_code == HTTP_201_CREATED
    assert Transaction.objects.count() == 2
    assert (
        Transaction.objects.filter(
            action=TransactionActions.sell, current_currency_conversion_rate=5
        ).count()
        == 1
    )


@pytest.mark.usefixtures("stock_usa_transaction")
@pytest.mark.parametrize(
    "data",
    (
        {
            "action": TransactionActions.sell,
            "price": 10,
            "quantity": 50,
            "operation_date": "12/12/2022",
        },
        {
            "action": TransactionActions.sell,
            "price": 10,
            "quantity": 50,
            "operation_date": "12/12/2022",
            "current_currency_conversion_rate": 1,
        },
    ),
)
def test__create__sell__stock_usa__current_currency_conversion_rate(client, data, stock_usa_asset):
    # GIVEN
    data["asset_pk"] = stock_usa_asset.pk

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "current_currency_conversion_rate": (
            "This value can't be ommited or set to 1 if the asset's currency is different than BRL"
        )
    }


def test__create__asset_does_not_exist(client):
    # GIVEN
    data = {
        "action": TransactionActions.buy,
        "price": 10,
        "quantity": 100,
        "operation_date": "12/12/2022",
        "asset_pk": 2147632814763784,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
    assert response.json() == {"asset": "Not found."}


def test__create__sell_transaction_and_no_transactions(client, stock_asset):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 100,
        "operation_date": "12/12/2022",
        "asset_pk": stock_asset.pk,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "Você não pode vender mais ativos que possui"}
    assert not Transaction.objects.exists()


def test__create__sell_transaction_and_no_asset(client, stock_asset):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": 10,
        "quantity": 100,
        "operation_date": "12/12/2022",
        "asset_pk": stock_asset.pk,
    }

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "Você não pode vender mais ativos que possui"}
    assert not Transaction.objects.exists()


@pytest.mark.skip("Skip while not implemented yet")
def test__create__sell_stock_eq_threshold(client, stock_asset, mocker):
    # GIVEN
    Transaction.objects.create(
        action=TransactionActions.buy, price=20, quantity=100, asset_id=stock_asset.id
    )
    data = {
        "action": TransactionActions.sell,
        "price": 200,
        "quantity": 100,
        "operation_date": "12/12/2022",
        "asset_code": stock_asset.code,
    }
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert not TaskHistory.objects.exists()

    assert response.status_code == HTTP_201_CREATED


@pytest.mark.skip("Skip while not implemented yet")
def test__create__sell_stock_gt_threshold(client, stock_asset, mocker):
    # GIVEN
    Transaction.objects.create(
        action=TransactionActions.buy, price=20, quantity=100, asset_id=stock_asset.id
    )
    data = {
        "action": TransactionActions.sell,
        "price": 201,
        "quantity": 100,
        "operation_date": "12/12/2022",
        "asset_code": stock_asset.code,
    }
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.post(URL, data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert TaskHistory.objects.count() == 1

    assert response.status_code == HTTP_201_CREATED


@pytest.mark.usefixtures("stock_asset")
def test__update(client, buy_transaction, mocker):
    # GIVEN
    data = {
        "action": buy_transaction.action,
        "price": buy_transaction.price + 1,
        "quantity": buy_transaction.quantity,
        "operation_date": buy_transaction.operation_date.strftime("%d/%m/%Y"),
    }
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.put(f"{URL}/{buy_transaction.pk}", data=data)

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args.kwargs == {
        "asset_id": buy_transaction.asset_id,
        "is_aggregate_upsert": True,
    }

    assert response.status_code == HTTP_200_OK

    buy_transaction.refresh_from_db()
    assert buy_transaction.price == data["price"]


@pytest.mark.usefixtures("stock_asset")
def test__update__future(client, buy_transaction):
    # GIVEN
    data = {
        "action": buy_transaction.action,
        "price": buy_transaction.price + 1,
        "quantity": buy_transaction.quantity,
        "operation_date": "12/12/2999",
    }

    # WHEN
    response = client.put(f"{URL}/{buy_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"operation_date": "You can't create a transaction in the future"}


@pytest.mark.usefixtures("stock_asset")
def test__update__transaction_does_not_belong_to_user(kucoin_client, buy_transaction):
    # GIVEN
    data = {
        "action": buy_transaction.action,
        "price": buy_transaction.price + 1,
        "quantity": buy_transaction.quantity,
        "operation_date": buy_transaction.operation_date.strftime("%d/%m/%Y"),
    }

    # WHEN
    response = kucoin_client.put(f"{URL}/{buy_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Not found."}


@pytest.mark.usefixtures("buy_transaction")
@pytest.mark.parametrize("extra_data", ({}, {"current_currency_conversion_rate": 5}))
def test__update__sell__stock__current_currency_conversion_rate(
    client, extra_data, sell_transaction, mocker
):
    # GIVEN
    data = {
        "action": sell_transaction.action,
        "price": sell_transaction.price * 2,
        "quantity": sell_transaction.quantity,
        "operation_date": sell_transaction.operation_date.strftime("%d/%m/%Y"),
        **extra_data,
    }
    mocker.patch("variable_income_assets.service_layer.handlers.upsert_asset_read_model")

    # WHEN
    response = client.put(f"{URL}/{sell_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_200_OK
    assert Transaction.objects.count() == 2
    assert (
        Transaction.objects.filter(
            action=TransactionActions.sell,
            current_currency_conversion_rate=1,
        ).count()
        == 1
    )


@pytest.mark.usefixtures("stock_usa_transaction")
@pytest.mark.parametrize("extra_data", ({}, {"current_currency_conversion_rate": 1}))
def test__update__sell__stock_usa__current_currency_conversion_rate(
    client, extra_data, stock_usa_sell_transaction
):
    # GIVEN
    data = {
        "action": stock_usa_sell_transaction.action,
        "price": stock_usa_sell_transaction.price * 2,
        "quantity": stock_usa_sell_transaction.quantity,
        "operation_date": stock_usa_sell_transaction.operation_date.strftime("%d/%m/%Y"),
        **extra_data,
    }

    # WHEN
    response = client.put(f"{URL}/{stock_usa_sell_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {
        "current_currency_conversion_rate": (
            "This value can't be ommited or set to 1 if the asset's currency is different than BRL"
        )
    }


def test__update__should_raise_error_if_sell_transaction_and_no_transactions(
    client, buy_transaction
):
    # GIVEN
    data = {
        "action": TransactionActions.sell,
        "price": buy_transaction.price,
        "quantity": 0.1,
        "operation_date": buy_transaction.operation_date.strftime("%d/%m/%Y"),
    }

    # WHEN
    response = client.put(f"{URL}/{buy_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "Você não pode vender mais ativos que possui"}

    assert Transaction.objects.filter(action=TransactionActions.buy).count() == 1
    assert not Transaction.objects.filter(action=TransactionActions.sell).exists()


@pytest.mark.usefixtures("buy_transaction")
def test__update__sell__should_raise_error_if_negative_quantity(client, sell_transaction):
    # GIVEN
    data = {
        "action": sell_transaction.action,
        "price": sell_transaction.price,
        "quantity": sell_transaction.quantity * 2,
        "operation_date": sell_transaction.operation_date.strftime("%d/%m/%Y"),
    }

    # WHEN
    response = client.put(f"{URL}/{sell_transaction.pk}", data=data)

    # THEN
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "Você não pode vender mais ativos que possui"}


@pytest.mark.usefixtures("transactions_indicators_data")
def test__indicators(client):
    # GIVEN
    base_date = timezone.now().date().replace(day=1)
    relative_date = base_date - relativedelta(months=13)
    summ = current_bought = current_sold = 0

    for _ in range(13):
        relative_date = relative_date + relativedelta(months=1)

        bought = sum(
            t.price * t.quantity * t.current_currency_conversion_rate
            for t in Transaction.objects.bought().filter(
                operation_date__month=relative_date.month,
                operation_date__year=relative_date.year,
            )
        )
        sold = sum(
            t.price * t.quantity * t.current_currency_conversion_rate
            for t in Transaction.objects.sold().filter(
                operation_date__month=relative_date.month,
                operation_date__year=relative_date.year,
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
def test__historic(client):
    # GIVEN
    base_date = timezone.now().date().replace(day=1)
    relative_date = base_date - relativedelta(months=13)
    summ = 0
    result = {}

    for _ in range(13):
        relative_date = relative_date + relativedelta(months=1)

        bought = sum(
            t.price * t.quantity * t.current_currency_conversion_rate
            for t in Transaction.objects.bought().filter(
                operation_date__month=relative_date.month,
                operation_date__year=relative_date.year,
            )
        )
        sold = sum(
            t.price * t.quantity * t.current_currency_conversion_rate
            for t in Transaction.objects.sold().filter(
                operation_date__month=relative_date.month,
                operation_date__year=relative_date.year,
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
def test__delete(client, buy_transaction, mocker):
    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.delete(f"{URL}/{buy_transaction.pk}")

    # THEN
    assert mocked_task.call_count == 1
    assert mocked_task.call_args.kwargs == {
        "asset_id": buy_transaction.asset_id,
        "is_aggregate_upsert": True,
    }

    assert response.status_code == HTTP_204_NO_CONTENT
    assert not Transaction.objects.exists()


@pytest.mark.usefixtures("stock_asset", "sell_transaction")
def test__delete__error__negative_qty(client, buy_transaction, mocker):
    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )

    # WHEN
    response = client.delete(f"{URL}/{buy_transaction.pk}")

    # THEN
    assert mocked_task.call_count == 0

    assert response.status_code == HTTP_400_BAD_REQUEST
    assert response.json() == {"action": "Você não pode vender mais ativos que possui"}
    assert Transaction.objects.count() == 2


@pytest.mark.usefixtures("stock_asset")
def test__delete__more_than_one_year_ago(client, buy_transaction, mocker):
    # GIVEN
    mocked_task = mocker.patch(
        "variable_income_assets.service_layer.handlers.upsert_asset_read_model"
    )
    buy_transaction.operation_date = datetime(year=2018, month=1, day=1)
    buy_transaction.save()

    # WHEN
    response = client.delete(f"{URL}/{buy_transaction.pk}")

    # THEN
    assert mocked_task.called is True
    assert response.status_code == HTTP_204_NO_CONTENT
    assert not Transaction.objects.exists()


def test__list__sanity_check(client, buy_transaction):
    # GIVEN

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": buy_transaction.id,
                "action": TransactionActions.get_choice(buy_transaction.action).label,
                "price": convert_and_quantitize(buy_transaction.price),
                "quantity": convert_and_quantitize(buy_transaction.quantity),
                "operation_date": buy_transaction.operation_date.strftime("%Y-%m-%d"),
                "current_currency_conversion_rate": (
                    buy_transaction.current_currency_conversion_rate
                ),
                "asset": {
                    "pk": buy_transaction.asset.pk,
                    "code": buy_transaction.asset.code,
                    "type": AssetTypes.get_choice(buy_transaction.asset.type).label,
                    "currency": Currencies.get_choice(buy_transaction.asset.currency).label,
                },
            }
        ],
    }


def test__forbidden__module_not_enabled(user, client):
    # GIVEN
    user.is_investments_module_enabled = False
    user.is_investments_integrations_module_enabled = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Você não tem acesso ao módulo de investimentos"}


def test__forbidden__subscription_ended(client, user):
    # GIVEN
    user.subscription_ends_at = timezone.now()
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_403_FORBIDDEN
    assert response.json() == {"detail": "Sua assinatura expirou"}


def test__unauthorized__inactive(client, user):
    # GIVEN
    user.is_active = False
    user.save()

    # WHEN
    response = client.get(URL)

    # THEN
    assert response.status_code == HTTP_401_UNAUTHORIZED
